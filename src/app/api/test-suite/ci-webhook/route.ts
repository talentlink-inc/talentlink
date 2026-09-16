import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

// The GitHub Actions workflow (.github/workflows/tests.yml) POSTs its
// summarized Vitest results here after every run so the Test Suite
// dashboard has a live view of CI status without the app needing to poll
// GitHub or parse a downloaded artifact. Deliberately not tenant-scoped —
// see the CiSuiteSnapshot model comment in schema.prisma.
//
// Auth is a single shared secret (CI_WEBHOOK_SECRET), set identically in
// this app's env vars and the GitHub Actions repo secrets — there's no
// per-tenant concept here since a CI run covers the whole codebase.

function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

const categoryResultSchema = z.object({
  category: z.string().min(1),
  status: z.enum(["pass", "fail"]),
  passCount: z.number().int().nonnegative(),
  failCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
  details: z.array(z.object({ name: z.string(), status: z.string(), message: z.string().optional() })).optional(),
});

const payloadSchema = z.object({
  commitSha: z.string().optional(),
  runUrl: z.string().optional(),
  categories: z.array(categoryResultSchema),
});

export async function POST(req: NextRequest) {
  const configuredSecret = process.env.CI_WEBHOOK_SECRET;
  if (!configuredSecret) {
    return NextResponse.json({ error: "CI_WEBHOOK_SECRET is not configured on this deployment." }, { status: 503 });
  }

  const provided = req.headers.get("x-ci-webhook-secret");
  if (!provided || !timingSafeEqualStrings(provided, configuredSecret)) {
    return NextResponse.json({ error: "Invalid or missing webhook secret." }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
  }

  for (const cat of parsed.data.categories) {
    await prisma.ciSuiteSnapshot.upsert({
      where: { category: cat.category },
      create: {
        category: cat.category,
        status: cat.status,
        passCount: cat.passCount,
        failCount: cat.failCount,
        totalCount: cat.totalCount,
        commitSha: parsed.data.commitSha,
        runUrl: parsed.data.runUrl,
        details: cat.details ?? undefined,
      },
      update: {
        status: cat.status,
        passCount: cat.passCount,
        failCount: cat.failCount,
        totalCount: cat.totalCount,
        commitSha: parsed.data.commitSha,
        runUrl: parsed.data.runUrl,
        details: cat.details ?? undefined,
      },
    });
  }

  return NextResponse.json({ ok: true, updated: parsed.data.categories.length });
}
