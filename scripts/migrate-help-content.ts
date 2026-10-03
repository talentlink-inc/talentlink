// Imports the GAS app's Help Center topics (HelpContent sheet) into
// help_topics, sanitized with sanitizeHelpHtml. Order and Active/Inactive
// status carry over.
//
// One exception: the GAS "Using This Portal" topic describes the GAS app's
// own screens, so it's replaced with an equivalent guide to TalentLink.
// Every other topic (staffing knowledge — visas, rates, terminology...) is
// imported as written.
//
// Idempotent: topics already imported (matched on legacyId) are skipped, so
// Admin edits made in TalentLink are never overwritten.
//
// Usage:
//   npx tsx scripts/migrate-help-content.ts --dry-run
//   npx tsx scripts/migrate-help-content.ts

import "dotenv/config";
import { prisma } from "../src/lib/db";
import { getTenantDbFor } from "../src/lib/tenantDb";
import { sanitizeHelpHtml } from "../src/lib/sanitizeRichText";
import { getGoogleClients, readSheetAsObjects } from "./lib/sheets";
import { parseInt10 } from "./lib/parse";

const DRY_RUN = process.argv.includes("--dry-run");
const SPREADSHEET_ID = process.env.GAS_SPREADSHEET_ID;
const TENANT_SUBDOMAIN = process.env.DEFAULT_TENANT_SUBDOMAIN ?? "digitallinks";

const USING_TALENTLINK = `
<h4>Finding Your Way Around</h4>
<p>The menu on the left groups everything by area. <strong>Recruitment</strong> covers Requirements, Submissions, Interviews and Placements. <strong>Sales</strong> holds Bench Sales (Admins, Managers and Bench Sales users). <strong>Admin</strong> holds User Management, Settings and the Test Suite. Collapse the menu with the arrow at the top; on a phone it starts collapsed.</p>
<h4>Recruitment</h4>
<ul>
<li><strong>Requirements:</strong> open jobs (JOB-0001…). Click a Job ID to view it, the copy icon to clone a selected row, and the stars to set priority.</li>
<li><strong>Submissions:</strong> candidates submitted against a requirement (SUB-0001…), with resume upload and duplicate checks.</li>
<li><strong>Interviews:</strong> schedule rounds against a submission. Times are entered in the interview's own timezone.</li>
<li><strong>Placements:</strong> submissions that reached Client_Selected, Background_Check, Onboarding or Started_Billable get a placement ID (PLC-0001…) and stay listed even if they fall through later.</li>
</ul>
<h4>Bench Sales</h4>
<p>Consultants we market out to vendors and clients (BC-0001…): their submissions to companies (BSUB-0001…), interviews, placements (BPLC-0001…), the hotlist and a team notes board. Use <strong>Export hotlist</strong> to copy the formatted hotlist into an email.</p>
<h4>Search and Shortcuts</h4>
<ul>
<li><strong>⌘K / Ctrl+K:</strong> search everything — requirements, candidates, interviews, users and bench records.</li>
<li><strong>/</strong> focuses the search box on the current page; <strong>n</strong> creates a new record; <strong>Esc</strong> closes the open window; <strong>?</strong> lists all shortcuts.</li>
</ul>
<h4>Notes</h4>
<p>Every requirement, submission, interview and bench record has its own notes thread at the bottom of its detail view. You can edit your own notes; Admins and Managers can delete any.</p>
<h4>Your Account and Data Access</h4>
<p>Turn on two-factor sign-in from your account menu (top right → My Account). What you can see — resumes, candidate phone numbers and emails, regions — is set by an Admin in User Management; restricted fields show as “Restricted”.</p>
<h4>Need More Help?</h4>
<p>Ask your Admin. Admins can add or update topics here with <strong>+ Add Topic</strong>.</p>
`.trim();

async function main() {
  if (!SPREADSHEET_ID) throw new Error("GAS_SPREADSHEET_ID is not set.");
  const tenant = await prisma.tenant.findUnique({ where: { subdomain: TENANT_SUBDOMAIN } });
  if (!tenant) throw new Error(`No tenant with subdomain "${TENANT_SUBDOMAIN}".`);
  const db = getTenantDbFor(tenant.id);

  const { sheets } = getGoogleClients();
  const rows = await readSheetAsObjects(sheets, SPREADSHEET_ID, "HelpContent");
  const existing = await db.helpTopic.findMany({ where: { tenantId: tenant.id }, select: { legacyId: true } });
  const have = new Set(existing.map((t) => t.legacyId).filter((id) => id != null));

  let created = 0;
  for (const row of rows) {
    const legacyId = parseInt10(row.ID);
    if (legacyId === null || have.has(legacyId)) continue;
    const title = (row.Title ?? "").trim();
    if (!title) continue;
    const isPortalGuide = title.toLowerCase() === "using this portal";
    const content = sanitizeHelpHtml(isPortalGuide ? USING_TALENTLINK : row.Content ?? "");
    const data = {
      tenantId: tenant.id,
      legacyId,
      title: isPortalGuide ? "Using TalentLink" : title,
      content,
      sortOrder: parseInt10(row.SortOrder) ?? legacyId,
      status: (row.Status ?? "").trim().toLowerCase() === "active" ? "Active" : "Inactive",
    };
    console.log(`${DRY_RUN ? "[dry-run] " : ""}#${legacyId} [${data.status}] ${data.title} (${content.length} chars)${isPortalGuide ? "  ← rewritten for TalentLink" : ""}`);
    if (!DRY_RUN) await db.helpTopic.create({ data });
    created++;
  }
  console.log(`\n${DRY_RUN ? "Would import" : "Imported"} ${created} topic(s); ${have.size} already present.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
