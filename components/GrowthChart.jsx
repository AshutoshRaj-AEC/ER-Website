import { useEffect, useRef, useState } from "react";
import { formatCompact, formatMonth, monthIndex } from "../lib/growth";

const PLOT_HEIGHT = 220;
const AXIS_HEIGHT = 32;
const PADDING = { top: 24, right: 24, left: 56 };
const LINE_COLOR = "#fb923c";
const SURFACE_COLOR = "#1c1917";

const niceMax = (value) => {
  if (value <= 0) {
    return 1;
  }
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const fraction = value / magnitude;
  const nice =
    fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * magnitude;
};

// One series over time with an optional goal line. Every value is also in the
// history table, so the tooltip never gates information.
const GrowthChart = ({ series, goal, label, formatValue }) => {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(null);

  useEffect(() => {
    const element = containerRef.current;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setActiveIndex(null);
  }, [series]);

  const plotWidth = Math.max(0, width - PADDING.left - PADDING.right);
  const indexes = series.map((point) => monthIndex(point.month));
  const firstIndex = Math.min(...indexes);
  const span = Math.max(...indexes) - firstIndex;
  const yMax = niceMax(Math.max(...series.map((point) => point.value), goal ?? 0) * 1.05);

  const xFor = (point) =>
    span === 0
      ? PADDING.left + plotWidth / 2
      : PADDING.left + ((monthIndex(point.month) - firstIndex) / span) * plotWidth;
  const yFor = (value) => PADDING.top + PLOT_HEIGHT - (value / yMax) * PLOT_HEIGHT;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => fraction * yMax);
  const labelEvery = Math.max(1, Math.ceil(series.length / Math.max(2, Math.floor(plotWidth / 90))));
  const path = series
    .map((point, index) => `${index === 0 ? "M" : "L"}${xFor(point)},${yFor(point.value)}`)
    .join(" ");

  const latest = series[series.length - 1];
  const active = activeIndex === null ? null : series[activeIndex];

  const handlePointerMove = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerX = event.clientX - bounds.left;
    let nearest = 0;
    series.forEach((point, index) => {
      if (Math.abs(xFor(point) - pointerX) < Math.abs(xFor(series[nearest]) - pointerX)) {
        nearest = index;
      }
    });
    setActiveIndex(nearest);
  };

  const handleKeyDown = (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const step = event.key === "ArrowLeft" ? -1 : 1;
      setActiveIndex((current) =>
        Math.min(series.length - 1, Math.max(0, (current ?? series.length - 1) + step))
      );
    }
  };

  const svgHeight = PADDING.top + PLOT_HEIGHT + AXIS_HEIGHT;

  return (
    <div ref={containerRef} className="relative w-full">
      {width > 0 ? (
        <svg
          width={width}
          height={svgHeight}
          role="img"
          aria-label={`${label}. Latest: ${formatValue(latest.value)} in ${formatMonth(latest.month)}. Use the left and right arrow keys to read each month.`}
          tabIndex={0}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setActiveIndex(null)}
          onFocus={() => setActiveIndex(series.length - 1)}
          onBlur={() => setActiveIndex(null)}
          onKeyDown={handleKeyDown}
          className="block touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/60"
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PADDING.left}
                x2={width - PADDING.right}
                y1={yFor(tick)}
                y2={yFor(tick)}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="1"
              />
              <text
                x={PADDING.left - 10}
                y={yFor(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-stone-400 text-[11px] tabular-nums"
              >
                {formatCompact(tick)}
              </text>
            </g>
          ))}

          {series.map((point, index) =>
            index % labelEvery === 0 || index === series.length - 1 ? (
              <text
                key={point.month}
                x={xFor(point)}
                y={PADDING.top + PLOT_HEIGHT + 20}
                textAnchor={span === 0 ? "middle" : index === 0 ? "start" : index === series.length - 1 ? "end" : "middle"}
                className="fill-stone-400 text-[11px]"
              >
                {formatMonth(point.month)}
              </text>
            ) : null
          )}

          {goal ? (
            <g>
              <line
                x1={PADDING.left}
                x2={width - PADDING.right}
                y1={yFor(goal)}
                y2={yFor(goal)}
                stroke="#a8a29e"
                strokeWidth="1.5"
                strokeDasharray="6 5"
              />
              <text
                x={width - PADDING.right}
                y={yFor(goal) - 8}
                textAnchor="end"
                className="fill-stone-300 text-[11px] font-semibold"
              >
                Goal · {formatValue(goal)}
              </text>
            </g>
          ) : null}

          {active ? (
            <line
              x1={xFor(active)}
              x2={xFor(active)}
              y1={PADDING.top}
              y2={PADDING.top + PLOT_HEIGHT}
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="1"
            />
          ) : null}

          <path d={path} fill="none" stroke={LINE_COLOR} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

          {series.map((point, index) => (
            <circle
              key={point.month}
              cx={xFor(point)}
              cy={yFor(point.value)}
              r={index === activeIndex ? 6 : 4}
              fill={LINE_COLOR}
              stroke={SURFACE_COLOR}
              strokeWidth="2"
            />
          ))}

          {active ? null : (
            <text
              x={xFor(latest)}
              y={yFor(latest.value) - 12}
              textAnchor={span === 0 ? "middle" : "end"}
              className="fill-stone-100 text-[12px] font-semibold"
            >
              {formatValue(latest.value)}
            </text>
          )}
        </svg>
      ) : (
        <div style={{ height: svgHeight }} />
      )}

      {active ? (
        <div
          className="pointer-events-none absolute z-10 rounded-xl border border-white/10 bg-stone-900 px-3 py-2 shadow-lg"
          style={{
            left: Math.min(Math.max(xFor(active), 70), width - 70),
            top: Math.max(0, yFor(active.value) - 64),
            transform: "translateX(-50%)",
          }}
        >
          <p className="whitespace-nowrap text-sm font-semibold text-white">
            {formatValue(active.value)}
          </p>
          <p className="mt-0.5 flex items-center gap-2 whitespace-nowrap text-xs text-stone-400">
            <span className="inline-block h-0.5 w-3 rounded-full" style={{ background: LINE_COLOR }} />
            {formatMonth(active.month)}
          </p>
        </div>
      ) : null}
    </div>
  );
};

export default GrowthChart;
