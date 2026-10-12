import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";

// Called by the submissions_notify_artist trigger when the label changes a
// submission's status. Safe to leave public: it only emails about a real
// status change that hasn't been emailed yet, and returns nothing about it.

const GMAIL_USER = Deno.env.get("GMAIL_USER") ?? "eklautarecords@gmail.com";
const SITE_URL = "https://eklautarecords.netlify.app";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]!);

type Submission = {
  artist_name: string;
  track_title: string;
  contact_email: string;
  artist_message: string | null;
};

const TEMPLATES: Record<
  string,
  (s: Submission) => { subject: string; heading: string; paragraphs: string[]; cta: { label: string; href: string } }
> = {
  approved: (s) => ({
    subject: `Approved: “${s.track_title}”`,
    heading: "Your release has been approved",
    paragraphs: [
      `Great news, ${s.artist_name}. EklautA Records has approved “${s.track_title}”.`,
      "Next, we'll send it to our distributor. We'll email you again as soon as it's on its way to the stores.",
    ],
    cta: { label: "Plan your release", href: `${SITE_URL}/dashboard` },
  }),
  sent_to_distributor: (s) => ({
    subject: `Sent to distribution: “${s.track_title}”`,
    heading: "Your release is on its way to the stores",
    paragraphs: [
      `“${s.track_title}” has been sent to distribution. Stores usually take a few days to a couple of weeks to publish a new release.`,
      "Use this time to pitch the track to Spotify editorial in Spotify for Artists, share your pre-save link and line up your release content.",
    ],
    cta: { label: "Open your release checklist", href: `${SITE_URL}/dashboard` },
  }),
  rejected: (s) => ({
    subject: `An update on “${s.track_title}”`,
    heading: "An update on your submission",
    paragraphs: [
      `Thank you for sending “${s.track_title}” to EklautA Records, ${s.artist_name}.`,
      "After listening, we're not able to take this release forward right now. That's not the end of the road: you're welcome to submit new music any time.",
    ],
    cta: { label: "Submit another track", href: `${SITE_URL}/submit` },
  }),
};

const renderEmail = (template: ReturnType<(typeof TEMPLATES)[string]>, message: string | null) => {
  const messageHtml = message
    ? `<div style="margin:24px 0;padding:16px 20px;border-left:3px solid #f97316;background:#fff7ed">
         <p style="margin:0 0 8px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#9a3412">A note from the label</p>
         <p style="margin:0;white-space:pre-wrap">${escapeHtml(message)}</p>
       </div>`
    : "";

  const html = `
    <div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1c1917;max-width:560px">
      <p style="margin:0 0 4px;font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#f97316">EklautA Records</p>
      <h2 style="margin:0 0 16px">${escapeHtml(template.heading)}</h2>
      ${template.paragraphs.map((p) => `<p style="margin:0 0 12px">${escapeHtml(p)}</p>`).join("")}
      ${messageHtml}
      <p style="margin:24px 0">
        <a href="${template.cta.href}" style="background:#f97316;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:bold">${escapeHtml(template.cta.label)}</a>
      </p>
      <p style="color:#78716c;font-size:13px">Reply to this email to reach the label. You're getting this because you submitted music at eklautarecords.netlify.app.</p>
    </div>
  `;

  const text = [
    template.heading,
    "",
    ...template.paragraphs,
    ...(message ? ["", "A note from the label:", message] : []),
    "",
    `${template.cta.label}: ${template.cta.href}`,
    "",
    "Reply to this email to reach the label.",
  ].join("\n");

  return { html, text };
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let submissionId: unknown;
  let status: unknown;
  try {
    ({ submission_id: submissionId, status } = await req.json());
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (typeof submissionId !== "string" || !UUID_PATTERN.test(submissionId)) {
    return new Response("Invalid submission_id", { status: 400 });
  }
  if (typeof status !== "string" || !TEMPLATES[status]) {
    return new Response("Nothing to send for this status", { status: 200 });
  }

  const appPassword = Deno.env.get("GMAIL_APP_PASSWORD")?.replace(/\s+/g, "");
  if (!appPassword) {
    console.error("GMAIL_APP_PASSWORD is not set; skipping artist email.");
    return new Response("Email is not configured", { status: 500 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Claim this status change so it's emailed at most once, and only if the
  // submission still has that status.
  const { data: submission, error } = await supabase
    .from("submissions")
    .update({ artist_notified_status: status, artist_notified_at: new Date().toISOString() })
    .eq("id", submissionId)
    .eq("status", status)
    .or(`artist_notified_status.is.null,artist_notified_status.neq.${status}`)
    .select("artist_name, track_title, contact_email, artist_message")
    .maybeSingle();

  if (error) {
    console.error("Failed to claim submission", error);
    return new Response("Database error", { status: 500 });
  }

  if (!submission) {
    return new Response("Nothing to send", { status: 200 });
  }

  const template = TEMPLATES[status](submission);
  const { html, text } = renderEmail(template, submission.artist_message);

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: GMAIL_USER, pass: appPassword },
    });

    await transporter.sendMail({
      from: `"EklautA Records" <${GMAIL_USER}>`,
      to: submission.contact_email,
      replyTo: GMAIL_USER,
      subject: template.subject,
      text,
      html,
    });
  } catch (sendError) {
    console.error("Gmail send failed", sendError);
    // Release the claim so this status change can be emailed again.
    await supabase
      .from("submissions")
      .update({ artist_notified_status: null, artist_notified_at: null })
      .eq("id", submissionId);
    return new Response("Failed to send email", { status: 502 });
  }

  return new Response("Sent", { status: 200 });
});
