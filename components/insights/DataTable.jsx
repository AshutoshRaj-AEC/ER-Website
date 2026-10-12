import { useEffect, useMemo, useState } from "react";
import { fieldClass } from "../AutoSaveField";
import { paginate, searchRows, sortRows } from "../../lib/insights/analytics";
import { downloadCsv, safeFileName, toCsv } from "../../lib/insights/exportCsv";

const PAGE_SIZE = 25;

// Searchable, sortable, paginated table. "Download CSV" exports every row that
// matches the current search, in the current sort order, not just one page.
const DataTable = ({
  columns,
  rows,
  searchFields,
  searchPlaceholder = "Search",
  defaultSort,
  onRowClick,
  exportName,
  caption,
  emptyText = "No rows match.",
}) => {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(defaultSort);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [query, rows]);

  const filtered = useMemo(
    () => sortRows(searchRows(rows, query, searchFields), sort.key, sort.direction),
    [rows, query, searchFields, sort]
  );
  const current = paginate(filtered, page, PAGE_SIZE);

  const toggleSort = (key) => {
    setSort((previous) =>
      previous.key === key
        ? { key, direction: previous.direction === "desc" ? "asc" : "desc" }
        : { key, direction: columns.find((column) => column.key === key)?.numeric ? "desc" : "asc" }
    );
  };

  const exportRows = () => {
    const exportColumns = columns.map((column) => ({ key: column.key, label: column.exportLabel ?? column.label }));
    const exportData = filtered.map((row) =>
      Object.fromEntries(columns.map((column) => [column.key, column.exportValue ? column.exportValue(row) : row[column.key]]))
    );
    downloadCsv(`${safeFileName(exportName)}.csv`, toCsv(exportColumns, exportData));
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="sm:w-72">
          <span className="sr-only">{searchPlaceholder}</span>
          <input
            type="search"
            placeholder={searchPlaceholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={fieldClass}
          />
        </label>
        <button
          type="button"
          onClick={exportRows}
          disabled={filtered.length === 0}
          className="rounded-full border border-white/15 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-stone-200 transition hover:border-orange-300 hover:text-orange-200 disabled:opacity-40"
        >
          Download CSV ({filtered.length})
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-stone-500">{emptyText}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[640px] text-left text-sm">
            {caption ? <caption className="sr-only">{caption}</caption> : null}
            <thead className="bg-white/5">
              <tr>
                {columns.map((column) => {
                  const sorted = sort.key === column.key;
                  return (
                    <th
                      key={column.key}
                      scope="col"
                      aria-sort={sorted ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
                      className={`px-4 py-3 ${column.numeric ? "text-right" : ""}`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        title={column.definition}
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.2em] transition hover:text-orange-200 ${sorted ? "text-orange-200" : "text-stone-400"}`}
                      >
                        {column.label}
                        <span aria-hidden="true">{sorted ? (sort.direction === "asc" ? "↑" : "↓") : ""}</span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {current.rows.map((row) => (
                <tr
                  key={row.key}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`border-t border-white/5 ${onRowClick ? "cursor-pointer transition hover:bg-white/5" : ""}`}
                >
                  {columns.map((column, index) => (
                    <td
                      key={column.key}
                      className={`px-4 py-3 ${column.numeric ? "text-right tabular-nums text-stone-200" : "text-stone-200"}`}
                    >
                      {index === 0 && onRowClick ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onRowClick(row);
                          }}
                          className="text-left font-semibold text-white hover:text-orange-200 focus:outline-none focus-visible:underline"
                        >
                          {column.format ? column.format(row) : row[column.key]}
                        </button>
                      ) : column.format ? (
                        column.format(row)
                      ) : (
                        row[column.key] ?? "—"
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {current.pageCount > 1 ? (
        <div className="mt-4 flex items-center justify-between gap-4 text-sm text-stone-400">
          <span>
            {(current.page - 1) * PAGE_SIZE + 1}–{Math.min(current.page * PAGE_SIZE, current.total)} of{" "}
            {current.total.toLocaleString("en-IN")}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={current.page === 1}
              onClick={() => setPage(current.page - 1)}
              className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={current.page === current.pageCount}
              onClick={() => setPage(current.page + 1)}
              className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default DataTable;
