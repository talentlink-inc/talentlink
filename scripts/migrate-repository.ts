// Repository migration: GAS Resume Lab (ResumeDB sheet + Drive files) →
// TalentLink's single verified resume pool.
//
// Every GAS row (Live, Prod and Staging alike) is checked, and only good
// resumes come across — as the user asked, there are no Live/Prod/Staging
// tabs in TalentLink, just one verified pool:
//   - the file must download and be a PDF / Word document (Google Docs are
//     exported to PDF);
//   - it must read as a resume (src/lib/resumeVerify.ts checkResumeText);
//     rows GAS already verified ("live") only need readable text;
//   - the candidate needs a real full name — GAS's if it's real, else from
//     the file name, else from the top of the resume. No name → left out;
//   - candidates already in TalentLink through a submission (same email) are
//     skipped, as GAS's catalog does, and duplicate emails keep the newest.
// Kept files are renamed "Full Name - Job Title.ext".
//
// Re-runnable: rows already imported (repositoryLegacyId) are skipped, so
// running it again picks up resumes that arrived in GAS since (re-sync).
// Downloads are cached in scripts/.cache/repository so a dry run and the real
// run fetch each file once.
//
// Usage:
//   npx tsx scripts/migrate-repository.ts --dry-run        # classify + measure, no writes
//   npx tsx scripts/migrate-repository.ts --limit 50       # real run, first 50 eligible
//   npx tsx scripts/migrate-repository.ts                  # real run, everything

import "dotenv/config";
import { createHash } from "node:crypto";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/db";
import { getTenantDbFor } from "../src/lib/tenantDb";
import { getSupabaseAdmin, RESUME_BUCKET } from "../src/lib/supabase/admin";
import { candidateIdentityHash } from "../src/lib/candidates";
import { deriveCountry } from "../src/lib/repository";
import { checkResumeText, repositoryFileName, resolveName, resolveTitle } from "../src/lib/resumeVerify";
import { getGoogleClients, readSheetAsObjects } from "./lib/sheets";

const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = (() => {
  const i = process.argv.indexOf("--limit");
  return i > -1 ? Number(process.argv[i + 1]) : Infinity;
})();
const TENANT_SUBDOMAIN = process.env.DEFAULT_TENANT_SUBDOMAIN ?? "digitallinks";
const CACHE_DIR = path.join("scripts", ".cache", "repository");
const CONCURRENCY = 6;
const MAX_BYTES = 8 * 1024 * 1024;

type Row = Record<string, string>;
type Outcome =
  | { kind: "kept"; legacyId: string; name: string; title: string | null; ext: string; mime: string; bytes: number; fileName: string; nameSource: string }
  | { kind: "skipped"; legacyId: string; reason: string; sheetName: string };

const MIME_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
};

function bucketOf(status: string) {
  const s = status.toLowerCase();
  if (["live", "verified", "accepted", "lab-verified"].includes(s)) return "live";
  if (s === "prod") return "prod";
  if (s === "lab-rejected") return "rejected";
  return "staging";
}

function parseDate(v: string | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseYears(v: string | undefined): number | null {
  const m = (v ?? "").match(/\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return n > 0 && n < 60 ? Math.round(n * 10) / 10 : null;
}

function skillsOf(r: Row): string | null {
  for (const key of ["coreSkills", "allSkills"]) {
    try {
      const arr = JSON.parse(r[key] || "[]");
      if (Array.isArray(arr) && arr.length) return arr.slice(0, 15).map(String).join(", ");
    } catch {
      /* not JSON */
    }
  }
  try {
    const pj = JSON.parse(r.parsedJson || "{}");
    if (Array.isArray(pj.skills) && pj.skills.length) return pj.skills.slice(0, 15).map(String).join(", ");
  } catch {
    /* malformed */
  }
  return null;
}

async function extractText(buf: Buffer, ext: string): Promise<string> {
  try {
    // Same libraries (and API) the app uses for resume parsing.
    if (ext === "pdf") {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buf });
      try {
        return (await parser.getText()).text ?? "";
      } finally {
        await parser.destroy();
      }
    }
    if (ext === "docx") {
      const mammoth = await import("mammoth");
      return (await mammoth.extractRawText({ buffer: buf })).value ?? "";
    }
  } catch {
    return "";
  }
  return ""; // legacy .doc: no text extraction
}

