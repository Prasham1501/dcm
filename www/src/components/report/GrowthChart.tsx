/**
 * GrowthChart — SVG-based fetal biometry growth chart.
 * Renders Hadlock percentile curves (5th, 50th, 95th) with the measured value plotted.
 * Used in InlineReportPanel for interactive display.
 */
import { useMemo } from 'react';
import {
  BPD_TABLE, HC_TABLE, AC_TABLE, FL_TABLE, EFW_TABLE,
} from '@/lib/usgExtraction/obCalculations';

// ── Chart configuration ──────────────────────────────────────

interface ChartConfig {
  label: string;
  unit: string;
  table: [number, number, number][];
  color: string;       // accent for plotted point
  curveColor: string;  // percentile curves
}

const CHART_CONFIGS: Record<string, ChartConfig> = {
  BPD: { label: 'BPD', unit: 'cm', table: BPD_TABLE, color: '#3b82f6', curveColor: '#93c5fd' },
  HC:  { label: 'HC',  unit: 'cm', table: HC_TABLE,  color: '#8b5cf6', curveColor: '#c4b5fd' },
  AC:  { label: 'AC',  unit: 'cm', table: AC_TABLE,  color: '#f59e0b', curveColor: '#fcd34d' },
  FL:  { label: 'FL',  unit: 'cm', table: FL_TABLE,  color: '#10b981', curveColor: '#6ee7b7' },
  EFW: { label: 'EFW', unit: 'g',  table: EFW_TABLE, color: '#ef4444', curveColor: '#fca5a5' },
};

// ── Props ────────────────────────────────────────────────────

export interface GrowthChartPoint {
  key: string;        // BPD, HC, AC, FL, EFW
  value: number;
  gaWeeks: number;     // fractional GA at which measurement was taken
  percentile?: number | null;
}

interface GrowthChartProps {
  points: GrowthChartPoint[];
  /** Width of each mini chart (px). Default: 200 */
  chartWidth?: number;
  /** Height of each mini chart (px). Default: 140 */
  chartHeight?: number;
}

// ── Standard normal inverse (z from percentile) ──────────────

function normalCDFInv(p: number): number {
  // Rational approximation (Abramowitz & Stegun 26.2.23)
  if (p <= 0) return -6;
  if (p >= 1) return 6;
  if (p === 0.5) return 0;
  const sign = p < 0.5 ? -1 : 1;
  const pp = p < 0.5 ? p : 1 - p;
  const t = Math.sqrt(-2 * Math.log(pp));
  const c0 = 2.515517, c1 = 0.802853, c2 = 0.010328;
  const d1 = 1.432788, d2 = 0.189269, d3 = 0.001308;
  return sign * (t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t));
}

// z-scores for 5th, 50th, 95th percentile
const Z5  = normalCDFInv(0.05);   // ≈ -1.645
const Z50 = 0;
const Z95 = normalCDFInv(0.95);   // ≈ +1.645

// ── Helper: generate percentile curve data ──────────────────

function getCurveValues(table: [number, number, number][], z: number): { ga: number; val: number }[] {
  return table.map(([ga, mean, sd]) => ({ ga, val: mean + z * sd }));
}

// ── Single chart renderer ───────────────────────────────────

