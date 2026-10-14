// Release campaign templates. Deterministic: the same inputs always produce
// the same tasks, with no AI service involved. Generated tasks are a starting
// point; artists edit or delete them like any other task.
//
// These complement the fixed release checklist (pre-save, Spotify pitch,
// teasers, content plan), so they don't repeat those steps.

import { addDays } from "./insights/analytics.js";

export const CHANNELS = [
  { id: "instagram", label: "Instagram (Reels & Stories)" },
  { id: "youtube", label: "YouTube (Shorts & videos)" },
  { id: "whatsapp", label: "WhatsApp (Status & groups)" },
  { id: "outreach", label: "Playlists, pages & press" },
];

export const LANGUAGES = [
  { id: "en", label: "English" },
  { id: "hi", label: "Hindi" },
  { id: "hinglish", label: "Hinglish" },
];

export const BUDGET_LEVELS = [
  { id: "organic", label: "No paid promotion" },
  { id: "small", label: "Small budget (boost a few posts)" },
  { id: "larger", label: "Larger budget (creators + ads)" },
];

export const PHASES = {
  pre_release: "Before release",
  release_week: "Release week",
  release_day: "Release day",
  post_release: "After release",
};

// Suggest a budget level from the plan's planned advertising and PR costs.
export const suggestBudgetLevel = (promoBudget) =>
  !promoBudget ? "organic" : promoBudget < 5000 ? "small" : "larger";

export const genreFamily = (genre = "") => {
  const text = genre.toLowerCase();
  if (/(devotional|spiritual|bhakti|bhajan|aarti|mantra)/.test(text)) return "devotional";
  if (/(hip.?hop|rap|drill|trap)/.test(text)) return "hiphop";
  return "general";
};

// Caption starters, filled with {title} and {artist}.
const CAPTIONS = {
  announce: {
    en: "New music: “{title}” drops {date}. Pre-save the link in bio.",
    hi: "नया गाना “{title}” आ रहा है {date} को। लिंक बायो में है, अभी प्री-सेव करें।",
    hinglish: "Naya gaana “{title}” aa raha hai {date} ko! Link bio mein hai, abhi pre-save karo.",
  },
  teaser: {
    en: "This part hits different. “{title}” out {date}.",
    hi: "ये हिस्सा सबसे खास है। “{title}” {date} को आ रहा है।",
    hinglish: "Ye part sabse khaas hai. “{title}” aa raha hai {date} ko.",
  },
  release: {
    en: "“{title}” is out now on all platforms. Tell me your favourite line 👇",
    hi: "“{title}” अब सभी प्लेटफ़ॉर्म पर है। अपनी पसंदीदा लाइन कमेंट करें 👇",
    hinglish: "“{title}” ab sab platforms pe out hai! Apni favourite line comment karo 👇",
  },
  thanks: {
    en: "Thank you for the love on “{title}”. Every stream and share counts. More soon.",
    hi: "“{title}” को इतना प्यार देने के लिए शुक्रिया। हर स्ट्रीम और शेयर मायने रखता है।",
    hinglish: "“{title}” ko itna pyaar dene ke liye thank you! Har stream aur share count karta hai.",
  },
};

const GENRE_IDEAS = {
  hiphop: {
    teaser: "Use the hardest bars or the hook, with the lyrics on screen.",
    challenge: "Start a freestyle challenge on the beat: post the instrumental and repost the best entries.",
    bts: "Show the writing process: the notebook, the booth, the first take.",
  },
  devotional: {
    teaser: "Use the most peaceful or uplifting part, with calm visuals (diya, temple, sunrise).",
    challenge: "Invite followers to share the song in their morning or festival routine and repost their stories.",
    bts: "Share the story or meaning behind the song and why you made it.",
  },
  general: {
    teaser: "Use the catchiest 10–15 seconds, with lyrics or a strong visual on screen.",
    challenge: "Ask followers to make a Reel or Short with the song and repost the best ones.",
    bts: "Show how the song was made: studio moments, early demo vs final.",
  },
};