async function download(drive: ReturnType<typeof getGoogleClients>["drive"], fileId: string) {
  const metaPath = path.join(CACHE_DIR, `${fileId}.json`);
  const binPath = path.join(CACHE_DIR, `${fileId}.bin`);
  if (existsSync(metaPath) && existsSync(binPath)) {
    return { ...JSON.parse(readFileSync(metaPath, "utf8")), buf: readFileSync(binPath) } as { name: string; mime: string; buf: Buffer };
  }
  const meta = await drive.files.get({ fileId, fields: "name,mimeType,size", supportsAllDrives: true });
  let mime = meta.data.mimeType ?? "";
  let name = meta.data.name ?? "";
  let data: ArrayBuffer;
  if (mime === "application/vnd.google-apps.document") {
    const res = await drive.files.export({ fileId, mimeType: "application/pdf" }, { responseType: "arraybuffer" });
    data = res.data as ArrayBuffer;
    mime = "application/pdf";
    name = `${name}.pdf`;
  } else {
    const res = await drive.files.get({ fileId, alt: "media", supportsAllDrives: true }, { responseType: "arraybuffer" });
    data = res.data as ArrayBuffer;
  }
  const buf = Buffer.from(data);
  writeFileSync(binPath, buf);
  writeFileSync(metaPath, JSON.stringify({ name, mime }));
  return { name, mime, buf };
}

