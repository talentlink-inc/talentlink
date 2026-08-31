import { randomInt } from "node:crypto";

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I/O — avoid look-alikes
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%*?";
const ALL = UPPER + LOWER + DIGITS + SYMBOLS;

function pick(charset: string): string {
  return charset[randomInt(charset.length)];
}

// One-time-display generated password for admin-created accounts and resets —
// mirrors the manual "hardcode an auto-generated password" flow used earlier
// in this project, now reusable from the User Management UI.
export function generatePassword(length = 14): string {
  const required = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  const rest = Array.from({ length: length - required.length }, () => pick(ALL));
  const chars = [...required, ...rest];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
