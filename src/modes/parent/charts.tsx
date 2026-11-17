import { useState, type ReactNode } from 'react';

/**
 * Small inline-SVG charts for the reports (spec §10.4): no chart library.
 * Colours are a validated two-hue categorical pair; text always uses ink.
 */
const SERIES = ['#2a78d6', '#eb6834'] as const;
const W = 640;
const H = 220;
const PAD = { top: 16, right: 16, bottom: 34, left: 36 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

interface Tip {
  x: number;
  y: number;
  text: string;
}

function Frame({
  label,
  yTicks,
  yMax,
  tip,
  children,
}: {
  label: string;
  yTicks: number[];
  yMax: number;
  tip: Tip | null;
  children: ReactNode;
}) {
  const y = (value: number) => PAD.top + PLOT_H - (value / yMax) * PLOT_H;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {yTicks.map((tick) => (
        <g key={tick}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(tick)}
            y2={y(tick)}
            className="chart__grid"
          />
          <text x={PAD.left - 8} y={y(tick) + 4} textAnchor="end" className="chart__axis">
            {tick}
          </text>
        </g>
      ))}
      {children}
      {tip && (
        <g pointerEvents="none">
          <rect
            x={Math.min(Math.max(tip.x - 92, 4), W - 188)}
            y={Math.max(tip.y - 34, 2)}
            width="184"
            height="26"
            rx="6"
            className="chart__tip"
          />
          <text
            x={Math.min(Math.max(tip.x, 96), W - 96)}
            y={Math.max(tip.y - 16, 20)}
            textAnchor="middle"
            className="chart__tip-text"
          >
            {tip.text}
          </text>
        </g>
      )}
    </svg>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="chart-empty">{children}</p>;
}

function Legend({ names }: { names: readonly string[] }) {
  return (
    <div className="chart-legend">
      {names.map((name, i) => (
        <span key={name}>
          <i style={{ background: SERIES[i] }} />
          {name}
        </span>
      ))}
    </div>
  );
}

const shortDate = (ts: number) =>
  new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/** Help opened vs completed per session: two bars per session. */
export function HelpUseChart({
  rows,
}: {
  rows: readonly { ts: number; opened: number; completed: number }[];
}) {
  const [tip, setTip] = useState<Tip | null>(null);
  const data = rows.slice(-12);
  if (data.length === 0)
    return <Empty>No sessions yet. This chart fills in as she practises.</Empty>;
  const yMax = Math.max(4, ...data.map((d) => d.opened));
  const band = PLOT_W / data.length;
  const bar = Math.min(18, band / 2 - 4);
  const y = (value: number) => PAD.top + PLOT_H - (value / yMax) * PLOT_H;
  return (
    <figure className="chart-figure">
      <Legend names={['Help opened', 'Routine completed']} />
      <Frame
        label="Help opened and completed per session"
        yTicks={[0, Math.ceil(yMax / 2), yMax]}
        yMax={yMax}
        tip={tip}
      >
        {data.map((d, i) => {
          const cx = PAD.left + band * (i + 0.5);
          const show = () =>
            setTip({
              x: cx,
              y: y(Math.max(d.opened, d.completed)),
              text: `${shortDate(d.ts)}: ${d.completed} of ${d.opened} completed`,
            });
          return (
            <g
              key={i}
              onPointerEnter={show}
              onPointerDown={show}
              onPointerLeave={() => setTip(null)}
            >
              <rect x={cx - band / 2} y={PAD.top} width={band} height={PLOT_H} fill="transparent" />
              <rect
                x={cx - bar - 1}
                y={y(d.opened)}
                width={bar}
                height={PAD.top + PLOT_H - y(d.opened)}
                rx="3"
                fill={SERIES[0]}
              />
              <rect
                x={cx + 1}
                y={y(d.completed)}
                width={bar}
                height={PAD.top + PLOT_H - y(d.completed)}
                rx="3"
                fill={SERIES[1]}
              />
              {(i === 0 || i === data.length - 1 || data.length <= 6) && (
                <text x={cx} y={H - 12} textAnchor="middle" className="chart__axis">
                  {shortDate(d.ts)}
                </text>
              )}
            </g>
          );
        })}
      </Frame>
    </figure>
  );
}

/** One measure over time as a line with point markers. */
export function TrendChart({
  label,
  points,
  yMax,
  yTicks,
  step = false,
  format,
}: {
  label: string;
  points: readonly { ts: number; value: number }[];
  yMax: number;
  yTicks: number[];
  step?: boolean;
  format: (value: number) => string;
}) {
  const [tip, setTip] = useState<Tip | null>(null);
  if (points.length === 0) return <Empty>Nothing to show yet.</Empty>;
  const x = (i: number) =>
    PAD.left + (points.length === 1 ? PLOT_W / 2 : (i / (points.length - 1)) * PLOT_W);
  const y = (value: number) => PAD.top + PLOT_H - (value / yMax) * PLOT_H;
  const path = points
    .map((p, i) => {
      if (i === 0) return `M${x(i)},${y(p.value)}`;
      return step ? `H${x(i)}V${y(p.value)}` : `L${x(i)},${y(p.value)}`;
    })
    .join('');
  const last = points[points.length - 1];
  return (
    <figure className="chart-figure">
      <Frame label={label} yTicks={yTicks} yMax={yMax} tip={tip}>
        <path d={path} fill="none" stroke={SERIES[0]} strokeWidth="2" strokeLinejoin="round" />
        {points.map((p, i) => {
          const show = () =>
            setTip({ x: x(i), y: y(p.value), text: `${shortDate(p.ts)}: ${format(p.value)}` });
          return (
            <g
              key={i}
              onPointerEnter={show}
              onPointerDown={show}
              onPointerLeave={() => setTip(null)}
            >
              <circle cx={x(i)} cy={y(p.value)} r="14" fill="transparent" />
              <circle
                cx={x(i)}
                cy={y(p.value)}
                r="4.5"
                fill={SERIES[0]}
                stroke="#fffdf8"
                strokeWidth="2"
              />
            </g>
          );
        })}
        {last && (
          <text
            x={Math.min(x(points.length - 1), W - PAD.right - 4)}
            y={y(last.value) - 12}
            textAnchor="end"
            className="chart__value"
          >
            {format(last.value)}
          </text>
        )}
        <text x={PAD.left} y={H - 12} className="chart__axis">
          {shortDate(points[0]?.ts ?? 0)}
        </text>
        {points.length > 1 && last && (
          <text x={W - PAD.right} y={H - 12} textAnchor="end" className="chart__axis">
            {shortDate(last.ts)}
          </text>
        )}
      </Frame>
    </figure>
  );
}
