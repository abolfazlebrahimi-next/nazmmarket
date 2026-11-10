import { hashPassword } from "./auth.js";
import { readAdminPassword } from "./admin-password-input.js";

// No command-line password arguments, echo, or secret files.
try {
  const password = await readAdminPassword();
  if (password.length < 12)
    throw new Error(
      "Admin password must have at least 12 characters. Run again with a new password.",
    );
  const hash = hashPassword(password);
  if (process.stdin.isTTY) {
    console.error(
      "Copy the following complete line into backend/.env (replace the existing ADMIN_PASSWORD_HASH):",
    );
    console.log(`ADMIN_PASSWORD_HASH='${hash}'`);
    console.error(
      "Set ADMIN_USERNAME=admin in the same file, save it, then restart the backend. Log in with your password, not the hash.",
    );
  } else {
    // Existing scripts piping a password still receive only the scrypt hash.
    console.log(hash);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
