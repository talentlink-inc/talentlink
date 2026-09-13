import type { NextConfig } from "next";
import { execSync } from "node:child_process";

// Computed once, here, at real `next build` time (this file runs as plain
// Node before the build starts, so `.git` is guaranteed to be present —
// unlike server/route-handler code, which only runs at request time in the
// deployed, git-less serverless bundle). Matches the original ITStaffing
// app's "vYYYY.MM.DD.NN" release badge: NN is how many commits (≈ deploys,
// in this repo's one-push-one-deploy workflow) landed on that same day.
function computeVersion(): string {
  try {
    const date = execSync("git log -1 --date=short --format=%cd").toString().trim(); // e.g. 2026-09-13
    const count = execSync(
      `git log --since="${date} 00:00:00" --until="${date} 23:59:59" --oneline | wc -l`
    )
      .toString()
      .trim();
    return `${date.replaceAll("-", ".")}.${count.padStart(2, "0")}`;
  } catch {
    return "dev";
  }
}

const nextConfig: NextConfig = {
  env: {
    APP_VERSION: computeVersion(),
  },
};

export default nextConfig;