async function main() {
  mkdirSync(CACHE_DIR, { recursive: true });
  const tenant = await prisma.tenant.findUnique({ where: { subdomain: TENANT_SUBDOMAIN } });
  if (!tenant) throw new Error(`No tenant "${TENANT_SUBDOMAIN}".`);
  const db = getTenantDbFor(tenant.id);
  const { sheets, drive } = getGoogleClients();

  const all = (await readSheetAsObjects(sheets, process.env.GAS_SPREADSHEET_ID!, "ResumeDB")).filter((r) => r.id && r.driveFileId);

  // Already imported (re-sync) and already-known candidate emails.
  const existing = await db.candidate.findMany({ where: { tenantId: tenant.id }, select: { email: true, repositoryLegacyId: true } });
  const imported = new Set(existing.map((c) => c.repositoryLegacyId).filter(Boolean) as string[]);
  const knownEmails = new Set(existing.filter((c) => !c.repositoryLegacyId && c.email).map((c) => c.email!.trim().toLowerCase()));

  // Newest row per email wins.
  const received = (r: Row) => parseDate(r.sourceReceivedAt) ?? parseDate(r.acceptedAt) ?? parseDate(r.addedAt);
  const byEmail = new Map<string, Row>();
  for (const r of all) {
    const e = (r.email || "").trim().toLowerCase();
    if (!e) continue;
    const cur = byEmail.get(e);
    if (!cur || (received(r)?.getTime() ?? 0) > (received(cur)?.getTime() ?? 0)) byEmail.set(e, r);
  }

  const outcomes: Outcome[] = [];
  const queue: Row[] = [];
  for (const r of all) {
    const e = (r.email || "").trim().toLowerCase();
    const skip = (reason: string) => outcomes.push({ kind: "skipped", legacyId: r.id, reason, sheetName: r.name || "" });
    if (imported.has(r.id)) skip("already imported");
    else if (bucketOf(r.status || "") === "rejected") skip("rejected in GAS");
    else if (String(r.isResume).toUpperCase() === "FALSE") skip("GAS marked not a resume");
    else if (e && knownEmails.has(e)) skip("already a candidate (submission)");
    else if (e && byEmail.get(e) !== r) skip("duplicate email (older copy)");
    else queue.push(r);
  }
  const work = queue.slice(0, LIMIT === Infinity ? queue.length : LIMIT);
  console.log(`${all.length} GAS rows · ${queue.length} to check · ${outcomes.length} skipped up front${DRY_RUN ? " · DRY RUN" : ""}`);

  const supabase = DRY_RUN ? null : getSupabaseAdmin();
  let done = 0;

  async function handle(r: Row) {
    const skip = (reason: string) => outcomes.push({ kind: "skipped", legacyId: r.id, reason, sheetName: r.name || "" });
    let file: { name: string; mime: string; buf: Buffer };
    try {
      file = await download(drive, r.driveFileId);
    } catch {
      return skip("file not accessible in Drive");
    }
    const ext = MIME_EXT[file.mime];
    if (!ext) return skip(`not a PDF/Word file (${file.mime || "unknown"})`);
    if (file.buf.length > MAX_BYTES) return skip("file larger than 8 MB");
    const verified = bucketOf(r.status || "") === "live";
    const text = await extractText(file.buf, ext);
    if (ext === "doc" && !verified) return skip("old .doc format, not verified in GAS");
    if (ext !== "doc") {
      const check = checkResumeText(text, { verified });
      if (!check.ok) return skip(check.reason);
    }
    const name = resolveName(r.name, r.renameFromOriginal || file.name, text);
    if (!name) return skip("no real name found");
    const nameSource = name === (r.name || "").trim() ? "gas" : "fixed";
    const title = resolveTitle(r.currentTitle, text);
    const fileName = repositoryFileName(name, title, ext);
    outcomes.push({ kind: "kept", legacyId: r.id, name, title, ext, mime: file.mime, bytes: file.buf.length, fileName, nameSource });
    if (DRY_RUN) return;

    // Upload, then create the candidate + resume.
    const storagePath = `repository/${r.id}.${ext}`;
    const { error: upErr } = await supabase!.storage.from(RESUME_BUCKET).upload(storagePath, file.buf, { contentType: file.mime, upsert: true });
    if (upErr) {
      outcomes.pop();
      return skip(`upload failed: ${upErr.message}`);
    }
    const email = (r.email || "").trim() || null;
    const phone = (r.phone || "").trim() || null;
    const location = (r.location || "").trim() || null;
    const candidate = await db.candidate.create({
      data: {
        tenantId: tenant!.id,
        name,
        email,
        phone,
        currentLocation: location,
        totalExperienceYears: parseYears(r.yearsTotal),
        visaStatus: (r.visa || r.workAuth || "").trim() || null,
        linkedinUrl: (r.linkedinUrl || "").trim() || null,
        identityHash: candidateIdentityHash(email, phone, `repository|${r.id}`),
        inRepository: true,
        currentTitle: title,
        skills: skillsOf(r),
        country: deriveCountry(location),
        repositoryReceivedAt: received(r),
        repositoryAddedBy: (r.addedBy || "").trim() || null,
        repositoryLegacyId: r.id,
      },
    });
    await db.resume.create({
      data: {
        tenantId: tenant!.id,
        candidateId: candidate.id,
        fileUrl: storagePath,
        fileName,
        fileMime: file.mime,
        fileSizeBytes: file.buf.length,
        fileSha256: createHash("sha256").update(file.buf).digest("hex"),
        sourceDriveFileId: r.driveFileId,
        source: "repository",
      },
    });
  }

  // Small worker pool.
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < work.length) {
        const r = work[next++];
        try {
          await handle(r);
        } catch (err) {
          outcomes.push({ kind: "skipped", legacyId: r.id, reason: `error: ${(err as Error).message.slice(0, 80)}`, sheetName: r.name || "" });
        }
        if (++done % 250 === 0) console.log(`  …${done}/${work.length}`);
      }
    })
  );

  // Report.
  const kept = outcomes.filter((o): o is Extract<Outcome, { kind: "kept" }> => o.kind === "kept");
  const skipped = outcomes.filter((o): o is Extract<Outcome, { kind: "skipped" }> => o.kind === "skipped");
  const reasons: Record<string, number> = {};
  for (const s of skipped) reasons[s.reason] = (reasons[s.reason] ?? 0) + 1;
  const bytes = kept.reduce((n, k) => n + k.bytes, 0);
  console.log({
    kept: kept.length,
    keptMB: Math.round(bytes / 1024 / 1024),
    namesFixed: kept.filter((k) => k.nameSource === "fixed").length,
    withoutTitle: kept.filter((k) => !k.title).length,
    skipped: skipped.length,
    skippedBy: reasons,
  });
  console.log("sample file names:", kept.slice(0, 12).map((k) => k.fileName));
  const reportPath = path.join(CACHE_DIR, `report-${DRY_RUN ? "dry" : "real"}.json`);
  writeFileSync(reportPath, JSON.stringify({ kept, skipped }, null, 1));
  console.log(`Full report: ${reportPath}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
