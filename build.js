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
const { routes: ROUTE_TABLE, BASE: SITE_BASE } = require("./routes.js");
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
  "routes.js",
  "style.css",
  "redesign.css",
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

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ---------------------------------------------------------------------------
// Per-route static prerender.
//
// Given the fully-rendered single-shell HTML (placeholders already replaced),
// produce a route-specific HTML document where:
//   - the correct .page / condition section is pre-activated (so crawlers and
//     no-JS visitors see the right content), and
//   - <title>, <meta name=description>, canonical, og:url/title/description and
//     twitter:title/description are unique to that route, and
//   - for condition routes, the condition's H2 is promoted to the single H1
//     and the generic Conditions H1 is demoted to a <p>.
// All transforms are conservative string ops anchored on stable markers in the
// template; if a marker is absent the transform is skipped (build never throws).
// ---------------------------------------------------------------------------
function setMetaForRoute(html, route) {
  const title = escapeHtml(route.title);
  const desc = escapeForAttr(route.description);
  const canonical = route.canonical;

  // <title>…</title>
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);

  // <meta name="description" content="…">
  html = html.replace(
    /(<meta\s+name="description"\s+content=")[\s\S]*?("\s*>)/,
    `$1${desc}$2`
  );

  // <link rel="canonical" href="…">
  html = html.replace(
    /(<link\s+rel="canonical"\s+href=")[^"]*("\s*>)/,
    `$1${canonical}$2`
  );

  // og:url / og:title / og:description
  html = html.replace(
    /(<meta\s+property="og:url"\s+content=")[^"]*("\s*>)/,
    `$1${canonical}$2`
  );
  html = html.replace(
    /(<meta\s+property="og:title"\s+content=")[\s\S]*?("\s*>)/,
    `$1${title}$2`
  );
  html = html.replace(
    /(<meta\s+property="og:description"\s+content=")[\s\S]*?("\s*>)/,
    `$1${desc}$2`
  );
  // twitter:title / twitter:description
  html = html.replace(
    /(<meta\s+name="twitter:title"\s+content=")[\s\S]*?("\s*>)/,
    `$1${title}$2`
  );
  html = html.replace(
    /(<meta\s+name="twitter:description"\s+content=")[\s\S]*?("\s*>)/,
    `$1${desc}$2`
  );
  return html;
}

// Activate a top-level .page element (and deactivate the home page which ships
// with class "page active" / inline display).
function activatePage(html, pageId) {
  // 1) Strip the default-active state off the home page.
  html = html.replace(
    /<section id="page-home" class="page active">/,
    '<section id="page-home" class="page" style="display:none;">'
  );
  if (pageId === "home") {
    // Re-activate home explicitly.
    return html.replace(
      /<section id="page-home" class="page" style="display:none;">/,
      '<section id="page-home" class="page active">'
    );
  }
  // 2) Activate the target page. Pages are either <section id="page-X" ...>
  //    or <div id="page-X" class="page">.
  const open = new RegExp(
    `<(section|div) id="page-${pageId}" class="page"(>| style="[^"]*">)`
  );
  return html.replace(open, (m, tag) => {
    return `<${tag} id="page-${pageId}" class="page active" style="display:block;">`;
  });
}

// For the conditions hub route: show the hub, hide the detail container.
function activateConditionsHub(html) {
  html = html.replace(
    /<div id="conditions-hub" class="section" style="display:none;">/,
    '<div id="conditions-hub" class="section" style="display:block;">'
  );
  html = html.replace(
    /<section id="condition-detail" class="section">/,
    '<section id="condition-detail" class="section" style="display:none;">'
  );
  return html;
}

// For a specific condition route: show the detail container + that condition
// block, hide the hub, promote the condition name to H1, demote the generic H1.
function activateCondition(html, route) {
  // Hide the hub.
  html = html.replace(
    /<div id="conditions-hub" class="section" style="display:none;">/,
    '<div id="conditions-hub" class="section" style="display:none;" data-hub>'
  );
  // Reveal the matching condition block (default markup is display:none).
  const condOpen = new RegExp(
    `<div data-condition="${route.condition}" style="display:none;">`
  );
  html = html.replace(
    condOpen,
    `<div data-condition="${route.condition}" style="display:block;">`
  );
  // Demote the generic Conditions H1 to a paragraph so the page has exactly
  // one H1 (the condition name, injected below).
  html = html.replace(
    /<h1 class="page-hero__title" id="condition-page-title">([\s\S]*?)<\/h1>/,
    '<p class="page-hero__title" id="condition-page-title">$1</p>'
  );
  // Promote the condition name to the single H1 by injecting it at the top of
  // the now-visible condition block, right after its opening tag.
  const condBlockOpen = `<div data-condition="${route.condition}" style="display:block;">`;
  const h1 = `<h1 class="page-hero__title" style="margin-bottom:var(--space-6);">${escapeHtml(
    route.h1
  )}</h1>`;
  html = html.replace(condBlockOpen, condBlockOpen + "\n  " + h1);
  return html;
}

// A small inline marker so app.js knows the server already activated a section
// for direct loads (lets it skip an unnecessary re-render flash).
function injectRouteState(html, route) {
  const tag = `<script>window.__BRU_INITIAL_PATH=${JSON.stringify(
    route.path
  )};</script>`;
  // Place just before the routes.js / app.js scripts are loaded.
  const m = html.match(/<script src="\.\/routes\.js[^"]*"><\/script>/);
  if (m) return html.replace(m[0], tag + "\n" + m[0]);
  const a = html.match(/<script src="\.\/app\.js[^"]*"><\/script>/);
  if (a) return html.replace(a[0], tag + "\n" + a[0]);
  // Fallback: before </body>.
  return html.replace(/<\/body>/, tag + "\n</body>");
}

// Rewrite relative "./asset" references to root-absolute "/asset" so they
// resolve identically from nested routes like /conditions/thalassemia (where
// "./app.js" would otherwise resolve to /conditions/app.js → 404).
function absolutiseAssets(html) {
  return html
    .replace(/(\bsrc=")\.\//g, "$1/")
    .replace(/(\bhref=")\.\//g, "$1/");
}


// ---------------------------------------------------------------------------
// pruneToRoute — ship ONLY this route's content.
//
// The SPA markup holds every page in one document. Prerendering it verbatim
// meant all 29 URLs served an identical ~30,775-word document (a condition
// page was 2.4% about its own condition, and carried 14 <h1> tags). Google had
// nothing to tell the URLs apart. Here we drop every page section and every
// condition block that this route does not own; app.js falls back to a real
// navigation when a destination is not in the document.
// ---------------------------------------------------------------------------
function elementEnd(html, startIdx, tag) {
  const re = new RegExp("<" + tag + "\\b|</" + tag + ">", "gi");
  re.lastIndex = startIdx;
  let depth = 0, m;
  while ((m = re.exec(html))) {
    if (m[0][1] === "/") {
      depth--;
      if (depth === 0) return re.lastIndex;
    } else {
      depth++;
    }
  }
  return -1;
}

function removeMatches(html, openRe, tagOf, keepFn) {
  const hits = [];
  let m;
  openRe.lastIndex = 0;
  while ((m = openRe.exec(html))) {
    if (keepFn(m)) continue;
    const end = elementEnd(html, m.index, tagOf(m));
    if (end > m.index) hits.push([m.index, end]);
  }
  // Drop ranges nested inside an earlier range so slices never overlap.
  const flat = [];
  for (const h of hits) {
    if (flat.length && h[0] < flat[flat.length - 1][1]) continue;
    flat.push(h);
  }
  // Remove from the end so earlier indices stay valid.
  for (let i = flat.length - 1; i >= 0; i--) {
    html = html.slice(0, flat[i][0]) + html.slice(flat[i][1]);
  }
  return html;
}

function pruneToRoute(html, route) {
  const keepPage = route.condition ? "conditions" : route.pageId;

  // Page containers are a mix of <section> and <div>, so balance on the
  // captured tag rather than assuming one.
  html = removeMatches(
    html,
    /<(section|div)\s+id="page-([a-z0-9-]+)"[^>]*>/gi,
    (m) => m[1],
    (m) => m[2] === keepPage
  );

  html = removeMatches(
    html,
    /<div\s+data-condition="([a-z0-9-]+)"[^>]*>/gi,
    () => "div",
    (m) => Boolean(route.condition) && m[1] === route.condition
  );

  return html;
}


// ---------------------------------------------------------------------------
// injectAuthorSchema — per-page E-E-A-T attribution.
//
// For medical (YMYL) queries Google weights author credentials heavily, and
// this centre has an unusually strong claim: 144 peer-reviewed papers, 4,535
// citations, and the first description of the Abatacept + PTCy GvHD protocol.
// None of that was machine-readable per page. This emits one MedicalWebPage
// per route naming the authoring and reviewing physicians. It is structured
// data only — nothing visible on the page changes.
// ---------------------------------------------------------------------------
var BRU_ORG = {
  "@type": "MedicalOrganization",
  "@id": "https://bloodsrus.com/#organization",
  name: "Bloods R Us",
  url: "https://bloodsrus.com",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Action Cancer Hospital, A-4, Paschim Vihar",
    addressLocality: "New Delhi",
    postalCode: "110063",
    addressCountry: "IN"
  }
};

var DR_SUPARNO = {
  "@type": "Physician",
  "@id": "https://bloodsrus.com/about#dr-suparno-chakrabarti",
  name: "Dr. Suparno Chakrabarti",
  honorificSuffix: "MD, FRCPath",
  jobTitle: "Principal Director · Hematology, Bone Marrow Transplantation & Cellular Therapy",
  medicalSpecialty: ["Hematologic", "Oncologic"],
  url: "https://bloodsrus.com/about",
  worksFor: { "@id": "https://bloodsrus.com/#organization" },
  // ORCID intentionally omitted until Dr Suparno confirms it. Once confirmed,
  // restore:  sameAs: ["https://orcid.org/<id>"], identifier: {...}
  alumniOf: [
    { "@type": "EducationalOrganization", name: "Postgraduate Institute of Medical Education and Research (PGIMER), Chandigarh" },
    { "@type": "EducationalOrganization", name: "University of Birmingham, UK" }
  ],
  hasCredential: [
    { "@type": "EducationalOccupationalCredential", credentialCategory: "degree", name: "MD (Internal Medicine), PGIMER Chandigarh" },
    { "@type": "EducationalOccupationalCredential", credentialCategory: "degree", name: "Doctor of Medicine, University of Birmingham, UK" },
    { "@type": "EducationalOccupationalCredential", credentialCategory: "fellowship", name: "FRCPath (Haematology), Royal College of Pathologists, London" }
  ]
};

var DR_MAHAK = {
  "@type": "Physician",
  "@id": "https://bloodsrus.com/about#dr-mahak-agarwal",
  name: "Dr. Mahak Agarwal",
  honorificSuffix: "MBBS, MD",
  jobTitle: "Consultant, Hematology & Bone Marrow Transplantation · Clinical Coordinator, BMT & Cellular Therapy",
  medicalSpecialty: ["Hematologic", "Oncologic"],
  url: "https://bloodsrus.com/about",
  worksFor: { "@id": "https://bloodsrus.com/#organization" },
  hasCredential: [
    { "@type": "EducationalOccupationalCredential", credentialCategory: "fellowship", name: "Fellowship in Clinical Hematology & BMT" }
  ]
};

// Routes whose content is clinical and therefore carries author attribution.
var CLINICAL_PAGES = {
  bmt: true, conditions: true, "car-t": true, "cellular-therapy": true,
  "gene-therapy": true, "haploidentical-bmt": true, "autologous-bmt": true,
  "immune-system": true, resources: true, physicians: true
};

function injectAuthorSchema(html, route) {
  if (!CLINICAL_PAGES[route.pageId]) return html;

  var node = {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    "@id": "https://bloodsrus.com" + route.path + "#webpage",
    url: "https://bloodsrus.com" + route.path,
    name: route.title,
    description: route.description,
    inLanguage: "en-IN",
    isPartOf: { "@type": "WebSite", name: "Bloods R Us", url: "https://bloodsrus.com" },
    publisher: { "@id": "https://bloodsrus.com/#organization" },
    author: [DR_SUPARNO, DR_MAHAK],
    reviewedBy: DR_SUPARNO,
    lastReviewed: new Date().toISOString().slice(0, 10),
    medicalAudience: [{ "@type": "MedicalAudience", audienceType: "Patient" }],
    about: route.condition
      ? { "@type": "MedicalCondition", name: route.h1 }
      : { "@type": "MedicalProcedure", name: "Bone Marrow Transplantation" }
  };

  var payload =
    '<script type="application/ld+json">' +
    JSON.stringify([BRU_ORG, node]).replace(/</g, "\\u003c") +
    "</script>";

  return html.replace("</head>", payload + "\n</head>");
}

function renderRouteHtml(baseHtml, route) {
  let html = baseHtml;
  html = absolutiseAssets(html);
  html = setMetaForRoute(html, route);
  if (route.condition) {
    html = activatePage(html, "conditions");
    html = activateCondition(html, route);
  } else if (route.pageId === "conditions") {
    html = activatePage(html, "conditions");
    html = activateConditionsHub(html);
  } else {
    html = activatePage(html, route.pageId);
  }
  html = injectRouteState(html, route);
  html = pruneToRoute(html, route);
  html = injectAuthorSchema(html, route);
  return html;
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

  // The "/" route IS index.html (home page, pre-activated by default markup).
  const homeRoute = ROUTE_TABLE.find((r) => r.path === "/");
  const homeHtml = renderRouteHtml(output, homeRoute);
  fs.writeFileSync(OUTPUT, homeHtml, "utf8");
  // Keep a root copy for local preview and readable git diffs.
  fs.writeFileSync(ROOT_OUTPUT, homeHtml, "utf8");

  // Every other route → public/<path>/index.html (clean-URL directory form).
  let routePages = 0;
  for (const route of ROUTE_TABLE) {
    if (route.path === "/") continue;
    const routeHtml = renderRouteHtml(output, route);
    const dir = path.join(DIST, route.path.replace(/^\//, ""));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), routeHtml, "utf8");
    routePages += 1;
  }

  let copied = 0;
  for (const asset of STATIC_ASSETS) {
    const src = path.join(ROOT, asset);
    if (!fs.existsSync(src)) continue;
    copyRecursive(src, path.join(DIST, asset));
    copied += 1;
  }

  console.log(`[build] Wrote public/index.html + index.html (home)`);
  console.log(`[build] Wrote ${routePages} additional route pages into public/`);
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

  // Static files. indexHtml is the fully-rendered shell (placeholders done) —
  // we prerender each route from it so the Build Output API ships real URLs.
  const homeRoute = ROUTE_TABLE.find((r) => r.path === "/");
  fs.writeFileSync(
    path.join(STATIC, "index.html"),
    renderRouteHtml(indexHtml, homeRoute),
    "utf8"
  );
  for (const route of ROUTE_TABLE) {
    if (route.path === "/") continue;
    const dir = path.join(STATIC, route.path.replace(/^\//, ""));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "index.html"),
      renderRouteHtml(indexHtml, route),
      "utf8"
    );
  }
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
  // Clean-URL rewrites: map each real route path (with optional trailing slash)
  // to its prerendered <path>/index.html BEFORE the filesystem handler, so
  // /about and /conditions/thalassemia serve the right document. "/" is handled
  // natively by index.html.
  for (const route of ROUTE_TABLE) {
    if (route.path === "/") continue;
    const p = route.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    routes.push({ src: `^${p}/?$`, dest: `${route.path}/index.html` });
  }

  // Filesystem handling, then api function.
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