// offset: days from release (negative = before). channel: one of CHANNELS or
// "general" (always included). budgets: levels that include the task.
const TEMPLATES = [
  { key: "campaign_brief", phase: "pre_release", offset: -28, channel: "general", title: "Write a one-line message for this release", details: "What should people feel or remember? Use it in every caption and pitch." },
  { key: "shoot_clips", phase: "pre_release", offset: -21, channel: "general", title: "Shoot 4–6 vertical clips for the campaign", details: "Film once, post all month: performance shots, studio moments and a lyric-on-screen version." },
  { key: "ig_announce", phase: "pre_release", offset: -14, channel: "instagram", caption: "announce", title: "Announce the release date on Instagram", details: "Post the cover with the date, and add a countdown sticker to your Story." },
  { key: "ig_teaser_1", phase: "pre_release", offset: -9, channel: "instagram", caption: "teaser", genreIdea: "teaser", title: "Teaser Reel #1", details: "" },
  { key: "yt_short_teaser", phase: "pre_release", offset: -7, channel: "youtube", caption: "teaser", genreIdea: "teaser", title: "YouTube Short teaser", details: "Re-cut your best teaser for Shorts with the song title in the first second." },
  { key: "outreach_list", phase: "pre_release", offset: -10, channel: "outreach", title: "Make a list of 15 pages, curators or creators who fit your sound", details: "Note their contact or submission link. Personal messages beat mass DMs." },
  { key: "outreach_send", phase: "pre_release", offset: -5, channel: "outreach", title: "Send personal messages with your pre-save link", details: "Two or three lines: who you are, why the song fits them, the link." },
  { key: "creators_book", phase: "pre_release", offset: -14, channel: "instagram", budgets: ["larger"], title: "Book 2–3 creators or meme pages for release week", details: "Agree on the clip, the post date and the price before release week." },
  { key: "boost_teaser", phase: "release_week", offset: -3, channel: "instagram", budgets: ["small", "larger"], title: "Boost the best-performing teaser", details: "Pick the teaser with the most saves and shares, and boost it to people similar to your followers." },
  { key: "ig_story_countdown", phase: "release_week", offset: -2, channel: "instagram", title: "Story countdown and behind-the-scenes", details: "Daily Stories for the last 3 days: countdown sticker, studio clip, a lyric." },
  { key: "wa_status_tease", phase: "release_week", offset: -1, channel: "whatsapp", caption: "teaser", title: "WhatsApp Status teaser", details: "Post a 15–30 second clip on your Status the day before release." },
  { key: "ig_release_reel", phase: "release_day", offset: 0, channel: "instagram", caption: "release", title: "Release-day Reel with a link sticker in your Story", details: "Post in the evening when your followers are most active, and pin it to your profile." },
  { key: "yt_release", phase: "release_day", offset: 0, channel: "youtube", title: "Upload the official audio, lyric video or visualiser", details: "Put the streaming link in the description and pin a comment." },
  { key: "wa_release", phase: "release_day", offset: 0, channel: "whatsapp", caption: "release", title: "Share the link on your Status and with close fans", details: "Send it personally to people who support your music; ask them to share." },
  { key: "boost_release", phase: "release_day", offset: 0, channel: "instagram", budgets: ["small", "larger"], title: "Boost the release-day Reel", details: "Use part of your ads budget on the post that's already doing best." },
  { key: "reshare_fans", phase: "post_release", offset: 1, channel: "instagram", title: "Repost listeners' Stories and best comments", details: "Thank people by name. It encourages others to share too." },
  { key: "ig_reel_2", phase: "post_release", offset: 3, channel: "instagram", genreIdea: "bts", title: "Reel #2: a different side of the song", details: "" },
  { key: "yt_short_2", phase: "post_release", offset: 4, channel: "youtube", title: "Second YouTube Short from another part of the song", details: "Try a different hook or visual than the teaser." },
  { key: "challenge", phase: "post_release", offset: 5, channel: "instagram", genreIdea: "challenge", title: "Start a fan challenge", details: "" },
  { key: "outreach_followup", phase: "post_release", offset: 6, channel: "outreach", title: "Follow up with pages and curators who replied", details: "Share early numbers or fan reactions as a reason to add the song." },
  { key: "creators_post", phase: "post_release", offset: 5, channel: "instagram", budgets: ["larger"], title: "Creators' posts go live, then share them", details: "Check each post went out as agreed and reshare it." },
  { key: "review_week_one", phase: "post_release", offset: 7, channel: "general", title: "Check week-one numbers and log them in Growth", details: "Spotify for Artists, YouTube Studio and Instagram insights. Which post brought the most streams?" },
  { key: "thanks_post", phase: "post_release", offset: 14, channel: "general", caption: "thanks", title: "Thank-you post and a hint at what's next", details: "Keep the momentum for your next release." },
  { key: "insights_upload", phase: "post_release", offset: 21, channel: "general", title: "Upload your Spotify for Artists CSVs to Insights", details: "Compare the first three weeks with your plan and budget." },
];

const fill = (text, values) => text.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");

const formatReleaseDate = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

// settings: { channels: [...], languages: [...], budgetLevel, genre }
// Returns tasks ready to insert into release_plan_tasks, sorted by due date.
export const generateCampaign = ({ releaseDate, title, artistName, settings }) => {
  const channels = new Set(["general", ...(settings.channels ?? [])]);
  const languages = settings.languages?.length ? settings.languages : ["en"];
  const family = genreFamily(settings.genre);
  const values = { title: title || "your song", artist: artistName || "", date: releaseDate ? formatReleaseDate(releaseDate) : "soon" };

  return TEMPLATES.filter(
    (template) =>
      channels.has(template.channel) &&
      (!template.budgets || template.budgets.includes(settings.budgetLevel))
  )
    .map((template) => {
      const parts = [];
      if (template.details) parts.push(template.details);
      if (template.genreIdea) parts.push(GENRE_IDEAS[family][template.genreIdea]);
      if (template.caption) {
        const captions = languages.map((language) => {
          const label = LANGUAGES.find((entry) => entry.id === language)?.label ?? language;
          return `${label}: ${fill(CAPTIONS[template.caption][language], values)}`;
        });
        parts.push(`Caption ideas:\n${captions.join("\n")}`);
      }

      return {
        template_key: template.key,
        title: template.title,
        details: parts.join("\n\n"),
        channel: template.channel,
        phase: template.phase,
        due_date: releaseDate ? addDays(releaseDate, template.offset) : null,
        source: "campaign",
      };
    })
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? "") || a.title.localeCompare(b.title));
};
