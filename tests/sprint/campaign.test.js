import { describe, expect, it } from "vitest";
import { generateCampaign, genreFamily, suggestBudgetLevel } from "../../lib/campaign.js";
import { CHECKLIST_TASKS } from "../../lib/releasePlans.js";

const base = {
  releaseDate: "2026-11-20",
  title: "Night Drive",
  artistName: "Naam Namah",
  settings: { channels: ["instagram"], languages: ["en"], budgetLevel: "organic", genre: "Hip-Hop/Rap" },
};

describe("generateCampaign", () => {
  it("is deterministic", () => {
    expect(generateCampaign(base)).toEqual(generateCampaign(base));
  });

  it("dates tasks relative to the release and sorts them", () => {
    const tasks = generateCampaign(base);
    const releaseDay = tasks.find((task) => task.template_key === "ig_release_reel");
    expect(releaseDay.due_date).toBe("2026-11-20");
    expect(tasks.find((task) => task.template_key === "ig_announce").due_date).toBe("2026-11-06");
    const dates = tasks.map((task) => task.due_date);
    expect([...dates].sort()).toEqual(dates);
  });

  it("only includes the chosen channels plus general tasks", () => {
    const tasks = generateCampaign(base);
    expect(new Set(tasks.map((task) => task.channel))).toEqual(new Set(["general", "instagram"]));
    const withYoutube = generateCampaign({ ...base, settings: { ...base.settings, channels: ["youtube", "whatsapp"] } });
    expect(withYoutube.some((task) => task.channel === "instagram")).toBe(false);
    expect(withYoutube.some((task) => task.channel === "whatsapp")).toBe(true);
  });

  it("adds paid tasks only when there's a budget", () => {
    const organic = generateCampaign(base).map((task) => task.template_key);
    const small = generateCampaign({ ...base, settings: { ...base.settings, budgetLevel: "small" } }).map((task) => task.template_key);
    const larger = generateCampaign({ ...base, settings: { ...base.settings, budgetLevel: "larger" } }).map((task) => task.template_key);
    expect(organic).not.toContain("boost_teaser");
    expect(small).toContain("boost_teaser");
    expect(small).not.toContain("creators_book");
    expect(larger).toContain("creators_book");
  });

  it("writes captions in every chosen language", () => {
    const tasks = generateCampaign({ ...base, settings: { ...base.settings, languages: ["en", "hi", "hinglish"] } });
    const announce = tasks.find((task) => task.template_key === "ig_announce");
    expect(announce.details).toMatch(/English: New music: “Night Drive” drops 20 Nov/);
    expect(announce.details).toMatch(/Hindi: नया गाना “Night Drive”/);
    expect(announce.details).toMatch(/Hinglish: Naya gaana “Night Drive”/);
  });

  it("tailors ideas to the genre", () => {
    const hiphop = generateCampaign(base).find((task) => task.template_key === "challenge").details;
    const devotional = generateCampaign({ ...base, settings: { ...base.settings, genre: "Devotional" } }).find((task) => task.template_key === "challenge").details;
    expect(hiphop).toMatch(/freestyle/i);
    expect(devotional).toMatch(/festival/i);
  });

  it("doesn't repeat steps already on the fixed release checklist", () => {
    const checklistKeys = new Set(CHECKLIST_TASKS.map((task) => task.key));
    const all = generateCampaign({ ...base, settings: { channels: ["instagram", "youtube", "whatsapp", "outreach"], languages: ["en"], budgetLevel: "larger", genre: "" } });
    expect(all.some((task) => checklistKeys.has(task.template_key))).toBe(false);
    expect(all.some((task) => /pre-save link and share|pitch the track to spotify/i.test(task.title))).toBe(false);
  });

  it("leaves due dates empty when there's no release date", () => {
    expect(generateCampaign({ ...base, releaseDate: null }).every((task) => task.due_date === null)).toBe(true);
  });
});

describe("campaign helpers", () => {
  it("suggests a budget level from the planned promo budget", () => {
    expect(suggestBudgetLevel(0)).toBe("organic");
    expect(suggestBudgetLevel(2000)).toBe("small");
    expect(suggestBudgetLevel(10000)).toBe("larger");
  });

  it("groups genres", () => {
    expect(genreFamily("Hip-Hop/Rap")).toBe("hiphop");
    expect(genreFamily("Devotional")).toBe("devotional");
    expect(genreFamily("Pop")).toBe("general");
  });
});
