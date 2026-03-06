import { useRef, useState, useEffect } from 'react';

type Series = { label: string; values: number[]; color?: string };

type LineChartProps = {
  width?: number;
  height?: number;
  labels: string[];
  series: Series[];
  yAxisLabel?: string;
  valueFormat?: (v: number) => string;
  showHover?: boolean;
};

const CHART_WIDTH = 640;
const CHART_HEIGHT = 260;
const PAD = { left: 48, right: 16, top: 12, bottom: 28 };

export default function LineChart({
  width = CHART_WIDTH,
  height = CHART_HEIGHT,
  labels,
  series,
  yAxisLabel,
  valueFormat = (v) => String(v),
  showHover = true,
}: LineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dim, setDim] = useState({ w: width, h: height });
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const onResize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) setDim({ w: rect.width, h: Math.min(rect.height, 320) });
    };
    onResize();
    const ro = new ResizeObserver(onResize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const w = Math.max(0, dim.w - PAD.left - PAD.right);
  const h = Math.max(0, dim.h - PAD.top - PAD.bottom);
  const n = labels.length;
  if (n === 0 || series.length === 0 || series.every((s) => s.values.length === 0)) {
    return (
      <div ref={containerRef} style={{ width: '100%', minHeight: 200, background: 'var(--gh-bg-primary)', borderRadius: 8 }}>
        <p style={{ padding: 24, color: 'var(--text-dim)' }}>暂无数据</p>
      </div>
    );
  }

  const allValues = series.flatMap((s) => s.values);
  const minY = Math.min(...allValues);
  const maxY = Math.max(...allValues);
  const range = maxY - minY || 1;
  const getX = (i: number) => (n > 1 ? PAD.left + (i / (n - 1)) * w : PAD.left + w / 2);
  const getY = (v: number) => PAD.top + h * (1 - (v - minY) / range);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!showHover) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const vx = e.clientX - rect.left;
    const wx = (vx / rect.width) * dim.w;
    let i = Math.round(((wx - PAD.left) / w) * (n - 1));
    i = Math.max(0, Math.min(n - 1, i));
    setHoverIdx(i);
  };

  return (
    <div ref={containerRef} style={{ width: '100%', minHeight: 200, position: 'relative' }}>
      <svg
        width={dim.w}
        height={dim.h}
        style={{ display: 'block', cursor: showHover ? 'crosshair' : 'default' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {/* 网格线 */}
        {[0.25, 0.5, 0.75].map((t) => (
          <line
            key={`h-${t}`}
            x1={PAD.left}
            y1={PAD.top + h * (1 - t)}
            x2={PAD.left + w}
            y2={PAD.top + h * (1 - t)}
            stroke="var(--border)"
            strokeWidth={1}
            opacity={0.5}
          />
        ))}
        {[0.33, 0.66].map((t, k) => (
          <line
            key={`v-${k}`}
            x1={PAD.left + w * t}
            y1={PAD.top}
            x2={PAD.left + w * t}
            y2={PAD.top + h}
            stroke="var(--border)"
            strokeWidth={1}
            opacity={0.5}
          />
        ))}
        {/* 折线 */}
        {series.map((s, si) => {
          const vals = s.values.length === n ? s.values : [];
          const color = s.color || (si === 0 ? 'var(--accent)' : si === 1 ? 'var(--up-color)' : 'var(--down-color)');
          const points = vals.map((v, i) => `${getX(i)},${getY(v)}`).join(' ');
          return (
            <g key={si}>
              <polyline
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
              />
              {showHover && hoverIdx !== null && vals[hoverIdx] != null && (
                <circle
                  r={4}
                  cx={getX(hoverIdx)}
                  cy={getY(vals[hoverIdx])}
                  fill={color}
                  stroke="var(--card-bg)"
                  strokeWidth={2}
                />
              )}
            </g>
          );
        })}
        {/* X 轴刻度 */}
        {[0, Math.floor(n / 2), n - 1].filter((i) => i >= 0 && i < n).map((i) => (
          <text key={`x-${i}`} x={getX(i)} y={dim.h - 4} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fill="var(--text-dim)" style={{ fontSize: 'var(--font-size-sm)' }}>
            {labels[i]}
          </text>
        ))}
        {/* Y 轴刻度 */}
        {[minY, (minY + maxY) / 2, maxY].map((v, i) => (
          <text key={`y-${i}`} x={PAD.left - 6} y={getY(v) + 4} textAnchor="end" fill="var(--text-dim)" style={{ fontSize: 'var(--font-size-sm)' }}>
            {valueFormat(v)}
          </text>
        ))}
        {yAxisLabel && (
          <text x={PAD.left - 6} y={10} textAnchor="end" fill="var(--text-dim)" style={{ fontSize: 'var(--font-size-sm)' }}>
            {yAxisLabel}
          </text>
        )}
        {/* 悬停竖线 */}
        {showHover && hoverIdx !== null && n > 0 && (
          <line
            x1={getX(hoverIdx)}
            y1={PAD.top}
            x2={getX(hoverIdx)}
            y2={PAD.top + h}
            stroke="var(--accent)"
            strokeDasharray="3 3"
            opacity={0.7}
          />
        )}
      </svg>
      {/* 悬停提示：显示在图表下方 */}
      {showHover && hoverIdx !== null && labels[hoverIdx] != null && (
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '6px 12px',
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            fontSize: 'var(--font-size-sm)',
            zIndex: 10,
            pointerEvents: 'none',
            display: 'flex',
            gap: 12,
            alignItems: 'center',
          }}
        >
          <span style={{ color: 'var(--text-dim)' }}>{labels[hoverIdx]}</span>
          {series.map((s, si) => (
            <span key={si} style={{ color: s.color || 'var(--text-main)' }}>
              {s.label}: {s.values[hoverIdx] != null ? valueFormat(s.values[hoverIdx]) : '—'}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
