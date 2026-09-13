import { execSync } from "node:child_process";

// Tracks the deployed commit automatically instead of a hand-bumped string —
// Vercel sets VERCEL_GIT_COMMIT_SHA for every build, so each deploy gets a
// distinct version with zero maintenance. Falls back to reading the local
// git HEAD (only reachable in `next dev`, since Vercel's build output has no
// .git directory) and finally to "dev" if that's not available either.
function resolveVersion(): string {
  const vercelSha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (vercelSha) return vercelSha.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev";
  }
}

// Resolved once per server process — a new deploy is a new process, so this
// naturally changes exactly when a new version actually goes live.
export const APP_VERSION = resolveVersion();
