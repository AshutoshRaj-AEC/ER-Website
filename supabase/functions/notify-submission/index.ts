import { createClient } from "npm:@supabase/supabase-js@2";

// Called by the submissions_notify_new database trigger. It is safe to leave
// public: it only emails about a real submission that has not been emailed
// yet, and it returns nothing about the submission to the caller.

const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") ?? "eklautarecords@gmail.com";
const FROM_EMAIL =
  Deno.env.get("FROM_EMAIL") ?? "EklautA Records <onboarding@resend.dev>";
const REVIEW_URL = "https://eklautarecords.netlify.app/admin";
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

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let submissionId: unknown;
  try {
    ({ submission_id: submissionId } = await req.json());
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (typeof submissionId !== "string" || !UUID_PATTERN.test(submissionId)) {
    return new Response("Invalid submission_id", { status: 400 });
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    console.error("RESEND_API_KEY is not set; skipping email.");
    return new Response("Email is not configured", { status: 500 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Claim the submission so each one is emailed at most once.
  const { data: submission, error } = await supabase
    .from("submissions")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", submissionId)
    .is("notified_at", null)
    .select(
      "artist_name, track_title, genre, release_date, contact_email, explicit, created_at",
    )
    .maybeSingle();

  if (error) {
    console.error("Failed to claim submission", error);
    return new Response("Database error", { status: 500 });
  }

  if (!submission) {
    return new Response("Nothing to send", { status: 200 });
  }

  const rows = [
    ["Artist", submission.artist_name],
    ["Track", submission.track_title],
    ["Genre", submission.genre],
    ["Preferred release date", submission.release_date ?? "Not set"],
    ["Explicit", submission.explicit ? "Yes" : "No"],
    ["Contact", submission.contact_email],
  ]
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 16px 4px 0;color:#78716c">${escapeHtml(label)}</td><td style="padding:4px 0">${escapeHtml(value)}</td></tr>`,
    )
    .join("");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [ADMIN_EMAIL],
      reply_to: submission.contact_email,
      subject: `New submission: ${submission.track_title} by ${submission.artist_name}`,
      html: `
        <div style="font-family:Arial,sans-serif;font-size:14px;color:#1c1917">
          <h2 style="margin:0 0 16px">New music submission</h2>
          <table style="border-collapse:collapse">${rows}</table>
          <p style="margin:24px 0">
            <a href="${REVIEW_URL}" style="background:#f97316;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:bold">Review submission</a>
          </p>
          <p style="color:#78716c">Reply to this email to contact the artist.</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    console.error("Resend error", response.status, await response.text());
    // Release the claim so the email can be retried.
    await supabase
      .from("submissions")
      .update({ notified_at: null })
      .eq("id", submissionId);
    return new Response("Failed to send email", { status: 502 });
  }

  return new Response("Sent", { status: 200 });
});
