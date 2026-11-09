import { hashPassword } from "./auth.js";
// Read from stdin, not argv, so the password does not appear in process listings.
let password = "";
for await (const chunk of process.stdin) password += chunk;
password = password.trim();
if (password.length < 12) {
  console.error("Admin password must have at least 12 characters.");
  process.exitCode = 1;
} else console.log(hashPassword(password));
