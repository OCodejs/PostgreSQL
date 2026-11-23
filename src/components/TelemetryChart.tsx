import React, { useState } from 'react';

interface SeriesConfig {
  label: string;
  color: string;
  values: number[];
  unit: string;
}

interface TelemetryChartProps {
  title: string;
  timestamps: string[];
  primary: SeriesConfig;
  secondary?: SeriesConfig;
}

export const TelemetryChart: React.FC<TelemetryChartProps> = ({
  title,
  timestamps,
  primary,
  secondary,
}) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const width = 560;
  const height = 180;
  const padX = 36;
  const padY = 18;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const buildPath = (vals: number[]) => {
    const min = Math.min(...vals) * 0.88;
    const max = Math.max(...vals) * 1.12 || 1;
    const span = max - min || 1;

    const coords = vals.map((v, i) => {
      const x = padX + (vals.length > 1 ? (i / (vals.length - 1)) * innerW : innerW / 2);
      const y = padY + innerH - ((v - min) / span) * innerH;
      return { x, y, v };
    });

    const line = coords
      .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
      .join(' ');
    const area = `${line} L ${coords[coords.length - 1].x.toFixed(1)} ${(padY + innerH).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(padY + innerH).toFixed(1)} Z`;

    return { coords, line, area, min, max };
  };

  const p1 = buildPath(primary.values);
  const p2 = secondary ? buildPath(secondary.values) : null;
  const activeIdx = hoverIdx !== null ? hoverIdx : timestamps.length - 1;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h3>
        <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
          <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
            <span className="w-2.5 h-0.5 inline-block" style={{ backgroundColor: primary.color }} />
            {primary.label}: <strong className="text-slate-900 dark:text-white">{primary.values[activeIdx]}{primary.unit}</strong>
          </span>
          {secondary && (
            <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
              <span className="w-2.5 h-0.5 inline-block" style={{ backgroundColor: secondary.color }} />
              {secondary.label}: <strong className="text-slate-900 dark:text-white">{secondary.values[activeIdx]}{secondary.unit}</strong>
            </span>
          )}
        </div>
      </div>

      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-44 select-none"
          role="img"
          aria-label={title}
        >
          {[0.25, 0.5, 0.75, 1].map((step) => {
            const y = padY + innerH * (1 - step);
            return (
              <line
                key={step}
                x1={padX}
                y1={y}
                x2={width - padX}
                y2={y}
                stroke="currentColor"
                className="text-slate-100 dark:text-slate-800"
                strokeWidth="1"
              />
            );
          })}

          <path d={p1.area} fill={primary.color} fillOpacity="0.09" />
          <path d={p1.line} fill="none" stroke={primary.color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />

          {p2 && (
            <path
              d={p2.line}
              fill="none"
              stroke={secondary!.color}
              strokeWidth="2"
              strokeDasharray="4 3"
              strokeLinecap="round"
            />
          )}

          {p1.coords.map((pt, i) => {
            const isHovered = i === activeIdx;
            return (
              <g key={timestamps[i]}>
                <rect
                  x={pt.x - innerW / (timestamps.length * 2)}
                  y={0}
                  width={innerW / timestamps.length}
                  height={height}
                  fill="transparent"
                  className="cursor-crosshair"
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx(null)}
                />
                {isHovered && (
                  <>
                    <line
                      x1={pt.x}
                      y1={padY}
                      x2={pt.x}
                      y2={padY + innerH}
                      stroke="currentColor"
                      className="text-slate-300 dark:text-slate-700"
                      strokeWidth="1"
                    />
                    <circle cx={pt.x} cy={pt.y} r="4" fill={primary.color} />
                    {p2 && p2.coords[i] && (
                      <circle cx={p2.coords[i].x} cy={p2.coords[i].y} r="3.5" fill={secondary!.color} />
                    )}
                  </>
                )}
              </g>
            );
          })}

          {timestamps.map((ts, i) => {
            if (i !== 0 && i !== Math.floor(timestamps.length / 2) && i !== timestamps.length - 1) {
              return null;
            }
            const x = p1.coords[i]?.x ?? padX;
            return (
              <text
                key={ts}
                x={x}
                y={height - 2}
                textAnchor="middle"
                className="fill-slate-400 dark:fill-slate-500 text-[10px] font-mono"
              >
                {ts}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