function SingleChart({
  config,
  point,
  width,
  height,
}: {
  config: ChartConfig;
  point: GrowthChartPoint;
  width: number;
  height: number;
}) {
  const pad = { top: 20, right: 12, bottom: 24, left: 32 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const { table, color, curveColor, label, unit } = config;

  // Get percentile curves
  const p5  = useMemo(() => getCurveValues(table, Z5), [table]);
  const p50 = useMemo(() => getCurveValues(table, Z50), [table]);
  const p95 = useMemo(() => getCurveValues(table, Z95), [table]);

  // Determine axis ranges
  const gaMin = table[0][0];
  const gaMax = table[table.length - 1][0];
  const allVals = [...p5, ...p95].map(d => d.val);
  const valMin = Math.min(...allVals) * 0.9;
  const valMax = Math.max(...allVals) * 1.1;

  // Scale functions
  const xScale = (ga: number) => pad.left + ((ga - gaMin) / (gaMax - gaMin)) * plotW;
  const yScale = (val: number) => pad.top + plotH - ((val - valMin) / (valMax - valMin)) * plotH;

  // Build SVG path from data
  const pathFromData = (data: { ga: number; val: number }[]) =>
    data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(d.ga).toFixed(1)},${yScale(d.val).toFixed(1)}`).join(' ');

  // Fill path between p5 and p95
  const fillPath = useMemo(() => {
    const top = p95.map(d => `${xScale(d.ga).toFixed(1)},${yScale(d.val).toFixed(1)}`);
    const bot = [...p5].reverse().map(d => `${xScale(d.ga).toFixed(1)},${yScale(d.val).toFixed(1)}`);
    return `M${top.join(' L')} L${bot.join(' L')} Z`;
  }, [p5, p95, xScale, yScale]);

  // Plotted measurement point
  const px = xScale(point.gaWeeks);
  const py = yScale(point.value);
  const inRange = point.gaWeeks >= gaMin && point.gaWeeks <= gaMax;

  // Clamp point to visible area
  const clampedPx = Math.max(pad.left, Math.min(pad.left + plotW, px));
  const clampedPy = Math.max(pad.top, Math.min(pad.top + plotH, py));

  // GA axis ticks (every 4 weeks)
  const gaTicks: number[] = [];
  for (let g = Math.ceil(gaMin / 4) * 4; g <= gaMax; g += 4) gaTicks.push(g);

  // Value axis ticks (5 ticks)
  const valRange = valMax - valMin;
  const valStep = valRange / 4;
  const valTicks: number[] = [];
  for (let i = 0; i <= 4; i++) valTicks.push(valMin + i * valStep);

  // Percentile text
  const pctText = point.percentile != null ? `${point.percentile}%ile` : '';
  const isNormal = point.percentile != null && point.percentile >= 10 && point.percentile <= 90;
  const dotColor = point.percentile != null
    ? (point.percentile < 3 || point.percentile > 97 ? '#dc2626' : point.percentile < 10 || point.percentile > 90 ? '#d97706' : '#16a34a')
    : color;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="flex-shrink-0">
      {/* Title */}
      <text x={width / 2} y={12} textAnchor="middle" fontSize="10" fontWeight="bold" fill="currentColor" className="text-app-text">
        {label} ({unit})
      </text>

      {/* Filled region between 5th-95th */}
      <path d={fillPath} fill={curveColor} opacity={0.15} />

      {/* Grid lines */}
      {gaTicks.map(g => (
        <line key={`gx${g}`} x1={xScale(g)} y1={pad.top} x2={xScale(g)} y2={pad.top + plotH}
          stroke="currentColor" strokeOpacity={0.08} strokeWidth={0.5} />
      ))}
      {valTicks.map((v, i) => (
        <line key={`vy${i}`} x1={pad.left} y1={yScale(v)} x2={pad.left + plotW} y2={yScale(v)}
          stroke="currentColor" strokeOpacity={0.08} strokeWidth={0.5} />
      ))}

      {/* Percentile curves */}
      <path d={pathFromData(p5)} fill="none" stroke={curveColor} strokeWidth={1} strokeDasharray="3,2" />
      <path d={pathFromData(p50)} fill="none" stroke={curveColor} strokeWidth={1.5} />
      <path d={pathFromData(p95)} fill="none" stroke={curveColor} strokeWidth={1} strokeDasharray="3,2" />

      {/* Curve labels (right edge) */}
      <text x={pad.left + plotW + 1} y={yScale(p5[p5.length - 1].val)} fontSize="7" fill={curveColor} dominantBaseline="middle">5th</text>
      <text x={pad.left + plotW + 1} y={yScale(p50[p50.length - 1].val)} fontSize="7" fill={curveColor} dominantBaseline="middle">50th</text>
      <text x={pad.left + plotW + 1} y={yScale(p95[p95.length - 1].val)} fontSize="7" fill={curveColor} dominantBaseline="middle">95th</text>

      {/* X axis ticks + labels */}
      {gaTicks.map(g => (
        <g key={`xt${g}`}>
          <line x1={xScale(g)} y1={pad.top + plotH} x2={xScale(g)} y2={pad.top + plotH + 3} stroke="currentColor" strokeOpacity={0.3} strokeWidth={0.5} />
          <text x={xScale(g)} y={pad.top + plotH + 12} textAnchor="middle" fontSize="7" fill="currentColor" opacity={0.5}>{g}</text>
        </g>
      ))}
      <text x={pad.left + plotW / 2} y={height - 2} textAnchor="middle" fontSize="7" fill="currentColor" opacity={0.4}>GA (weeks)</text>

      {/* Y axis ticks + labels */}
      {valTicks.map((v, i) => (
        <g key={`yt${i}`}>
          <line x1={pad.left - 3} y1={yScale(v)} x2={pad.left} y2={yScale(v)} stroke="currentColor" strokeOpacity={0.3} strokeWidth={0.5} />
          <text x={pad.left - 5} y={yScale(v)} textAnchor="end" fontSize="7" fill="currentColor" opacity={0.5} dominantBaseline="middle">
            {unit === 'g' ? Math.round(v) : v.toFixed(1)}
          </text>
        </g>
      ))}

      {/* Axes */}
      <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + plotH} stroke="currentColor" strokeOpacity={0.2} strokeWidth={0.5} />
      <line x1={pad.left} y1={pad.top + plotH} x2={pad.left + plotW} y2={pad.top + plotH} stroke="currentColor" strokeOpacity={0.2} strokeWidth={0.5} />

      {/* Measurement crosshair */}
      {inRange && (
        <>
          <line x1={clampedPx} y1={pad.top} x2={clampedPx} y2={pad.top + plotH}
            stroke={dotColor} strokeWidth={0.5} strokeDasharray="2,2" opacity={0.4} />
          <line x1={pad.left} y1={clampedPy} x2={pad.left + plotW} y2={clampedPy}
            stroke={dotColor} strokeWidth={0.5} strokeDasharray="2,2" opacity={0.4} />
        </>
      )}

      {/* Plotted point */}
      <circle cx={clampedPx} cy={clampedPy} r={4} fill={dotColor} stroke="white" strokeWidth={1.5} />

      {/* Value label near point */}
      <text
        x={clampedPx + (clampedPx > pad.left + plotW / 2 ? -6 : 6)}
        y={clampedPy - 8}
        textAnchor={clampedPx > pad.left + plotW / 2 ? 'end' : 'start'}
        fontSize="8"
        fontWeight="bold"
        fill={dotColor}
      >
        {unit === 'g' ? Math.round(point.value) : point.value}{pctText ? ` (${pctText})` : ''}
      </text>
    </svg>
  );
}

// ── Main component: renders a row of mini charts ────────────

export function GrowthChartPanel({ points, chartWidth = 200, chartHeight = 140 }: GrowthChartProps) {
  if (points.length === 0) return null;

  return (
    <div className="border-b border-app-border bg-app-surface/30 shrink-0">
      <div className="px-3 py-1 text-[10px] font-semibold text-app-text-secondary uppercase tracking-wide border-b border-app-border/50">
        Growth Charts — Hadlock Reference
      </div>
      <div className="flex overflow-x-auto gap-1 px-2 py-1.5">
        {points.map(pt => {
          const cfg = CHART_CONFIGS[pt.key];
          if (!cfg) return null;
          return (
            <SingleChart
              key={pt.key}
              config={cfg}
              point={pt}
              width={chartWidth}
              height={chartHeight}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Static SVG generator for HTML report ────────────────────

/**
 * Generate a static SVG string for embedding in the HTML report.
 * Uses inline styles for print compatibility (no Tailwind classes).
 */
export function generateGrowthChartSVG(
  points: GrowthChartPoint[],
  chartWidth = 200,
  chartHeight = 150,
): string {
  if (points.length === 0) return '';

  const charts = points
    .map(pt => {
      const cfg = CHART_CONFIGS[pt.key];
      if (!cfg) return '';
      return renderStaticChart(cfg, pt, chartWidth, chartHeight);
    })
    .filter(Boolean);

  if (charts.length === 0) return '';

  return `
<div style="margin:12px 0">
  <div style="font-size:11px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px">
    Growth Charts — Hadlock Reference
  </div>
  <div style="display:flex;flex-wrap:wrap;gap:8px">
    ${charts.join('')}
  </div>
</div>`;
}

function renderStaticChart(
  config: ChartConfig,
  point: GrowthChartPoint,
  width: number,
  height: number,
): string {
  const pad = { top: 22, right: 12, bottom: 26, left: 34 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const { table, color, curveColor, label, unit } = config;

  const p5  = getCurveValues(table, Z5);
  const p50 = getCurveValues(table, Z50);
  const p95 = getCurveValues(table, Z95);

  const gaMin = table[0][0];
  const gaMax = table[table.length - 1][0];
  const allVals = [...p5, ...p95].map(d => d.val);
  const valMin = Math.min(...allVals) * 0.9;
  const valMax = Math.max(...allVals) * 1.1;

  const xScale = (ga: number) => pad.left + ((ga - gaMin) / (gaMax - gaMin)) * plotW;
  const yScale = (val: number) => pad.top + plotH - ((val - valMin) / (valMax - valMin)) * plotH;

  const pathFromData = (data: { ga: number; val: number }[]) =>
    data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(d.ga).toFixed(1)},${yScale(d.val).toFixed(1)}`).join(' ');

  // Fill region
  const top = p95.map(d => `${xScale(d.ga).toFixed(1)},${yScale(d.val).toFixed(1)}`);
  const bot = [...p5].reverse().map(d => `${xScale(d.ga).toFixed(1)},${yScale(d.val).toFixed(1)}`);
  const fillPath = `M${top.join(' L')} L${bot.join(' L')} Z`;

  // Point position
  const px = Math.max(pad.left, Math.min(pad.left + plotW, xScale(point.gaWeeks)));
  const py = Math.max(pad.top, Math.min(pad.top + plotH, yScale(point.value)));
  const inRange = point.gaWeeks >= gaMin && point.gaWeeks <= gaMax;

  const dotColor = point.percentile != null
    ? (point.percentile < 3 || point.percentile > 97 ? '#dc2626' : point.percentile < 10 || point.percentile > 90 ? '#d97706' : '#16a34a')
    : color;

  const pctText = point.percentile != null ? ` (${point.percentile}%ile)` : '';

  // GA ticks
  const gaTicks: number[] = [];
  for (let g = Math.ceil(gaMin / 4) * 4; g <= gaMax; g += 4) gaTicks.push(g);

  // Val ticks
  const valStep = (valMax - valMin) / 4;
  const valTicks: number[] = [];
  for (let i = 0; i <= 4; i++) valTicks.push(valMin + i * valStep);

  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="font-family:Arial,sans-serif">`);

  // Background
  parts.push(`<rect width="${width}" height="${height}" fill="white" rx="4" />`);

  // Title
  parts.push(`<text x="${width / 2}" y="14" text-anchor="middle" font-size="10" font-weight="bold" fill="#333">${label} (${unit})</text>`);

  // Fill
  parts.push(`<path d="${fillPath}" fill="${curveColor}" opacity="0.15" />`);

  // Grid
  gaTicks.forEach(g => {
    parts.push(`<line x1="${xScale(g)}" y1="${pad.top}" x2="${xScale(g)}" y2="${pad.top + plotH}" stroke="#e5e7eb" stroke-width="0.5" />`);
  });
  valTicks.forEach(v => {
    parts.push(`<line x1="${pad.left}" y1="${yScale(v)}" x2="${pad.left + plotW}" y2="${yScale(v)}" stroke="#e5e7eb" stroke-width="0.5" />`);
  });

  // Curves
  parts.push(`<path d="${pathFromData(p5)}" fill="none" stroke="${curveColor}" stroke-width="1" stroke-dasharray="3,2" />`);
  parts.push(`<path d="${pathFromData(p50)}" fill="none" stroke="${curveColor}" stroke-width="1.5" />`);
  parts.push(`<path d="${pathFromData(p95)}" fill="none" stroke="${curveColor}" stroke-width="1" stroke-dasharray="3,2" />`);

  // Curve labels
  parts.push(`<text x="${pad.left + plotW + 1}" y="${yScale(p5[p5.length - 1].val)}" font-size="7" fill="${curveColor}" dominant-baseline="middle">5th</text>`);
  parts.push(`<text x="${pad.left + plotW + 1}" y="${yScale(p50[p50.length - 1].val)}" font-size="7" fill="${curveColor}" dominant-baseline="middle">50th</text>`);
  parts.push(`<text x="${pad.left + plotW + 1}" y="${yScale(p95[p95.length - 1].val)}" font-size="7" fill="${curveColor}" dominant-baseline="middle">95th</text>`);

  // X axis
  parts.push(`<line x1="${pad.left}" y1="${pad.top + plotH}" x2="${pad.left + plotW}" y2="${pad.top + plotH}" stroke="#ccc" stroke-width="0.5" />`);
  gaTicks.forEach(g => {
    parts.push(`<line x1="${xScale(g)}" y1="${pad.top + plotH}" x2="${xScale(g)}" y2="${pad.top + plotH + 3}" stroke="#ccc" stroke-width="0.5" />`);
    parts.push(`<text x="${xScale(g)}" y="${pad.top + plotH + 12}" text-anchor="middle" font-size="7" fill="#999">${g}</text>`);
  });
  parts.push(`<text x="${pad.left + plotW / 2}" y="${height - 2}" text-anchor="middle" font-size="7" fill="#aaa">GA (weeks)</text>`);

  // Y axis
  parts.push(`<line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + plotH}" stroke="#ccc" stroke-width="0.5" />`);
  valTicks.forEach(v => {
    parts.push(`<line x1="${pad.left - 3}" y1="${yScale(v)}" x2="${pad.left}" y2="${yScale(v)}" stroke="#ccc" stroke-width="0.5" />`);
    parts.push(`<text x="${pad.left - 5}" y="${yScale(v)}" text-anchor="end" font-size="7" fill="#999" dominant-baseline="middle">${unit === 'g' ? Math.round(v) : v.toFixed(1)}</text>`);
  });

  // Crosshairs
  if (inRange) {
    parts.push(`<line x1="${px}" y1="${pad.top}" x2="${px}" y2="${pad.top + plotH}" stroke="${dotColor}" stroke-width="0.5" stroke-dasharray="2,2" opacity="0.4" />`);
    parts.push(`<line x1="${pad.left}" y1="${py}" x2="${pad.left + plotW}" y2="${py}" stroke="${dotColor}" stroke-width="0.5" stroke-dasharray="2,2" opacity="0.4" />`);
  }

  // Dot
  parts.push(`<circle cx="${px}" cy="${py}" r="4" fill="${dotColor}" stroke="white" stroke-width="1.5" />`);

  // Value label
  const labelX = px > pad.left + plotW / 2 ? px - 6 : px + 6;
  const anchor = px > pad.left + plotW / 2 ? 'end' : 'start';
  parts.push(`<text x="${labelX}" y="${py - 8}" text-anchor="${anchor}" font-size="8" font-weight="bold" fill="${dotColor}">${unit === 'g' ? Math.round(point.value) : point.value}${pctText}</text>`);

  parts.push('</svg>');
  return parts.join('');
}
