import { useEffect, useRef, useState } from "react";
import { daysBetween, formatDay } from "../../lib/insights/analytics";
import { formatCompact } from "../../lib/insights/format";

const PLOT_HEIGHT = 220;
const AXIS_HEIGHT = 32;
const PADDING = { top: 20, right: 20, left: 52 };
const LINE_COLOR = "#fb923c";
const SURFACE_COLOR = "#1c1917";

const niceMax = (value) => {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const fraction = value / magnitude;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * magnitude;
};

// Daily line chart for one metric. Days without a value break the line rather
// than being drawn as zero. Every value is also available in the CSV export.
const TrendChart = ({ points, metricLabel, formatValue }) => {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(null);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setActiveIndex(null);
  }, [points]);

  const values = points.filter((point) => point.value !== null);
  if (values.length === 0) {
    return (
      <div ref={containerRef} className="relative w-full">
        <p className="py-16 text-center text-sm text-stone-500">
          No {metricLabel.toLowerCase()} values in this period.
        </p>
      </div>
    );
  }

  const plotWidth = Math.max(0, width - PADDING.left - PADDING.right);
  const first = points[0].date;
  const span = Math.max(1, daysBetween(first, points[points.length - 1].date));
  const yMax = niceMax(Math.max(...values.map((point) => point.value)) * 1.05);
  const xFor = (point) =>
    points.length === 1 ? PADDING.left + plotWidth / 2 : PADDING.left + (daysBetween(first, point.date) / span) * plotWidth;
  const yFor = (value) => PADDING.top + PLOT_HEIGHT - (value / yMax) * PLOT_HEIGHT;

  // Split into segments at missing values or missing days.
  const segments = [];
  let segment = [];
  points.forEach((point, index) => {
    const gap = index > 0 && daysBetween(points[index - 1].date, point.date) > 1;
    if (point.value === null || gap) {
      if (segment.length) segments.push(segment);
      segment = [];
    }
    if (point.value !== null) segment.push(point);
  });
  if (segment.length) segments.push(segment);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => fraction * yMax);
  const labelCount = Math.max(2, Math.min(6, Math.floor(plotWidth / 110)));
  const labelIndexes = [...new Set(Array.from({ length: labelCount }, (_, i) => Math.round((i * (points.length - 1)) / (labelCount - 1))))];
  const active = activeIndex === null ? null : points[activeIndex];
  const svgHeight = PADDING.top + PLOT_HEIGHT + AXIS_HEIGHT;

  const nearestIndex = (x) => {
    let nearest = 0;
    points.forEach((point, index) => {
      if (Math.abs(xFor(point) - x) < Math.abs(xFor(points[nearest]) - x)) nearest = index;
    });
    return nearest;
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {width > 0 ? (
        <svg
          width={width}
          height={svgHeight}
          role="img"
          tabIndex={0}
          aria-label={`${metricLabel} per day from ${formatDay(first)} to ${formatDay(points[points.length - 1].date)}. Use the left and right arrow keys to read each day.`}
          onPointerMove={(event) => setActiveIndex(nearestIndex(event.clientX - event.currentTarget.getBoundingClientRect().left))}
          onPointerLeave={() => setActiveIndex(null)}
          onFocus={() => setActiveIndex(points.length - 1)}
          onBlur={() => setActiveIndex(null)}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              const step = event.key === "ArrowLeft" ? -1 : 1;
              setActiveIndex((current) => Math.min(points.length - 1, Math.max(0, (current ?? points.length - 1) + step)));
            }
          }}
          className="block touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/60"
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={PADDING.left} x2={width - PADDING.right} y1={yFor(tick)} y2={yFor(tick)} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
              <text x={PADDING.left - 10} y={yFor(tick)} textAnchor="end" dominantBaseline="middle" className="fill-stone-400 text-[11px] tabular-nums">
                {formatCompact(tick)}
              </text>
            </g>
          ))}

          {labelIndexes.map((index, position) => (
            <text
              key={points[index].date}
              x={xFor(points[index])}
              y={PADDING.top + PLOT_HEIGHT + 20}
              textAnchor={labelIndexes.length === 1 ? "middle" : position === 0 ? "start" : position === labelIndexes.length - 1 ? "end" : "middle"}
              className="fill-stone-400 text-[11px]"
            >
              {formatDay(points[index].date)}
            </text>
          ))}

          {active ? (
            <line x1={xFor(active)} x2={xFor(active)} y1={PADDING.top} y2={PADDING.top + PLOT_HEIGHT} stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
          ) : null}

          {segments.map((part) =>
            part.length === 1 ? (
              <circle key={part[0].date} cx={xFor(part[0])} cy={yFor(part[0].value)} r="3" fill={LINE_COLOR} />
            ) : (
              <path
                key={part[0].date}
                d={part.map((point, index) => `${index === 0 ? "M" : "L"}${xFor(point)},${yFor(point.value)}`).join(" ")}
                fill="none"
                stroke={LINE_COLOR}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )
          )}

          {active && active.value !== null ? (
            <circle cx={xFor(active)} cy={yFor(active.value)} r="5" fill={LINE_COLOR} stroke={SURFACE_COLOR} strokeWidth="2" />
          ) : null}
        </svg>
      ) : (
        <div style={{ height: svgHeight }} />
      )}

      {active ? (
        <div
          className="pointer-events-none absolute z-10 rounded-xl border border-white/10 bg-stone-900 px-3 py-2 shadow-lg"
          style={{
            left: Math.min(Math.max(xFor(active), 70), width - 70),
            top: active.value === null ? PADDING.top : Math.max(0, yFor(active.value) - 64),
            transform: "translateX(-50%)",
          }}
        >
          <p className="whitespace-nowrap text-sm font-semibold text-white">
            {active.value === null ? "No data" : formatValue(active.value)}
          </p>
          <p className="mt-0.5 flex items-center gap-2 whitespace-nowrap text-xs text-stone-400">
            <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: LINE_COLOR }} />
            {metricLabel} · {formatDay(active.date)}
          </p>
        </div>
      ) : null}
    </div>
  );
};

export default TrendChart;
