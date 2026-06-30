/* routes.js — single source of truth for real-URL routing.
 *
 * Shared by build.js (Node, static prerender) and app.js (browser, client nav).
 * Exposes the canonical mapping between:
 *   - a real URL path        e.g. "/conditions/thalassemia"
 *   - the legacy hash token   e.g. "thalassemia"
 *   - the SPA "pageId"        e.g. "conditions" (the .page element shown)
 *   - per-route SEO meta      (title / description / canonical / h1)
 *
 * Loaded in the browser as a plain <script> that sets window.BRU_ROUTES, and
 * in Node via require() (it detects module.exports).
 */
(function (root, factory) {
  var data = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = data;
  else root.BRU_ROUTES = data;
})(typeof self !== "undefined" ? self : this, function () {
  var BASE = "https://bloodsrus.com";
  var BRAND_SUFFIX = "Bloods R Us — Centre of Excellence for Blood Disorders, New Delhi";

  // ---- Conditions: hash token -> { name, path slug, title, description } ----
  // The slug matches the existing hash token so redirects/links stay simple.
  var CONDITIONS = [
    { hash: "thalassemia",              name: "Thalassemia" },
    { hash: "sickle-cell",              name: "Sickle Cell Anemia" },
    { hash: "aplastic-anemia",          name: "Aplastic Anemia" },
    { hash: "all-leukemia",             name: "Acute Lymphoblastic Leukemia (ALL)" },
    { hash: "aml-leukemia",             name: "Acute Myeloid Leukemia (AML)" },
    { hash: "cml-leukemia",             name: "Chronic Myeloid Leukemia (CML)" },
    { hash: "hodgkins-lymphoma",        name: "Hodgkin's Lymphoma" },
    { hash: "nhl-lymphoma",             name: "Non-Hodgkin's Lymphoma" },
    { hash: "mds",                      name: "Myelodysplastic Syndromes (MDS)" },
    { hash: "myeloma",                  name: "Multiple Myeloma" },
    { hash: "autoimmune",               name: "Autoimmune Diseases" },
    { hash: "primary-immunodeficiency", name: "Primary Immunodeficiency" },
    { hash: "inherited-metabolic",      name: "Inherited Metabolic Disorders" },
    { hash: "bone-marrow-failure",      name: "Bone Marrow Failure" }
  ];

  // ---- Top-level routes: path -> { hash, pageId, title, description, h1? } ----
  // pageId is the id suffix of the .page element (page-<pageId>) that must be
  // shown. hash is the legacy in-page anchor token. h1 (optional) is used only
  // for prerender H1 promotion when the page H1 is generic.
  var TOP = [
    {
      path: "/", hash: "", pageId: "home",
      title: "BMT & Blood Cancer Centre of Excellence | " + BRAND_SUFFIX,
      description: "Bloods R Us is a New Delhi centre of excellence for bone marrow transplantation, blood cancers and inherited blood disorders, led by Dr. Suparno Chakrabarti."
    },
    {
      path: "/about", hash: "about", pageId: "about",
      title: "About Dr. Suparno Chakrabarti & Our BMT Team | " + BRAND_SUFFIX,
      description: "Meet the Bloods R Us team led by Dr. Suparno Chakrabarti — pioneers of haploidentical bone marrow transplantation, with credentials from PGIMER, Birmingham and the Royal College of Pathologists."
    },
    {
      path: "/foundation", hash: "mcf", pageId: "mcf",
      title: "Manashi Chakrabarti Foundation | " + BRAND_SUFFIX,
      description: "The Manashi Chakrabarti Foundation supports research and patient care in bone marrow transplantation and blood disorders at Bloods R Us, New Delhi."
    },
    {
      path: "/conditions", hash: "conditions", pageId: "conditions",
      title: "Blood Disorders & Cancers We Treat | " + BRAND_SUFFIX,
      description: "Thalassemia, sickle cell, leukemias, lymphomas, MDS, myeloma, aplastic anemia and more — explore the blood disorders and cancers treated with BMT at Bloods R Us, New Delhi."
    },
    {
      path: "/bmt", hash: "bmt", pageId: "bmt",
      title: "Bone Marrow Transplant (BMT) Knowledge Centre | " + BRAND_SUFFIX,
      description: "Understand bone marrow transplantation — types of BMT, the transplant process, conditioning, donor matching and recovery — explained by the BMT specialists at Bloods R Us, New Delhi."
    },
    {
      path: "/therapies/car-t", hash: "car-t", pageId: "car-t",
      title: "CAR-T Cell Therapy for Blood Cancers | " + BRAND_SUFFIX,
      description: "CAR-T cell therapy at Bloods R Us, New Delhi — engineered immune cells to treat relapsed and refractory leukemias, lymphomas and myeloma."
    },
    {
      path: "/therapies/cellular-therapy", hash: "cellular-therapy", pageId: "cellular-therapy",
      title: "Novel Cellular Therapy | " + BRAND_SUFFIX,
      description: "Advanced cellular therapies at Bloods R Us, New Delhi — NK cell and immune-cell based treatments for blood cancers and post-transplant care."
    },
    {
      path: "/therapies/gene-therapy", hash: "gene-therapy", pageId: "gene-therapy",
      title: "Gene Therapy for Blood Disorders | " + BRAND_SUFFIX,
      description: "Gene therapy for inherited blood disorders such as thalassemia and sickle cell disease, explained by the specialists at Bloods R Us, New Delhi."
    },
    {
      path: "/therapies/haploidentical-bmt", hash: "haploidentical-bmt", pageId: "haploidentical-bmt",
      title: "Haploidentical BMT (Abatacept & PTCy) | " + BRAND_SUFFIX,
      description: "Pioneering half-matched (haploidentical) bone marrow transplantation using Abatacept and PTCy at Bloods R Us, New Delhi — making a donor available for almost every patient."
    },
    {
      path: "/therapies/autologous-bmt", hash: "autologous-bmt", pageId: "autologous-bmt",
      title: "Novel Autologous BMT (IBAHCT) | " + BRAND_SUFFIX,
      description: "Immune-based autologous haematopoietic cell transplantation (IBAHCT) at Bloods R Us, New Delhi — a novel approach to autologous bone marrow transplantation."
    },
    {
      path: "/therapies/immune-system", hash: "immune-system", pageId: "immune-system",
      title: "The Immune System & Cancer | " + BRAND_SUFFIX,
      description: "How the immune system fights cancer — the science behind immunotherapy and cellular therapy, explained by Bloods R Us, New Delhi."
    },
    {
      path: "/for-patients", hash: "resources", pageId: "resources",
      title: "For Patients — Guides & Resources | " + BRAND_SUFFIX,
      description: "Patient and family resources for bone marrow transplantation at Bloods R Us, New Delhi — preparing for BMT, life in the transplant unit and recovery."
    },
    {
      path: "/for-doctors", hash: "physicians", pageId: "physicians",
      title: "For Doctors — Referrals & Our Physicians | " + BRAND_SUFFIX,
      description: "Referral information and physician profiles at Bloods R Us, New Delhi — partner with our bone marrow transplant and haemato-oncology team."
    },
    {
      path: "/contact", hash: "contact", pageId: "contact",
      title: "Contact & Book an Appointment | " + BRAND_SUFFIX,
      description: "Contact Bloods R Us, New Delhi to book an appointment or second opinion with our bone marrow transplant and blood disorder specialists."
    }
  ];

  // Build condition routes from CONDITIONS.
  var CONDITION_ROUTES = CONDITIONS.map(function (c) {
    return {
      path: "/conditions/" + c.hash,
      hash: c.hash,
      pageId: "conditions",
      condition: c.hash,
      h1: c.name,
      title: c.name + " — Causes, Symptoms & BMT Treatment | " + BRAND_SUFFIX,
      description:
        c.name +
        " — learn the causes, symptoms and how bone marrow transplantation is used to treat it, from the BMT specialists at Bloods R Us, New Delhi."
    };
  });

  var ALL = TOP.concat(CONDITION_ROUTES);

  // Lookup maps.
  var byPath = Object.create(null);
  var byHash = Object.create(null);
  ALL.forEach(function (r) {
    r.canonical = BASE + (r.path === "/" ? "/" : r.path);
    byPath[r.path] = r;
    // First route to claim a hash wins (top-level over condition where they
    // differ; conditions own their own unique hashes anyway).
    if (!(r.hash in byHash)) byHash[r.hash] = r;
  });

  return {
    BASE: BASE,
    routes: ALL,
    conditions: CONDITIONS,
    byPath: byPath,
    byHash: byHash
  };
});
