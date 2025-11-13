import { useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import type { List, Requirement } from '../types';

type Props = {
    lists: List[];
    requirementsByList: Record<string, Requirement[]>;
    height?: number;
    onPointClick?: (listId: string, reqId: string) => void;
};

const PRIORITY_NUM = { Low: 1, Med: 2, High: 3 } as const;

function safeDate(d?: string | Date) {
    if (!d) return undefined;
    return d instanceof Date ? d : new Date(d);
}
function reqAgeDays(r: Requirement, now = new Date()) {
    const start =
        safeDate((r as any).started_at) ??
        safeDate((r as any).startedAt) ??
        safeDate((r as any).created_on) ??
        safeDate((r as any).createdAt);
    if (!start) return 0;
    const ms = now.getTime() - start.getTime();
    return Math.max(0, Math.floor(ms / 86400000));
}
const isWip = (r: Requirement) =>
    !(r as any).done_at && !(r as any).doneAt && ['Selected', 'Scheduled', 'InProgress'].includes(r.state as any);

export function ScatterAgingByList({
    lists,
    requirementsByList,
    height = 260,
    onPointClick
}: Props) {

    const series = useMemo(() => {
        const arr = [];
        for (const list of lists) {
            const reqs = requirementsByList[list.list_id] ?? [];
            const points = reqs
                .filter(isWip)
                .map((r) => {
                    const age = reqAgeDays(r);
                    const y = PRIORITY_NUM[(r.priority as keyof typeof PRIORITY_NUM) ?? 'Med'] ?? 2;
                    const est = (r as any).estimateDays ?? (r as any).estimationDays ?? 0;
                    return {
                        x: age,
                        y,
                        z: Math.max(4, Math.min(16, Math.round((est || 1) * 1.2))), // dimensione marker
                        reqId: r.req_id,
                        title: r.title,
                        priority: r.priority,
                        state: r.state,
                        listId: list.list_id,
                        listName: list.name,
                        estimateDays: est
                    };
                });
            if (points.length) arr.push({ name: list.name, data: points });
        }
        return arr;
    }, [lists, requirementsByList]);

    const options: ApexOptions = {
        chart: {
            type: 'scatter',
            toolbar: { show: false },
            zoom: { enabled: false },
            events: {
                dataPointSelection: (_e, _ctx, cfg) => {
                    const p = (cfg.w.config.series as any)[cfg.seriesIndex].data[cfg.dataPointIndex];
                    onPointClick?.(p.listId, p.reqId);
                }
            }
        },
        legend: { position: 'top' },
        markers: { size: 6, hover: { sizeOffset: 2 } },
        xaxis: { title: { text: 'Età (giorni)' }, tickAmount: 8 },
        yaxis: {
            min: 0.5, max: 3.5, tickAmount: 3,
            title: { text: 'Priorità' },
            labels: {
                formatter: (v) => ({ 1: 'Low', 2: 'Med', 3: 'High' } as any)[Math.round(v)] ?? ''
            }
        },
        tooltip: {
            custom: ({ seriesIndex, dataPointIndex, w }) => {
                const p = (w.config.series as any)[seriesIndex].data[dataPointIndex];
                return `<div style="padding:8px">
          <strong>${p.title}</strong><br/>
          Lista: ${p.listName}<br/>
          Età: ${p.x}g — Priorità: ${p.priority}<br/>
          Stima: ${p.estimateDays || 0}g — Stato: ${p.state}
        </div>`;
            }
        },
        annotations: {
            xaxis: [
                { x: 14, strokeDashArray: 4, borderColor: '#94a3b8', label: { text: '14g', style: { background: '#94a3b8', color: '#fff' } } },
                { x: 30, strokeDashArray: 4, borderColor: '#ef4444', label: { text: '30g', style: { background: '#ef4444', color: '#fff' } } },
            ],
            yaxis: [
                { y: 0.5, y2: 1.5, opacity: 0.06, fillColor: '#10b981' },
                { y: 1.5, y2: 2.5, opacity: 0.06, fillColor: '#f59e0b' },
                { y: 2.5, y2: 3.5, opacity: 0.06, fillColor: '#ef4444' },
            ],
        }
    };

    if (!series.length) {
        return (
            <div className="text-xs text-muted-foreground p-3">
                Nessun requisito in WIP per le liste selezionate.
            </div>
        );
    }

    return <Chart options={options} series={series as any} type="scatter" height={height} />;
}

export default ScatterAgingByList;
