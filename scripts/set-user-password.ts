// One-off admin helper: sets a Supabase Auth user's password directly via the
// Admin API, bypassing the email-based recovery flow entirely. Prompts for
// the password locally in your terminal — it's never sent anywhere else.
//
// Usage: npx tsx scripts/set-user-password.ts <email>

import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { supabaseAdmin } from "../src/lib/supabase/admin";

// Not masked (a solo dev's own local terminal, not shared/recorded) — keeps
// this script simple and robust rather than fighting readline internals.
async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer;
}

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npx tsx scripts/set-user-password.ts <email>");
    process.exit(1);
  }

  const { data, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) throw listError;

  const user = data.users.find((u) => u.email === email);
  if (!user) {
    console.error(`No Supabase Auth user found with email ${email}`);
    process.exit(1);
  }

  const password = await prompt(`New password for ${email}: `);
  const confirm = await prompt("Confirm password: ");

  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }
  if (password !== confirm) {
    console.error("Passwords don't match.");
    process.exit(1);
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password });
  if (error) throw error;

  console.log(`Password set for ${email}. You can now sign in at /login.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
