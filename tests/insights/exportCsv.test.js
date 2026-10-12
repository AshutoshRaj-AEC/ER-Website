import { describe, expect, it } from "vitest";
import { parseCsv } from "../../lib/insights/csv.js";
import { safeFileName, toCsv } from "../../lib/insights/exportCsv.js";

const columns = [
  { key: "name", label: "Song" },
  { key: "streams", label: "Streams" },
];

describe("toCsv", () => {
  it("quotes commas, quotes and line breaks so the file round-trips", () => {
    const csv = toCsv(columns, [{ name: 'Hello, "World"\nagain', streams: 12 }]);
    const { rows } = parseCsv(csv);
    expect(rows[1].fields).toEqual(['Hello, "World"\nagain', "12"]);
  });

  it("leaves missing values empty instead of writing zero", () => {
    expect(toCsv(columns, [{ name: "A", streams: null }])).toBe("Song,Streams\r\nA,\r\n");
  });

  it("neutralises values a spreadsheet would run as formulas", () => {
    const csv = toCsv(columns, [
      { name: "=1+1", streams: 1 },
      { name: "@SUM(A1)", streams: 2 },
      { name: "+cmd", streams: 3 },
      { name: "-2+3", streams: 4 },
    ]);
    const { rows } = parseCsv(csv);
    expect(rows.slice(1).map((row) => row.fields[0])).toEqual(["'=1+1", "'@SUM(A1)", "'+cmd", "'-2+3"]);
  });

  it("keeps real numbers as numbers", () => {
    expect(toCsv([{ key: "n", label: "N" }], [{ n: 1234 }])).toBe("N\r\n1234\r\n");
  });
});

describe("safeFileName", () => {
  it("produces a safe, readable file name", () => {
    expect(safeFileName("Songs: Last 28 days / 2026")).toBe("songs-last-28-days-2026");
    expect(safeFileName("???")).toBe("export");
  });
});
