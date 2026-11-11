import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PANELS = ["frontend", "seller-frontend", "courier-frontend", "admin-frontend"];
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

/**
 * Two rules the whole product shares and nothing in a single panel enforces:
 * every interface paints with the platform's own Vazirmatn file (a CDN face
 * arrives late, or never, and the page reflows when it lands), and a block that
 * is still loading keeps the size its content will have. A panel that quietly
 * adds a <link> back, or drops a placeholder, fails here.
 */
const code = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");

const sheets = {
  frontend: ["frontend/src/index.css"],
  "seller-frontend": ["seller-frontend/src/style.css"],
  "courier-frontend": [
    "courier-frontend/src/style.css",
    "courier-frontend/src/redesign.css",
  ],
  "admin-frontend": ["admin-frontend/src/style.css", "admin-frontend/src/adminShell.css"],
};
const cssOf = (panel) =>
  sheets[panel].map((rel) => code(read(rel))).join("\n");

test("no panel downloads a font from a CDN", () => {
  for (const panel of PANELS) {
    const sources = [...sheets[panel], `${panel}/index.html`, `${panel}/src/main.tsx`];
    for (const rel of sources) {
      if (!fs.existsSync(path.join(ROOT, rel))) continue;
      const src = read(rel);
      assert.ok(
        !/fonts\.(googleapis|gstatic)\.com/.test(src),
        `${rel} still points at a hosted font — the face must ship with the app`,
      );
    }
  }
});

test("the customer app serves the two subsets it needs from its own origin", () => {
  for (const file of [
    "vazirmatn-arabic-wght-normal.woff2",
    "vazirmatn-latin-wght-normal.woff2",
  ]) {
    const stat = fs.statSync(path.join(ROOT, "frontend/public/fonts", file));
    assert.ok(stat.size > 10_000, `${file} looks truncated (${stat.size} bytes)`);
  }
  assert.ok(
    fs.existsSync(path.join(ROOT, "frontend/public/fonts/OFL.txt")),
    "the font licence has to travel with the files",
  );
  const css = cssOf("frontend");
  assert.match(css, /@font-face\s*\{[^}]*"Vazirmatn Variable"/, "no @font-face for the bundled face");
  assert.match(css, /url\("\/fonts\/vazirmatn-arabic-wght-normal\.woff2"\)/);
  assert.match(css, /font-weight:\s*100 900/, "the face must be the variable one");
});

test("all four panels ask for the same family, and no fake weights", () => {
  for (const panel of PANELS) {
    const css = cssOf(panel);
    assert.match(
      css,
      /"Vazirmatn Variable",\s*"Vazirmatn"/,
      `${panel} does not start with the platform family`,
    );
    assert.match(css, /font-synthesis:\s*none/, `${panel} would synthesise bold`);
    assert.match(
      css,
      /(font:\s*inherit|font-family:\s*inherit)/,
      `${panel} leaves form controls on the browser default font`,
    );
  }
  for (const panel of PANELS.filter((p) => p !== "frontend")) {
    assert.match(
      read(`${panel}/src/main.tsx`),
      /import "@fontsource-variable\/vazirmatn"/,
      `${panel} no longer bundles the face`,
    );
    assert.match(
      read(`${panel}/package.json`),
      /"@fontsource-variable\/vazirmatn"/,
      `${panel} lost the font dependency`,
    );
  }
});

test("the courier bottom bar keeps its small labels", () => {
  const css = cssOf("courier-frontend");
  const sizes = [...css.matchAll(/\.sidebar nav button(?: span)?\s*\{([^}]*)\}/g)]
    .map((m) => /font-size:\s*([\d.]+)px/.exec(m[1]))
    .filter(Boolean)
    .map((m) => Number(m[1]));
  assert.ok(sizes.length >= 2, `expected the mobile and desktop nav rules, saw ${sizes}`);
  assert.ok(
    sizes[sizes.length - 1] <= 8,
    `the last rule wins on a phone and it is ${sizes[sizes.length - 1]}px`,
  );
});

test("an open courier notification list cannot be painted under the map or the bar", () => {
  const css = cssOf("courier-frontend");
  // The highest z-index any rule for that selector declares, across every block
  // and media query that mentions it.
  const z = (selector) => {
    let best = -1;
    for (const m of css.matchAll(new RegExp(`${selector}\\s*\\{([^}]*)\\}`, "g"))) {
      const found = /z-index:\s*(-?\d+)/.exec(m[1]);
      if (found) best = Math.max(best, Number(found[1]));
    }
    assert.ok(best >= 0, `${selector} has no rule with a z-index any more`);
    return best;
  };
  const layer = z(".notif-layer");
  assert.ok(layer >= z(".sidebar nav"), "the notification layer sits below the bottom bar");
  assert.ok(layer >= z(".dispatch-map"), "the leaflet map paints over the notifications");
});

test("loading blocks hold their own height in the courier and admin panels", () => {
  const dashboard = code(read("courier-frontend/src/Dashboard.tsx"));
  assert.match(dashboard, /className="dispatch-map map-skeleton"/, "the map has no placeholder");
  assert.match(dashboard, /className="list-skeleton"/, "the offer list has no placeholder");
  assert.match(
    dashboard,
    /className="skeleton-num/,
    "the weekly numbers must not flip from a dash to a figure",
  );
  const shell = code(read("courier-frontend/src/CourierApp.tsx"));
  assert.match(shell, /loading=\{!ordersLoaded\}/, "the dashboard never learns it is loading");
  assert.match(
    shell,
    /setOrdersLoaded\(true\)/,
    "the loading flag is never cleared",
  );
  for (const cls of ["map-skeleton", "skeleton-sweep", "list-skeleton", "skeleton-num"])
    assert.ok(cssOf("courier-frontend").includes(`.${cls}`), `no style for .${cls}`);

  const admin = code(read("admin-frontend/src/AdminApp.tsx"));
  assert.match(admin, /loading=\{!ready\}/, "the dashboard tables paint zeros first");
  assert.match(admin, /loading=\{tableLoading\}/, "the orders table has no placeholder rows");
  for (const cls of ["skeleton-num", "skeleton-bar", "table-skeleton-row"])
    assert.ok(cssOf("admin-frontend").includes(`.${cls}`), `no style for .${cls}`);
});

test("the admin client does not send a request it knows must fail", () => {
  const src = code(read("admin-frontend/src/AdminApp.tsx"));
  assert.match(
    src,
    /if \(!token && path !== "\/login"\)/,
    "an unauthenticated admin request would log a 401 for no reason",
  );
  assert.match(src, /function expireAdminSession/, "expiry is not handled in one place");
  assert.match(src, /admin-expired", \{ detail: message \}/, "the admin is not told why");
  assert.ok(
    !/headers: \{\s*Authorization: `Bearer \$\{sessionStorage/.test(src),
    "a document request still sends Bearer-null",
  );
});
