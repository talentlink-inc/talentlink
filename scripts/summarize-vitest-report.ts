// Reads Vitest's --reporter=json output and groups results by the
// `[category]` tags embedded in describe/it titles (see src/lib/**/*.test.ts)
// into the shape src/app/api/test-suite/ci-webhook/route.ts expects. Run by
// .github/workflows/tests.yml after every test run; not part of the app
// bundle itself.
import { readFileSync } from "node:fs";
import { TEST_CATEGORIES } from "../src/lib/testManifest";

const KNOWN_CATEGORY_KEYS = new Set(TEST_CATEGORIES.filter((c) => c.mode === "code").map((c) => c.key));

interface AssertionResult {
  ancestorTitles: string[];
  fullName: string;
  status: string;
}
interface VitestJsonReport {
  testResults: { assertionResults: AssertionResult[] }[];
}

function tagsIn(text: string): string[] {
  const matches = [...text.matchAll(/\[([a-z]+)\]/g)].map((m) => m[1]);
  return matches.filter((tag) => KNOWN_CATEGORY_KEYS.has(tag));
}

function main() {
  const reportPath = process.argv[2] ?? "vitest-report.json";
  const raw = readFileSync(reportPath, "utf-8");
  const report: VitestJsonReport = JSON.parse(raw);

  const byCategory = new Map<string, { pass: number; fail: number; details: { name: string; status: string }[] }>();
  for (const key of KNOWN_CATEGORY_KEYS) byCategory.set(key, { pass: 0, fail: 0, details: [] });

  for (const file of report.testResults) {
    for (const assertion of file.assertionResults) {
      const tags = new Set([...tagsIn(assertion.ancestorTitles.join(" ")), ...tagsIn(assertion.fullName)]);
      // Untagged tests still count somewhere — default to "unit", the
      // broadest/most common category, rather than dropping them silently.
      if (tags.size === 0) tags.add("unit");

      const passed = assertion.status === "passed";
      for (const tag of tags) {
        const bucket = byCategory.get(tag);
        if (!bucket) continue;
        if (passed) bucket.pass += 1;
        else bucket.fail += 1;
        bucket.details.push({ name: assertion.fullName, status: assertion.status });
      }
    }
  }

  const categories = [...byCategory.entries()]
    .filter(([, v]) => v.pass + v.fail > 0)
    .map(([category, v]) => ({
      category,
      status: v.fail === 0 ? "pass" : "fail",
      passCount: v.pass,
      failCount: v.fail,
      totalCount: v.pass + v.fail,
      details: v.details,
    }));

  process.stdout.write(JSON.stringify({ categories }));
}

main();
