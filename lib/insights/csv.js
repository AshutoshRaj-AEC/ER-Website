// RFC 4180 CSV parsing. Values are only ever treated as text: nothing in a CSV
// is evaluated, and formulas are kept as plain strings.

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_DATA_ROWS = 50000;

const CANDIDATE_DELIMITERS = [",", ";", "\t"];

// Pick the delimiter that appears most often in the header line (outside quotes).
export const detectDelimiter = (text) => {
  const counts = Object.fromEntries(CANDIDATE_DELIMITERS.map((d) => [d, 0]));
  let inQuotes = false;

  for (const char of text) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && (char === "\n" || char === "\r")) {
      break;
    } else if (!inQuotes && char in counts) {
      counts[char] += 1;
    }
  }

  const [best, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return count > 0 ? best : ",";
};

// Returns every record as an array of raw strings, with the 1-based line
// number each record starts on (records can span lines inside quotes).
export const parseCsv = (input, { delimiter } = {}) => {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const separator = delimiter ?? detectDelimiter(text);
  const rows = [];
  const errors = [];

  let field = "";
  let record = [];
  let inQuotes = false;
  let quotedField = false;
  let line = 1;
  let recordLine = 1;

  const endField = () => {
    record.push(quotedField ? field : field.trim());
    field = "";
    quotedField = false;
  };

  const endRecord = () => {
    endField();
    rows.push({ line: recordLine, fields: record });
    record = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        if (char === "\n") {
          line += 1;
        }
        field += char;
      }
      continue;
    }

    if (char === '"') {
      if (field.trim() === "") {
        inQuotes = true;
        quotedField = true;
        field = "";
      } else {
        // A stray quote inside an unquoted value is kept as text.
        field += char;
      }
    } else if (char === separator) {
      endField();
    } else if (char === "\r" || char === "\n") {
      if (char === "\r" && text[i + 1] === "\n") {
        i += 1;
      }
      endRecord();
      line += 1;
      recordLine = line;
    } else if (quotedField) {
      // Spaces after a closing quote are ignored. Other text, e.g. "abc"def,
      // is kept but flagged.
      if (char.trim() !== "") {
        errors.push({ line, message: "Unexpected text after a closing quote." });
        field += char;
      }
    } else {
      field += char;
    }
  }

  if (inQuotes) {
    errors.push({
      line: recordLine,
      message: "A quoted value is never closed, so the rest of the file can't be read reliably.",
      fatal: true,
    });
  }

  if (field !== "" || record.length > 0 || quotedField) {
    endRecord();
  }

  // Drop lines that are completely empty.
  const nonEmpty = rows.filter((row) => row.fields.some((value) => value !== ""));
  return { rows: nonEmpty, errors, delimiter: separator };
};

// Parse with the first row as headers. Rows with the wrong number of columns
// are reported as malformed and left out.
export const parseCsvWithHeader = (input, options = {}) => {
  const { rows, errors, delimiter } = parseCsv(input, options);
  const issues = errors.map((error) => ({ ...error, level: error.fatal ? "error" : "warning" }));

  if (rows.length === 0) {
    return { headers: [], records: [], issues: [...issues, { level: "error", message: "The file is empty." }], delimiter };
  }

  const seen = new Map();
  const headers = rows[0].fields.map((raw, index) => {
    let name = raw.trim() || `Column ${index + 1}`;
    if (seen.has(name.toLowerCase())) {
      const count = seen.get(name.toLowerCase()) + 1;
      seen.set(name.toLowerCase(), count);
      issues.push({ level: "warning", line: rows[0].line, message: `The column "${name}" appears more than once; the extra copy is named "${name} (${count})".` });
      name = `${name} (${count})`;
    } else {
      seen.set(name.toLowerCase(), 1);
    }
    return name;
  });

  const dataRows = rows.slice(1);
  if (dataRows.length > MAX_DATA_ROWS) {
    issues.push({
      level: "error",
      message: `The file has ${dataRows.length.toLocaleString("en-IN")} rows. The limit is ${MAX_DATA_ROWS.toLocaleString("en-IN")} per upload.`,
    });
  }

  const records = [];
  let malformed = 0;

  for (const row of dataRows.slice(0, MAX_DATA_ROWS)) {
    if (row.fields.length !== headers.length) {
      malformed += 1;
      if (malformed <= 20) {
        issues.push({
          level: "warning",
          line: row.line,
          message: `Expected ${headers.length} values but found ${row.fields.length}. This row was skipped.`,
        });
      }
      continue;
    }
    records.push({
      line: row.line,
      values: Object.fromEntries(headers.map((header, index) => [header, row.fields[index]])),
    });
  }

  if (malformed > 20) {
    issues.push({ level: "warning", message: `${malformed - 20} more rows had the wrong number of values and were skipped.` });
  }

  return { headers, records, issues, delimiter, malformedCount: malformed };
};
