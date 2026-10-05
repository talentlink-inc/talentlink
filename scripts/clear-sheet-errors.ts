// One-off cleanup: GAS rows imported with spreadsheet formula errors (e.g.
// "#ERROR!" in a contact number) showed that text verbatim in TalentLink.
// Clears "#ERROR!" values in every text field of the imported tables —
// optional fields become empty (null), required ones an empty string. Other
// spreadsheet error codes (#N/A, #REF!, …) are reported, not changed.
//
// Usage: npx tsx scripts/clear-sheet-errors.ts [--dry-run]

import "dotenv/config";
import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/db";
import { getTenantDbFor } from "../src/lib/tenantDb";

const DRY_RUN = process.argv.includes("--dry-run");
const TENANT_SUBDOMAIN = process.env.DEFAULT_TENANT_SUBDOMAIN ?? "digitallinks";
const MODELS = ["BenchConsultant", "BenchSubmission", "BenchInterview", "Candidate", "Submission", "Interview", "Requirement"];
const TARGET = /^\s*#ERROR!\s*$/i;
const OTHER_SHEET_ERRORS = /^\s*#(N\/A|REF!|VALUE!|NAME\?|DIV\/0!|NUM!|NULL!)\s*$/i;

// String fields per model, with whether they're optional, read from the schema.
function stringFields(model: string): { name: string; optional: boolean }[] {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const block = schema.match(new RegExp(`model ${model} \\{([\\s\\S]*?)\\n\\}`))?.[1];
  if (!block) throw new Error(`Model ${model} not found in schema.prisma`);
  return block
    .split("\n")
    .map((l) => l.trim().match(/^(\w+)\s+String(\?)?(\s|$)/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => ({ name: m[1], optional: m[2] === "?" }));
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { subdomain: TENANT_SUBDOMAIN } });
  if (!tenant) throw new Error(`No tenant "${TENANT_SUBDOMAIN}".`);
  const db = getTenantDbFor(tenant.id) as unknown as Record<
    string,
    {
      findMany: (a: object) => Promise<Record<string, unknown>[]>;
      update: (a: object) => Promise<unknown>;
    }
  >;

  let cleared = 0;
  for (const model of MODELS) {
    const fields = stringFields(model);
    const accessor = model[0].toLowerCase() + model.slice(1);
    const rows = await db[accessor].findMany({ where: { tenantId: tenant.id } });
    for (const row of rows) {
      const data: Record<string, string | null> = {};
      for (const f of fields) {
        const v = row[f.name];
        if (typeof v !== "string") continue;
        if (TARGET.test(v)) data[f.name] = f.optional ? null : "";
        else if (OTHER_SHEET_ERRORS.test(v)) console.log(`  (not changed) ${model} ${row.id} ${f.name} = ${v.trim()}`);
      }
      const keys = Object.keys(data);
      if (!keys.length) continue;
      cleared += keys.length;
      const label = (row.submissionCode ?? row.consultantCode ?? row.submissionId ?? row.jobId ?? row.id) as string;
      console.log(`${DRY_RUN ? "[dry-run] " : ""}${model} ${label}: clearing ${keys.join(", ")}`);
      if (!DRY_RUN) await db[accessor].update({ where: { id: row.id }, data });
    }
  }
  console.log(`${DRY_RUN ? "[dry-run] would clear" : "Cleared"} ${cleared} field value(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
