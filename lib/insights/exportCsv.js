// Build CSV downloads of what's on screen.

// Spreadsheet apps run cells starting with these characters as formulas, so
// such text values are prefixed with an apostrophe (CSV injection guard).
const FORMULA_START = /^[=+\-@\t\r]/;

const escapeCell = (value) => {
  if (value === null || value === undefined) {
    return "";
  }
  let text = String(value);
  if (typeof value !== "number" && FORMULA_START.test(text)) {
    text = `'${text}`;
  }
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

// columns: [{ key, label }]; rows: plain objects. Missing values stay empty.
export const toCsv = (columns, rows) => {
  const lines = [
    columns.map((column) => escapeCell(column.label)).join(","),
    ...rows.map((row) => columns.map((column) => escapeCell(row[column.key])).join(",")),
  ];
  return `${lines.join("\r\n")}\r\n`;
};

export const downloadCsv = (fileName, csvText) => {
  // A byte-order mark makes Excel open UTF-8 (e.g. Hindi song titles) correctly.
  const blob = new Blob(["﻿", csvText], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const safeFileName = (text) =>
  text
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 80) || "export";
