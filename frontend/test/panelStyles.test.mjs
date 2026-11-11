import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PANELS = ["seller-frontend", "courier-frontend", "admin-frontend"];
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/**
 * The three panels ship hand-written stylesheets and no test runner of their
 * own, so their class coverage is checked here — next to the only `node --test`
 * harness in the repo. A class used in JSX but never styled stays invisible until
 * someone opens that panel, which is how the Jalali picker or a promo row could
 * silently regress.
 */
function usedClasses(panel) {
  const used = new Map();
  const dir = path.join(ROOT, panel, "src");
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith(".tsx")) continue;
    const source = read(`${panel}/src/${entry}`);
    const literals = [
      ...[...source.matchAll(/className\s*=\s*"([^"]+)"/g)].map((m) => m[1]),
      ...[...source.matchAll(/className=\{`([^`]+)`\}/g)].map((m) =>
        m[1].replace(/\$\{[^}]*\}/g, " "),
      ),
    ];
    for (const literal of literals)
      for (const token of literal.split(/\s+/))
        // Variant syntax and interpolated fragments are not class names.
        if (token && !/[:\[\]{}()'"`]/.test(token)) used.set(token, entry);
  }
  return used;
}

function panelCss(panel) {
  const sheets = [
    ...fs
      .readdirSync(path.join(ROOT, panel, "src"))
      .filter((name) => name.endsWith(".css"))
      .map((name) => `${panel}/src/${name}`),
    // The date picker sheet, plus the floating-label rules formValidation.ts
    // injects at runtime.
    "shared/persianDateField.css",
    "shared/formValidation.ts",
  ];
  return sheets
    .map((sheet) => read(sheet))
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

for (const panel of PANELS) {
  test(`${panel}: every class used in JSX has a style`, () => {
    const used = usedClasses(panel);
    const css = panelCss(panel);
    const missing = [...used]
      .filter(([token]) => !css.includes(`.${token}`))
      .map(([token, file]) => `${token} (used in ${file})`);
    assert.ok(used.size > 20, `expected a real class list, saw ${used.size}`);
    assert.deepEqual(missing, [], `unstyled classes: ${missing.join(", ")}`);
  });
}

test("the Jalali picker is copied identically into every panel", () => {
  const copies = PANELS.map((panel) => ({
    panel,
    source: read(`${panel}/src/PersianDateField.tsx`),
  }));
  for (const { panel, source } of copies) {
    assert.match(source, /naz-jalali-trigger/, `${panel} lost the trigger`);
    assert.match(
      source,
      /from "\.\.\/\.\.\/shared\/persianDate"/,
      `${panel} must import the shared Jalali maths instead of copying them`,
    );
  }
  const [first, ...rest] = copies;
  for (const other of rest)
    assert.equal(
      other.source,
      first.source,
      `${other.panel} drifted from ${first.panel}`,
    );
});

test("the picker CSS defines every class the component renders", () => {
  const component = read("seller-frontend/src/PersianDateField.tsx");
  const css = read("shared/persianDateField.css");
  const rendered = new Set(component.match(/naz-jalali[a-z-]*/g));
  assert.ok(
    rendered.size >= 10,
    `expected the whole picker, saw ${rendered.size}`,
  );
  for (const token of rendered)
    assert.ok(css.includes(`.${token}`), `missing style for .${token}`);
});
