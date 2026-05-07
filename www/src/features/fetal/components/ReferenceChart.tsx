import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useBiometryStore } from '@/features/fetal/stores/biometryStore';
import type { GrowthChartPoint } from '@/features/fetal/types';

interface Props {
  parameter: string;        // e.g. "NT"
  parameterLabel: string;   // e.g. "Nuchal Translucency"
  unit: string;
  authorId: number;
  patientValue: number | null;
  patientGaWeeks: number | null;
  onClose: () => void;
}

const W = 520;
const H = 300;
const PAD = { top: 20, right: 20, bottom: 40, left: 50 };
const INNER_W = W - PAD.left - PAD.right;
const INNER_H = H - PAD.top - PAD.bottom;

function lerp(v: number, srcMin: number, srcMax: number, dstMin: number, dstMax: number) {
  return dstMin + ((v - srcMin) / (srcMax - srcMin)) * (dstMax - dstMin);
}

export function ReferenceChart({ parameter, parameterLabel, unit, authorId, patientValue, patientGaWeeks, onClose }: Props) {
  const { loadChartData, authors } = useBiometryStore();
  const [points, setPoints] = useState<GrowthChartPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    loadChartData(parameter, authorId).then((d) => {
      setPoints(d);
      setLoading(false);
    });
  }, [parameter, authorId, loadChartData]);

  const author = authors.find((a) => a.id === authorId);

  if (loading || points.length < 2) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
        <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
          {loading ? 'Loading chart…' : 'No reference data available for this parameter/author.'}
        </div>
      </div>
    );
  }

  const gaMin = points[0].ga_weeks;
  const gaMax = points[points.length - 1].ga_weeks;
  const valMin = Math.min(...points.map((p) => p.p5)) * 0.85;
  const valMax = Math.max(...points.map((p) => p.p95)) * 1.1;

  const cx = (ga: number) => lerp(ga, gaMin, gaMax, 0, INNER_W);
  const cy = (v: number) => INNER_H - lerp(v, valMin, valMax, 0, INNER_H);

  const pathFor = (key: 'p5' | 'p50' | 'p95') =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'}${cx(p.ga_weeks).toFixed(1)},${cy(p[key]).toFixed(1)}`).join(' ');

  // shaded band between p5 and p95
  const bandPath = [
    ...points.map((p, i) => `${i === 0 ? 'M' : 'L'}${cx(p.ga_weeks).toFixed(1)},${cy(p.p5).toFixed(1)}`),
    ...[...points].reverse().map((p) => `L${cx(p.ga_weeks).toFixed(1)},${cy(p.p95).toFixed(1)}`),
    'Z',
  ].join(' ');

  // GA axis ticks
  const gaTicks: number[] = [];
  for (let g = Math.ceil(gaMin); g <= Math.floor(gaMax); g++) gaTicks.push(g);

  // Value axis ticks (5 steps)
  const valStep = (valMax - valMin) / 5;
  const valTicks: number[] = [];
  for (let i = 0; i <= 5; i++) valTicks.push(+(valMin + i * valStep).toFixed(1));

  // Patient marker
  const showMarker = patientValue !== null && patientGaWeeks !== null
    && patientGaWeeks >= gaMin && patientGaWeeks <= gaMax
    && patientValue >= valMin && patientValue <= valMax;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 w-[600px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-base">{parameterLabel} ({unit})</h3>
            {author && <p className="text-xs text-slate-500">{author.display_name}</p>}
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700">
            <X size={16} />
          </button>
        </div>

        {/* SVG chart */}
        <svg width={W} height={H} className="overflow-visible">
          <g transform={`translate(${PAD.left},${PAD.top})`}>
            {/* Grid lines */}
            {valTicks.map((v) => (
              <line key={v} x1={0} x2={INNER_W} y1={cy(v)} y2={cy(v)}
                stroke="#e2e8f0" strokeWidth={1} />
            ))}
            {gaTicks.map((g) => (
              <line key={g} x1={cx(g)} x2={cx(g)} y1={0} y2={INNER_H}
                stroke="#e2e8f0" strokeWidth={1} />
            ))}

            {/* Shaded normal band */}
            <path d={bandPath} fill="#3b82f6" fillOpacity={0.08} />

            {/* p95 line */}
            <path d={pathFor('p95')} fill="none" stroke="#93c5fd" strokeWidth={1.5} strokeDasharray="4 3" />
            {/* p5 line */}
            <path d={pathFor('p5')} fill="none" stroke="#93c5fd" strokeWidth={1.5} strokeDasharray="4 3" />
            {/* p50 line */}
            <path d={pathFor('p50')} fill="none" stroke="#2563eb" strokeWidth={2} />

            {/* Patient marker */}
            {showMarker && (
              <>
                <line
                  x1={cx(patientGaWeeks!)} x2={cx(patientGaWeeks!)}
                  y1={0} y2={INNER_H}
                  stroke="#ef4444" strokeWidth={1} strokeDasharray="4 2" opacity={0.6}
                />
                <circle
                  cx={cx(patientGaWeeks!)} cy={cy(patientValue!)}
                  r={6} fill="#ef4444" stroke="#fff" strokeWidth={2}
                />
              </>
            )}

            {/* X axis */}
            <line x1={0} x2={INNER_W} y1={INNER_H} y2={INNER_H} stroke="#94a3b8" />
            {gaTicks.map((g) => (
              <text key={g} x={cx(g)} y={INNER_H + 14} textAnchor="middle"
                fontSize={10} fill="#64748b">{g}w</text>
            ))}
            <text x={INNER_W / 2} y={INNER_H + 30} textAnchor="middle"
              fontSize={11} fill="#64748b">Gestational Age (weeks)</text>

            {/* Y axis */}
            <line x1={0} x2={0} y1={0} y2={INNER_H} stroke="#94a3b8" />
            {valTicks.map((v) => (
              <text key={v} x={-6} y={cy(v) + 4} textAnchor="end"
                fontSize={10} fill="#64748b">{v}</text>
            ))}
          </g>
        </svg>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="inline-block w-6 h-0.5 bg-blue-500" style={{ borderTop: '2px solid #2563eb' }} /> Median (p50)
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-6 h-0.5" style={{ borderTop: '2px dashed #93c5fd' }} /> p5 / p95
          </span>
          {showMarker && (
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-full bg-red-500" /> This patient
            </span>
          )}
        </div>

        {/* Citation */}
        {author && (
          <p className="text-xs text-slate-400 mt-2 italic">{author.citation}</p>
        )}
      </div>
    </div>
  );
}
