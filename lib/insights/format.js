// Display formatting for Insights. Missing values show as "—", never 0.

export const formatCount = (value) =>
  value === null || value === undefined ? "—" : new Intl.NumberFormat("en-IN").format(Math.round(value));

export const formatCompact = (value) =>
  value === null || value === undefined
    ? "—"
    : new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(value);

export const formatRatio = (value) =>
  value === null || value === undefined ? "—" : value.toFixed(2);

export const formatPercent = (value) => {
  const rounded = Math.abs(value) < 10 ? value.toFixed(1) : Math.round(value).toString();
  return `${value > 0 ? "+" : ""}${rounded}%`;
};

export const formatTimestamp = (iso) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export const formatBytes = (bytes) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
