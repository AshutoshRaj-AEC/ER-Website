// Reusable messages for the admin review. They fill the "Message to artist"
// box, which the admin can edit before saving. {artist} and {title} are
// replaced with the submission's details.

export const REVIEW_TEMPLATES = [
  {
    key: "changes_artwork",
    label: "Artwork needs fixing",
    status: "changes_requested",
    message:
      "Hi {artist}, the cover for “{title}” needs a fix before we can send it out: please make sure it's a square 3000×3000 image with no website links, social handles or blurry text. Upload the new cover and resubmit.",
  },
  {
    key: "changes_audio",
    label: "Audio needs a new export",
    status: "changes_requested",
    message:
      "Hi {artist}, the master for “{title}” needs a new export: please send an uncompressed WAV at 44.1 kHz, 16-bit or higher, without silence at the start or clipping. Replace the audio and resubmit.",
  },
  {
    key: "changes_metadata",
    label: "Details need correcting",
    status: "changes_requested",
    message:
      "Hi {artist}, a few details for “{title}” need correcting before approval: please check the title formatting (no “Official Audio”, featured artists in their own field) and the songwriter credits, then resubmit.",
  },
  {
    key: "changes_date",
    label: "Release date too soon",
    status: "changes_requested",
    message:
      "Hi {artist}, we'd love to release “{title}”, but the date is too close to deliver and pitch it properly. Please pick a date at least three weeks out and resubmit.",
  },
  {
    key: "approved",
    label: "Approved",
    status: "approved",
    message:
      "Congratulations {artist}! “{title}” is approved. We'll send it to our distributor and let you know when it's on its way. Start planning your campaign in the dashboard.",
  },
  {
    key: "sent",
    label: "Sent to distributor",
    status: "sent_to_distributor",
    message:
      "“{title}” is with the distributor now. Once it's live in Spotify for Artists, pitch it to editorial and share your pre-save link everywhere.",
  },
  {
    key: "rejected",
    label: "Not a fit right now",
    status: "rejected",
    message:
      "Thank you for sending “{title}”, {artist}. It isn't the right fit for the label right now, but we'd genuinely like to hear your next track.",
  },
];

export const fillTemplate = (template, submission) =>
  template.message
    .replace(/\{artist\}/g, submission.artist_name)
    .replace(/\{title\}/g, submission.track_title);
