import readline from "node:readline";
import { Writable } from "node:stream";

/** Read one password, not the entire stdin stream. Interactive input is hidden. */
export function readAdminPassword(
  input = process.stdin,
  output = process.stderr,
  interactive = Boolean(input.isTTY),
) {
  if (interactive)
    output.write(
      "Admin password (at least 12 characters; press Enter, input hidden): ",
    );
  // readline needs a terminal output to handle editing, but must never echo the secret.
  const hiddenOutput = new Writable({
    write(_chunk, _encoding, done) {
      done();
    },
  });
  const rl = readline.createInterface({
    input,
    output: hiddenOutput,
    terminal: interactive,
    historySize: 0,
  });
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, password) => {
      if (settled) return;
      settled = true;
      rl.close();
      if (interactive) output.write("\n");
      hiddenOutput.end();
      if (error) reject(error);
      else resolve(password.trim());
    };
    rl.once("line", (password) => finish(null, password));
    rl.once("SIGINT", () =>
      finish(new Error("Password entry cancelled. No hash was generated.")),
    );
    rl.once("close", () =>
      finish(
        new Error(
          "No password entered. Run the command again and type a password, then press Enter.",
        ),
      ),
    );
    input.once("error", (error) => finish(error));
  });
}
