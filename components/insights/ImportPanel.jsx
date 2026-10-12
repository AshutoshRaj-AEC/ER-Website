import { useMemo, useRef, useState } from "react";
import { fieldClass } from "../AutoSaveField";
import { Panel } from "../PageShell";
import { MAX_FILE_BYTES, parseCsvWithHeader } from "../../lib/insights/csv";
import {
  METRICS,
  PERIOD_PRESETS,
  REPORT_TYPES,
  detectReportType,
  mapColumns,
  normalizeRecords,
} from "../../lib/insights/reportTypes";
import { detectDateOrder } from "../../lib/insights/values";
import { addDays, formatDay, periodLabel } from "../../lib/insights/analytics";
import { commitImport, decodeCsvBuffer, sha256Hex } from "../../lib/insights/api";
import { formatBytes, formatCount, formatTimestamp } from "../../lib/insights/format";

const labelClass = "text-[11px] font-semibold uppercase tracking-[0.25em] text-stone-400";
const primaryButton =
  "rounded-full bg-orange-500 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-40";
const secondaryButton =
  "rounded-full border border-white/15 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-stone-300 transition hover:border-orange-300 hover:text-orange-200";

const MAX_ISSUES_SHOWN = 30;

const FIELD_LABELS = {
  date: "Date",
  song: "Song",
  playlist: "Playlist",
  curator: "Curator / author",
  release_date: "Release date",
  added_date: "Date added",
  country: "Country",
};

const yesterday = () => addDays(new Date().toISOString().slice(0, 10), -1);

