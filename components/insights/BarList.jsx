import { formatCount } from "../../lib/insights/format";

// Ranked horizontal bars: one hue, length encodes the value, and every value
// is printed as text so nothing depends on reading the bar alone.
const BarList = ({ items, valueLabel, onSelect, emptyText = "No data." }) => {
  const withValues = items.filter((item) => item.value !== null && item.value !== undefined);
  if (withValues.length === 0) {
    return <p className="text-sm text-stone-500">{emptyText}</p>;
  }

  const max = Math.max(...withValues.map((item) => item.value), 1);

  return (
    <ol className="space-y-3" aria-label={valueLabel}>
      {withValues.map((item, index) => {
        const content = (
          <>
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span className="min-w-0 truncate text-stone-200">
                <span className="mr-2 tabular-nums text-stone-500">{index + 1}</span>
                {item.label}
                {item.sublabel ? <span className="text-stone-500"> · {item.sublabel}</span> : null}
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-white">
                {formatCount(item.value)}
                {item.share !== undefined ? (
                  <span className="ml-2 font-normal text-stone-400">{item.share.toFixed(1)}%</span>
                ) : null}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-orange-400"
                style={{ width: `${Math.max(1, (item.value / max) * 100)}%` }}
              />
            </div>
          </>
        );

        return (
          <li key={item.key}>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(item.key)}
                className="block w-full rounded-lg text-left transition hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/60"
              >
                {content}
              </button>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ol>
  );
};

export default BarList;
