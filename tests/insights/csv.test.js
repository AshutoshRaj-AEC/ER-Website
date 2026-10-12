import { describe, expect, it } from "vitest";
import { MAX_DATA_ROWS, detectDelimiter, parseCsv, parseCsvWithHeader } from "../../lib/insights/csv.js";

describe("parseCsv", () => {
  it("handles quoted commas, escaped quotes and line breaks inside quotes", () => {
    const { rows, errors } = parseCsv('song,note\n"Hello, World","She said ""hi"""\n"Two\nlines",x\n');
    expect(errors).toEqual([]);
    expect(rows.map((row) => row.fields)).toEqual([
      ["song", "note"],
      ["Hello, World", 'She said "hi"'],
      ["Two\nlines", "x"],
    ]);
    // The record after a multi-line value starts on the right line.
    expect(rows[2].line).toBe(3);
  });

  it("strips a byte-order mark and handles Windows line endings", () => {
    const { rows } = parseCsv("﻿date,streams\r\n2026-10-01,10\r\n");
    expect(rows[0].fields).toEqual(["date", "streams"]);
    expect(rows[1].fields).toEqual(["2026-10-01", "10"]);
  });

  it("keeps Unicode text intact", () => {
    const { rows } = parseCsv("song,streams\nअलख निरंजन,12\nCafé Ñandú 🎵,3\n");
    expect(rows[1].fields[0]).toBe("अलख निरंजन");
    expect(rows[2].fields[0]).toBe("Café Ñandú 🎵");
  });

  it("detects semicolon and tab delimiters", () => {
    expect(detectDelimiter("date;streams\n2026-10-01;5")).toBe(";");
    expect(detectDelimiter("date\tstreams\n2026-10-01\t5")).toBe("\t");
    expect(detectDelimiter('"a,b";c;d\n')).toBe(";");
  });

  it("skips blank lines and ignores spaces around quoted values", () => {
    const { rows } = parseCsv('a,b\n\n"x" , y\n\n');
    expect(rows.map((row) => row.fields)).toEqual([["a", "b"], ["x", "y"]]);
  });

  it("reports an unterminated quote as fatal", () => {
    const { errors } = parseCsv('song,streams\n"Unclosed,5\n');
    expect(errors.some((error) => error.fatal)).toBe(true);
  });

  it("never evaluates formulas", () => {
    const { rows } = parseCsv('song,streams\n=HYPERLINK("http://x"),1\n');
    expect(rows[1].fields[0]).toBe('=HYPERLINK("http://x")');
  });
});

describe("parseCsvWithHeader", () => {
  it("returns records keyed by header with source line numbers", () => {
    const { headers, records, issues } = parseCsvWithHeader("date,streams\n2026-10-01,10\n2026-10-02,12\n");
    expect(headers).toEqual(["date", "streams"]);
    expect(records[1]).toEqual({ line: 3, values: { date: "2026-10-02", streams: "12" } });
    expect(issues).toEqual([]);
  });

  it("skips malformed rows with the wrong number of values and says so", () => {
    const { records, issues, malformedCount } = parseCsvWithHeader("date,streams\n2026-10-01,10\n2026-10-02\n2026-10-03,1,2\n");
    expect(records).toHaveLength(1);
    expect(malformedCount).toBe(2);
    expect(issues.filter((issue) => issue.message.includes("Expected 2 values"))).toHaveLength(2);
  });

  it("renames duplicate headers and warns", () => {
    const { headers, issues } = parseCsvWithHeader("streams,Streams\n1,2\n");
    expect(headers).toEqual(["streams", "Streams (2)"]);
    expect(issues[0].level).toBe("warning");
  });

  it("flags an empty file", () => {
    const { issues } = parseCsvWithHeader("\n\n");
    expect(issues.some((issue) => issue.level === "error" && issue.message.includes("empty"))).toBe(true);
  });

  it("rejects files over the row limit", () => {
    const body = Array.from({ length: MAX_DATA_ROWS + 1 }, (_, i) => `2026-01-01,${i}`).join("\n");
    const { issues, records } = parseCsvWithHeader(`date,streams\n${body}`);
    expect(issues.some((issue) => issue.level === "error" && issue.message.includes("limit"))).toBe(true);
    expect(records).toHaveLength(MAX_DATA_ROWS);
  });
});
