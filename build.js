#!/usr/bin/env node
/**
 * build.js — Phase 2 of the BloodsRUs CMS refactor.
 *
 * Reads index.template.html + content.json + list_render_manifest.json and
 * emits index.html. Run on Vercel via "buildCommand": "node build.js".
 *
 * Behaviour:
 *  - For each {{LABEL}} placeholder, look up the block in content.json.
 *  - Text block (kind:"text") → splice the value directly. HTML in the value
 *    is rendered as-is (so editors can keep <em>R</em>, <strong>, <br>, etc.).
 *  - List block (kind:"list") → render each item according to the manifest hint:
 *      ul-li / ol-li      → "<li>item</li>\n"
 *      select-option      → "<option ...>item</option>\n" (first item is placeholder)
 *      datalist-option    → '<option value="item"></option>\n'
 *    Default (no hint or unknown) → <li> rendering.
 *  - Missing placeholders are logged as warnings, NOT errors. Build never crashes.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = __dirname;
const TEMPLATE = path.join(ROOT, "index.template.html");
const CONTENT = path.join(ROOT, "content.json");
const MANIFEST = path.join(ROOT, "list_render_manifest.json");
// Static output goes to public/ so Vercel's zero-config build serves it as the
// static output dir AND still scans the api/ directory for Serverless Functions.
// (If the output dir were the repo root, api/contact.js would be served as a
// static source file instead of running as a function.)
const DIST = path.join(ROOT, "public");
const OUTPUT = path.join(DIST, "index.html");
// Also keep a copy of index.html at the repo root for local preview / git diffs.
const ROOT_OUTPUT = path.join(ROOT, "index.html");

// Static assets copied verbatim into dist/. Directories are copied recursively.
const STATIC_ASSETS = [
  "app.js",
  "style.css",
  "base.css",
  "robots.txt",
  "sitemap.xml",
  "favicon.ico",
  "favicon-16.png",
  "favicon-32.png",
  "favicon-48.png",
  "favicon-180.png",
  "favicon-192.png",
  "favicon-512.png",
  "apple-touch-icon.png",
  "images",
];

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

function escapeForAttr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function flatten(content) {
  const out = Object.create(null);
  for (const page of content.pages || []) {
    for (const section of page.sections || []) {
      for (const b of section.blocks || []) {
        out[b.label] = b;
      }
      for (const sub of section.subsections || []) {
        for (const b of sub.blocks || []) {
          out[b.label] = b;
        }
      }
    }
  }
  return out;
}

function renderListItems(items, hint, label, indent) {
  if (!Array.isArray(items)) return "";
  // Items are indented one level deeper than the wrapper.
  const itemIndent = indent + "  ";
  const sep = "\n" + itemIndent;
  const wrap = (parts) => `\n${itemIndent}${parts.join(sep)}\n${indent}`;
  switch (hint) {
    case "select-option": {
      // First item is the empty-value placeholder; subsequent items are bare
      // <option>Text</option> so the form value defaults to the option text.
      const lines = [];
      items.forEach((item, i) => {
        if (i === 0) lines.push(`<option value="">${item}</option>`);
        else lines.push(`<option>${item}</option>`);
      });
      return wrap(lines);
    }
    case "datalist-option":
      return wrap(items.map((item) => `<option value="${escapeForAttr(item)}"></option>`));
    case "ol-li":
    case "ul-li":
    default:
      return wrap(items.map((item) => `<li>${item}</li>`));
  }
}

function main() {
  const template = fs.readFileSync(TEMPLATE, "utf8");
  const content = JSON.parse(fs.readFileSync(CONTENT, "utf8"));
  const manifest = fs.existsSync(MANIFEST)
    ? JSON.parse(fs.readFileSync(MANIFEST, "utf8"))
    : {};

  const blocks = flatten(content);

  const warnings = [];
  const stats = { replaced: 0, missing: 0, unknown: 0, lists: 0, texts: 0 };

  // Match every placeholder. Also capture the leading whitespace on the
  // same line so list items can be aligned to that indent. For inline
  // placeholders (no whitespace right before), indent is empty.
  const PLACEHOLDER_RE = /\{\{([A-Za-z0-9_]+)\}\}/g;
  const output = template.replace(PLACEHOLDER_RE, (full, label, offset, src) => {
    const block = blocks[label];
    if (!block) {
      warnings.push(`placeholder {{${label}}} has no matching block in content.json — leaving as-is`);
      stats.missing += 1;
      return full;
    }
    // Determine the indent of the line that contains the placeholder.
    const lineStart = src.lastIndexOf("\n", offset - 1) + 1;
    const lineWs = src.slice(lineStart).match(/^[ \t]*/)[0];
    // Used only for list rendering — items get itemIndent = lineWs + "  ".
    const indent = lineWs;
    stats.replaced += 1;
    if (block.kind === "list") {
      stats.lists += 1;
      const hint = manifest[label];
      return renderListItems(block.value, hint, label, indent);
    }
    if (block.kind === "text") {
      stats.texts += 1;
      const v = block.value;
      if (typeof v !== "string") {
        warnings.push(`block ${label} kind=text but value is not a string — coercing`);
        return String(v ?? "");
      }
      return v;
    }
    stats.unknown += 1;
    warnings.push(`block ${label} has unknown kind=${block.kind} — coerced to string`);
    return String(block.value ?? "");
  });

  // Fresh public/ each build so removed assets don't linger.
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  fs.writeFileSync(OUTPUT, output, "utf8");
  // Keep a root copy for local preview and readable git diffs.
  fs.writeFileSync(ROOT_OUTPUT, output, "utf8");

  let copied = 0;
  for (const asset of STATIC_ASSETS) {
    const src = path.join(ROOT, asset);
    if (!fs.existsSync(src)) continue;
    copyRecursive(src, path.join(DIST, asset));
    copied += 1;
  }

  console.log(`[build] Wrote public/index.html + index.html`);
  console.log(`[build] Copied ${copied} static asset entries into public/`);

  // ---------------------------------------------------------------------------
  // Build Output API (.vercel/output) — gives us full control so the static site
  // AND the api/contact Serverless Function both deploy reliably, regardless of
  // framework auto-detection. Deploy with: vercel deploy --prebuilt [--prod].
  // ---------------------------------------------------------------------------
  buildVercelOutput(output);

  console.log(`[build] Replaced ${stats.replaced} placeholders (${stats.texts} text, ${stats.lists} list)`);
  if (stats.missing) console.log(`[build] Missing in content.json: ${stats.missing}`);
  if (stats.unknown) console.log(`[build] Unknown kind: ${stats.unknown}`);
  if (warnings.length) {
    console.log(`[build] ${warnings.length} warning(s):`);
    for (const w of warnings.slice(0, 20)) console.log(`  - ${w}`);
    if (warnings.length > 20) console.log(`  ... and ${warnings.length - 20} more`);
  }
}