const Notice = ({ tone = "info", children }) => {
  const tones = {
    info: "border-sky-300/30 bg-sky-300/10 text-sky-100",
    warning: "border-amber-300/30 bg-amber-300/10 text-amber-100",
    error: "border-red-300/30 bg-red-300/10 text-red-100",
    success: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  };
  return <div className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${tones[tone]}`}>{children}</div>;
};

const IssueList = ({ issues }) => {
  if (issues.length === 0) return null;
  const errors = issues.filter((issue) => issue.level === "error");
  const warnings = issues.filter((issue) => issue.level !== "error");
  const shown = [...errors, ...warnings].slice(0, MAX_ISSUES_SHOWN);

  return (
    <div>
      <p className={labelClass}>
        {errors.length ? `${errors.length} problem${errors.length === 1 ? "" : "s"} to fix` : ""}
        {errors.length && warnings.length ? " · " : ""}
        {warnings.length ? `${warnings.length} warning${warnings.length === 1 ? "" : "s"}` : ""}
      </p>
      <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-2 text-sm">
        {shown.map((issue, index) => (
          <li key={index} className={issue.level === "error" ? "text-red-200" : "text-amber-100/90"}>
            <span aria-hidden="true">{issue.level === "error" ? "✕ " : "! "}</span>
            {issue.line ? <span className="text-stone-400">Line {issue.line}: </span> : null}
            {issue.message}
          </li>
        ))}
      </ul>
      {issues.length > shown.length ? (
        <p className="mt-2 text-xs text-stone-500">…and {issues.length - shown.length} more.</p>
      ) : null}
    </div>
  );
};

const UnsupportedFile = ({ headers, results, onReset }) => (
  <div className="space-y-5">
    <Notice tone="error">
      <p className="font-semibold">This file doesn't match a supported Spotify for Artists report.</p>
      <p className="mt-1">
        Columns found:{" "}
        {headers.length ? headers.map((header) => `"${header}"`).join(", ") : "none"}
      </p>
    </Notice>
    <div>
      <p className={labelClass}>Supported reports</p>
      <ul className="mt-3 space-y-3 text-sm">
        {results.map((result) => (
          <li key={result.typeId} className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="font-semibold text-white">{REPORT_TYPES[result.typeId].label}</p>
            <p className="mt-1 text-stone-400">{REPORT_TYPES[result.typeId].where}</p>
            <p className="mt-1 text-xs text-stone-500">Not a match: {result.problems.join("; ")}.</p>
          </li>
        ))}
      </ul>
    </div>
    <button type="button" onClick={onReset} className={secondaryButton}>
      Choose another file
    </button>
  </div>
);

const ImportPanel = ({ userId, data, onImported, onClose }) => {
  const inputRef = useRef(null);
  const [stage, setStage] = useState("select");
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState("");
  const [file, setFile] = useState(null);
  const [sha, setSha] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [detection, setDetection] = useState(null);
  const [typeId, setTypeId] = useState(null);
  const [songName, setSongName] = useState("");
  const [period, setPeriod] = useState({ preset: "28d", end: yesterday(), start: "" });
  const [dateOrder, setDateOrder] = useState("");
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState(null);
  const [failure, setFailure] = useState("");

  const reset = () => {
    setStage("select");
    setFile(null);
    setParsed(null);
    setDetection(null);
    setTypeId(null);
    setSongName("");
    setDateOrder("");
    setFileError("");
    setFailure("");
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = async (selected) => {
    setFileError("");
    if (!selected) return;

    if (!/\.csv$/i.test(selected.name)) {
      setFileError("Choose a .csv file exported from Spotify for Artists.");
      return;
    }
    if (selected.size === 0) {
      setFileError("This file is empty.");
      return;
    }
    if (selected.size > MAX_FILE_BYTES) {
      setFileError(`This file is ${formatBytes(selected.size)}. The limit is ${formatBytes(MAX_FILE_BYTES)} per upload.`);
      return;
    }

    setStage("reading");
    try {
      const buffer = await selected.arrayBuffer();
      const text = decodeCsvBuffer(buffer);
      if (text.includes("\u0000")) {
        setStage("select");
        setFileError("This doesn't look like a text CSV file. Export the report again as CSV.");
        return;
      }
      const result = parseCsvWithHeader(text);
      const detected = detectReportType(result.headers);
      setFile(selected);
      setSha(await sha256Hex(buffer));
      setParsed(result);
      setDetection(detected);
      setTypeId(detected.typeId);
      setStage("preview");
    } catch {
      setStage("select");
      setFileError("This file couldn't be read. Export it again from Spotify for Artists and retry.");
    }
  };

  const columns = useMemo(
    () => (parsed && typeId ? mapColumns(typeId, parsed.headers) : null),
    [parsed, typeId]
  );

  const needsDateOrder = useMemo(() => {
    if (!parsed || !columns) return false;
    return ["date", "release_date", "added_date"].some(
      (field) =>
        columns.mapping[field] &&
        detectDateOrder(parsed.records.map((record) => record.values[columns.mapping[field]])) === "ambiguous"
    );
  }, [parsed, columns]);

  const type = typeId ? REPORT_TYPES[typeId] : null;
  const options = {
    songName,
    period: type?.kind === "period" ? period : undefined,
    dateOrder: dateOrder || undefined,
  };

  const normalized = useMemo(
    () => (parsed && typeId ? normalizeRecords({ typeId, headers: parsed.headers, records: parsed.records, options }) : null),
    // `options` is rebuilt every render from the three values below.
    [parsed, typeId, songName, period, dateOrder]
  );

  const allIssues = useMemo(
    () => [...(parsed?.issues ?? []), ...(normalized?.issues ?? [])],
    [parsed, normalized]
  );

  // Is this exact file, or data for the same days/period, already imported?
  const previousCopy = data.imports.find((entry) => entry.status === "completed" && entry.file_sha256 === sha);
  const overlap = useMemo(() => {
    if (!normalized) return null;
    if (type?.kind === "daily") {
      const existing = new Set(
        data.daily.map((row) => [row.scope, row.song_key, row.country, row.metric_date].join("|"))
      );
      const count = normalized.daily.filter((row) =>
        existing.has([row.scope, row.song_key, row.country, row.metric_date].join("|"))
      ).length;
      return count > 0 ? { kind: "daily", count } : null;
    }
    const first = normalized.period[0];
    if (!first) return null;
    const match = data.period.find(
      (row) =>
        row.report_type === typeId &&
        row.period_preset === first.period_preset &&
        row.period_start === first.period_start &&
        row.period_end === first.period_end
    );
    return match ? { kind: "period", label: periodLabel(first) } : null;
  }, [normalized, data, type, typeId]);

  const knownSongs = useMemo(
    () =>
      [
        ...new Set([
          ...data.period.filter((row) => row.report_type === "songs_summary").map((row) => row.entity_name),
          ...data.daily.filter((row) => row.scope === "song").map((row) => row.song_name),
        ]),
      ].filter(Boolean),
    [data]
  );

  const runImport = async () => {
    setStage("importing");
    setFailure("");
    const rows = type.kind === "daily" ? normalized.daily.length : normalized.period.length;
    setProgress(`Saving ${formatCount(rows)} rows…`);
    try {
      const saved = await commitImport({
        userId,
        file,
        sha,
        typeId,
        normalized,
        options,
        mapping: columns.mapping,
        unsupported: columns.unsupported,
        issues: allIssues,
        rowCount: parsed.records.length + (parsed.malformedCount ?? 0),
      });
      setResult({ ...saved, rows, skipped: normalized.skipped + (parsed.malformedCount ?? 0) });
      setStage("done");
      onImported();
    } catch (error) {
      setFailure(error.message);
      setStage("failed");
      onImported();
    }
  };

  const heading = (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 className="font-['Space_Grotesk'] text-xl font-bold uppercase tracking-[0.08em] text-white">
          Import a Spotify for Artists CSV
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-400">
          Nothing is saved until you confirm. Files are stored privately and only you can see your data.
        </p>
      </div>
      {onClose && stage !== "importing" ? (
        <button type="button" onClick={onClose} className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-400 hover:text-orange-200">
          Close
        </button>
      ) : null}
    </div>
  );

  if (stage === "select" || stage === "reading") {
    return (
      <Panel>
        {heading}
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            handleFile(event.dataTransfer.files?.[0]);
          }}
          className={`flex flex-col items-center justify-center rounded-[1.5rem] border-2 border-dashed px-6 py-12 text-center transition ${
            dragging ? "border-orange-300 bg-orange-500/10" : "border-white/15 bg-black/20"
          }`}
        >
          {stage === "reading" ? (
            <p className="text-sm text-stone-300" aria-live="polite">Reading your file…</p>
          ) : (
            <>
              <p className="font-semibold text-white">Drag and drop a CSV here</p>
              <p className="mt-1 text-sm text-stone-400">or</p>
              <button type="button" onClick={() => inputRef.current?.click()} className={`${primaryButton} mt-3`}>
                Choose CSV file
              </button>
              <p className="mt-4 text-xs text-stone-500">.csv only, up to {formatBytes(MAX_FILE_BYTES)}</p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            tabIndex={-1}
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
        </div>
        {fileError ? (
          <div className="mt-4">
            <Notice tone="error">{fileError}</Notice>
          </div>
        ) : null}
        <details className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
          <summary className="cursor-pointer font-semibold text-stone-200">Which files can I upload?</summary>
          <ul className="mt-3 space-y-3">
            {Object.entries(REPORT_TYPES).map(([id, report]) => (
              <li key={id}>
                <p className="font-semibold text-white">{report.label}</p>
                <p className="text-stone-400">{report.description}</p>
                <p className="text-xs text-stone-500">{report.where}</p>
              </li>
            ))}
          </ul>
        </details>
      </Panel>
    );
  }

  if (stage === "preview" && !typeId) {
    return (
      <Panel>
        {heading}
        <UnsupportedFile headers={parsed.headers} results={detection.results} onReset={reset} />
      </Panel>
    );
  }

  if (stage === "importing") {
    return (
      <Panel>
        {heading}
        <div className="flex items-center gap-3 py-10" aria-live="polite">
          <span className="h-3 w-3 animate-pulse rounded-full bg-orange-400" aria-hidden="true" />
          <p className="text-stone-200">{progress}</p>
        </div>
      </Panel>
    );
  }

  if (stage === "done") {
    return (
      <Panel>
        {heading}
        <Notice tone="success">
          <p className="font-semibold">Imported {file.name}</p>
          <p className="mt-1">
            {formatCount(result.rows)} rows saved: {formatCount(result.newCount)} new
            {result.replacedCount ? `, ${formatCount(result.replacedCount)} replaced values from an earlier upload (not counted twice)` : ""}.
            {result.skipped ? ` ${formatCount(result.skipped)} rows were skipped.` : ""}
          </p>
        </Notice>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={onClose} className={primaryButton}>
            View insights
          </button>
          <button type="button" onClick={reset} className={secondaryButton}>
            Import another file
          </button>
        </div>
      </Panel>
    );
  }

  if (stage === "failed") {
    return (
      <Panel>
        {heading}
        <Notice tone="error">
          <p className="font-semibold">Import failed</p>
          <p className="mt-1">{failure}</p>
        </Notice>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={runImport} className={primaryButton}>
            Try again
          </button>
          <button type="button" onClick={reset} className={secondaryButton}>
            Choose another file
          </button>
        </div>
      </Panel>
    );
  }

  // Preview
  const choices = [detection.typeId, ...detection.alternatives];
  const mappedFields = Object.keys(type.fields);
  const sampleColumns = Object.values(columns.mapping);
  const rowsReady = type.kind === "daily" ? normalized.daily.length : normalized.period.length;
  const fatalParse = parsed.issues.some((issue) => issue.level === "error");

  return (
    <Panel>
      {heading}

      <div className="space-y-6">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-stone-400">
          <span className="font-semibold text-white">{file.name}</span>
          <span>{formatBytes(file.size)}</span>
          <span>{formatCount(parsed.records.length)} data rows</span>
          <span>{parsed.delimiter === "\t" ? "Tab" : parsed.delimiter === ";" ? "Semicolon" : "Comma"}-separated</span>
        </div>

        {previousCopy ? (
          <Notice tone="warning">
            You already imported this exact file on {formatTimestamp(previousCopy.created_at)}. Importing it again won't
            change any numbers.
          </Notice>
        ) : null}

        <div>
          <p className={labelClass}>Detected report</p>
          {choices.length > 1 ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Report type">
              {choices.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  role="radio"
                  aria-checked={typeId === choice}
                  onClick={() => setTypeId(choice)}
                  className={`rounded-2xl border p-4 text-left transition ${
                    typeId === choice ? "border-orange-400 bg-orange-500/10" : "border-white/10 bg-black/20 hover:border-orange-300/50"
                  }`}
                >
                  <p className="font-semibold text-white">{REPORT_TYPES[choice].label}</p>
                  <p className="mt-1 text-sm text-stone-400">{REPORT_TYPES[choice].description}</p>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-orange-400/40 bg-orange-500/10 p-4">
              <p className="font-semibold text-white">{type.label}</p>
              <p className="mt-1 text-sm text-stone-400">{type.description}</p>
            </div>
          )}
          {choices.length > 1 ? (
            <p className="mt-2 text-xs text-stone-500">
              These columns fit more than one report. Pick the one you downloaded.
            </p>
          ) : null}
        </div>

        {typeId === "song_timeline" && !columns.mapping.song ? (
          <label className="block max-w-md">
            <span className={labelClass}>Which song is this timeline for?</span>
            <input
              list="insights-known-songs"
              maxLength={300}
              placeholder="Song name, exactly as on Spotify"
              value={songName}
              onChange={(event) => setSongName(event.target.value)}
              className={`${fieldClass} mt-2`}
            />
            <datalist id="insights-known-songs">
              {knownSongs.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <span className="mt-2 block text-xs text-stone-500">
              Spotify's song timeline doesn't include the song name. Use the same name as in your Songs report so they match.
            </span>
          </label>
        ) : null}

        {type.kind === "period" ? (
          <div>
            <p className={labelClass}>Reporting period</p>
            <p className="mt-1 text-xs leading-5 text-stone-500">
              Spotify's {type.label.toLowerCase()} doesn't include dates. Choose the period you selected in Spotify for
              Artists and the last day it covers. If you're not sure, use the day before you downloaded it.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <select
                aria-label="Period"
                value={period.preset}
                onChange={(event) => setPeriod((current) => ({ ...current, preset: event.target.value }))}
                className={fieldClass}
              >
                {PERIOD_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
              {period.preset === "custom" ? (
                <input
                  type="date"
                  aria-label="First day of the period"
                  value={period.start}
                  onChange={(event) => setPeriod((current) => ({ ...current, start: event.target.value }))}
                  className={`${fieldClass} [color-scheme:dark]`}
                />
              ) : null}
              <input
                type="date"
                aria-label="Last day of the period"
                value={period.end}
                onChange={(event) => setPeriod((current) => ({ ...current, end: event.target.value }))}
                className={`${fieldClass} [color-scheme:dark]`}
              />
            </div>
          </div>
        ) : null}

        {needsDateOrder ? (
          <label className="block max-w-md">
            <span className={labelClass}>Date format in this file</span>
            <select value={dateOrder} onChange={(event) => setDateOrder(event.target.value)} className={`${fieldClass} mt-2`}>
              <option value="">Choose…</option>
              <option value="dmy">Day / Month / Year (e.g. 25/10/2026)</option>
              <option value="mdy">Month / Day / Year (e.g. 10/25/2026)</option>
            </select>
          </label>
        ) : null}

        <div>
          <p className={labelClass}>How the columns were read</p>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th scope="col" className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">Field</th>
                  <th scope="col" className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">Column in your file</th>
                </tr>
              </thead>
              <tbody>
                {mappedFields.map((field) => (
                  <tr key={field} className="border-t border-white/5">
                    <td className="px-4 py-2 text-stone-200" title={METRICS[field]?.definition}>
                      {METRICS[field]?.label ?? FIELD_LABELS[field] ?? field}
                    </td>
                    <td className="px-4 py-2">
                      {columns.mapping[field] ? (
                        <span className="text-emerald-200">"{columns.mapping[field]}"</span>
                      ) : (
                        <span className="text-stone-500">Not in this file</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {columns.unsupported.length ? (
            <p className="mt-2 text-xs text-stone-500">
              Not supported yet, so ignored: {columns.unsupported.map((header) => `"${header}"`).join(", ")}.
            </p>
          ) : null}
          {columns.ignored.length ? (
            <p className="mt-1 text-xs text-stone-500">
              Unrecognised, so ignored: {columns.ignored.map((header) => `"${header}"`).join(", ")}.
            </p>
          ) : null}
        </div>

        <div>
          <p className={labelClass}>First rows of your file</p>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th scope="col" className="px-4 py-2 text-[11px] font-semibold text-stone-500">Line</th>
                  {sampleColumns.map((header) => (
                    <th key={header} scope="col" className="whitespace-nowrap px-4 py-2 text-[11px] font-semibold text-stone-400">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.records.slice(0, 5).map((record) => (
                  <tr key={record.line} className="border-t border-white/5">
                    <td className="px-4 py-2 tabular-nums text-stone-500">{record.line}</td>
                    {sampleColumns.map((header) => (
                      <td key={header} className="max-w-[16rem] truncate whitespace-nowrap px-4 py-2 text-stone-200">
                        {record.values[header] || <span className="text-stone-600">empty</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <IssueList issues={allIssues} />

        {overlap ? (
          <Notice tone="info">
            {overlap.kind === "daily"
              ? `${formatCount(overlap.count)} of these days are already in your data. Their values will be replaced with this file's values, not added twice.`
              : `You've already imported a ${type.label.toLowerCase()} for ${overlap.label}. Importing replaces those rows instead of adding to them.`}
          </Notice>
        ) : null}

        {normalized.canImport && !fatalParse ? (
          <Notice tone="success">
            Ready to import {formatCount(rowsReady)} rows
            {normalized.coverage.end
              ? ` covering ${normalized.coverage.start ? formatDay(normalized.coverage.start) : "all time"} – ${formatDay(normalized.coverage.end)}`
              : ""}
            . Metrics found: {normalized.metricsFound.map((metric) => METRICS[metric].label).join(", ")}.
            {normalized.skipped + (parsed.malformedCount ?? 0)
              ? ` ${formatCount(normalized.skipped + (parsed.malformedCount ?? 0))} rows will be skipped (see warnings).`
              : ""}
          </Notice>
        ) : rowsReady === 0 && !allIssues.some((issue) => issue.level === "error") ? (
          <Notice tone="error">No usable rows were found in this file.</Notice>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!normalized.canImport || fatalParse}
            onClick={runImport}
            className={primaryButton}
          >
            Import {formatCount(rowsReady)} rows
          </button>
          <button type="button" onClick={reset} className={secondaryButton}>
            Cancel
          </button>
        </div>
      </div>
    </Panel>
  );
};

export default ImportPanel;
