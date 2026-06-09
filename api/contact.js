// api/contact.js — Vercel serverless function (Node runtime).
//
// Accepts a POST from the Bloods R Us contact form and forwards it as an email
// via the Resend REST API. No npm dependency: uses the global fetch available
// on the Vercel Node 18+ runtime.
//
// Required env var (set in the Vercel "bloods-r-us" project):
//   RESEND_API_KEY  — Resend API key. If absent, the function returns 503 so the
//                     frontend can fall back to WhatsApp / phone / email.
//
// Recipient is fixed: bloodsrus@actioncancerhospital.com

const TO_EMAIL = "bloodsrus@actioncancerhospital.com";
// Resend requires a verified sender domain. Until bloodsrus.com is verified in
// Resend, their shared onboarding sender works for delivery.
const FROM_EMAIL = "Bloods R Us Website <onboarding@resend.dev>";

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function readBody(req) {
  // Vercel may pre-parse JSON/urlencoded into req.body. Fall back to raw stream.
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.length) {
    try {
      return JSON.parse(req.body);
    } catch {
      return Object.fromEntries(new URLSearchParams(req.body));
    }
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  const ct = (req.headers["content-type"] || "").toLowerCase();
  if (ct.includes("application/json")) {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return Object.fromEntries(new URLSearchParams(raw));
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    res.status(503).json({
      ok: false,
      error:
        "Email service is not configured yet. Please reach us directly via WhatsApp, phone, or email.",
    });
    return;
  }

  let body;
  try {
    body = await readBody(req);
  } catch {
    res.status(400).json({ ok: false, error: "Could not read submission." });
    return;
  }

  const name = (body.name || "").toString().trim();
  const email = (body.email || "").toString().trim();
  const phone = (body.phone || "").toString().trim();
  const topic = (body.topic || "").toString().trim();
  const doctor = (body.doctor || "").toString().trim();
  const message = (body.message || "").toString().trim();

  if (!name) {
    res.status(400).json({ ok: false, error: "Name is required." });
    return;
  }

  const rows = [
    ["Name", name],
    ["Email", email || "—"],
    ["Phone", phone || "—"],
    ["Enquiry for", topic || "—"],
    ["Preferred doctor", doctor || "—"],
    ["Message", message || "—"],
  ];

  const html =
    `<h2 style="font-family:Arial,sans-serif;">New enquiry from bloodsrus.com</h2>` +
    `<table style="font-family:Arial,sans-serif;border-collapse:collapse;">` +
    rows
      .map(
        ([k, v]) =>
          `<tr><td style="padding:6px 12px;font-weight:bold;vertical-align:top;border-bottom:1px solid #eee;">${escapeHtml(
            k
          )}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;">${escapeHtml(
            v
          ).replace(/\n/g, "<br>")}</td></tr>`
      )
      .join("") +
    `</table>`;

  const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n");

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [TO_EMAIL],
        reply_to: email || undefined,
        subject: `Website enquiry — ${name}${topic ? ` (${topic})` : ""}`,
        html,
        text,
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      res.status(502).json({
        ok: false,
        error: "Email could not be sent. Please reach us directly.",
        detail: detail.slice(0, 300),
      });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(502).json({
      ok: false,
      error: "Email could not be sent. Please reach us directly.",
    });
  }
};