function buildVercelOutput(indexHtml) {
  const OUT = path.join(ROOT, ".vercel", "output");
  const STATIC = path.join(OUT, "static");
  const FUNC = path.join(OUT, "functions", "api", "contact.func");

  // Clean only the output subdir, NOT .vercel/project.json.
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(STATIC, { recursive: true });
  fs.mkdirSync(FUNC, { recursive: true });

  // Static files
  fs.writeFileSync(path.join(STATIC, "index.html"), indexHtml, "utf8");
  for (const asset of STATIC_ASSETS) {
    const src = path.join(ROOT, asset);
    if (!fs.existsSync(src)) continue;
    copyRecursive(src, path.join(STATIC, asset));
  }

  // Serverless function: copy handler source + a .vc-config.json describing it.
  fs.copyFileSync(path.join(ROOT, "api", "contact.js"), path.join(FUNC, "contact.js"));
  fs.writeFileSync(
    path.join(FUNC, ".vc-config.json"),
    JSON.stringify(
      {
        runtime: "nodejs22.x",
        handler: "contact.js",
        launcherType: "Nodejs",
        shouldAddHelpers: true,
        maxDuration: 10,
      },
      null,
      2
    ),
    "utf8"
  );

  // config.json: version 3, plus headers/redirects mirrored from vercel.json.
  const vercelJson = JSON.parse(
    fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8")
  );
  const routes = [];
  // Redirects first.
  for (const r of vercelJson.redirects || []) {
    const route = {
      src: globToRegex(r.source),
      headers: { Location: r.destination },
      status: r.permanent === false ? 307 : 308,
    };
    routes.push(route);
  }
  // Header rules (continue:true so they layer onto later handling).
  for (const h of vercelJson.headers || []) {
    const headers = {};
    for (const kv of h.headers || []) headers[kv.key] = kv.value;
    routes.push({ src: globToRegex(h.source), headers, continue: true });
  }
  // Filesystem handling, then api function, then SPA-ish fallback to index.
  routes.push({ handle: "filesystem" });
  routes.push({ src: "^/api/contact/?$", dest: "/api/contact" });

  const config = { version: 3, routes };
  fs.writeFileSync(path.join(OUT, "config.json"), JSON.stringify(config, null, 2), "utf8");

  console.log(`[build] Wrote .vercel/output (static + api/contact.func + config.json)`);
}

// Vercel source (path-to-regexp-ish, sometimes already regex) -> anchored regex
// for Build Output API routes. Tokenises the constructs we use so they survive
// literal escaping, then restores them:
//   (.*)            capture-all group (already regex)            -> (.*)
//   (a|b|c)         alternation group (already regex)            -> (a|b|c)
//   \.              an escaped dot in the source                 -> \.
//   :param*         path-to-regexp catch-all                     -> (?:.*)
//   :param          path-to-regexp single segment               -> [^/]+
//   *               bare wildcard                                -> .*
function globToRegex(src) {
  const tokens = [];
  const stash = (val) => { tokens.push(val); return ` ${tokens.length - 1} `; };
  let s = src;
  s = s.replace(/\(\.\*\)/g, () => stash("(.*)"));
  s = s.replace(/\([^)]*\|[^)]*\)/g, (m) => stash(m)); // alternation group, keep verbatim
  s = s.replace(/\\\./g, () => stash("\\.")); // already-escaped dot
  s = s.replace(/:[A-Za-z0-9_]+\*/g, () => stash("(?:.*)"));
  s = s.replace(/:[A-Za-z0-9_]+/g, () => stash("[^/]+"));
  s = s.replace(/\*/g, () => stash(".*"));
  // Escape everything else literally.
  s = s.replace(/[.\\+^${}()|[\]?]/g, (m) => "\\" + m);
  // Restore tokens.
  s = s.replace(/ (\d+) /g, (_, i) => tokens[Number(i)]);
  return "^" + s + "$";
}

main();

// deploy-pipeline verification: git-triggered build test 5b428f4
