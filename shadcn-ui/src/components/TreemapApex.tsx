import { useMemo } from 'react';
import Chart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import { List, Requirement } from '../types';
import { getTechnologyColor } from '../lib/technology-colors';
import { getPrioritySolidColor, getStateHexColor } from '@/lib/utils';

export const TECHNOLOGY_FALLBACK_LABEL = 'Tecnologia non dichiarata';

const PRIORITY_LABELS: Record<Requirement['priority'], string> = {
  High: 'Alta',
  Med: 'Media',
  Low: 'Bassa'
};

const STATE_LABELS: Record<Requirement['state'], string> = {
  Proposed: 'Proposto',
  Selected: 'Selezionato',
  Scheduled: 'Pianificato',
  Done: 'Completato'
};

type RequirementNode = {
  reqId: string;
  title: string;
  totalDays: number;
  priority: Requirement['priority'];
  state: Requirement['state'];
  businessOwner?: string;
};

type TreemapDatum = {
  x: string;
  y: number;
  fillColor: string;
  kind: 'list' | 'requirement';
  listId: string;
  requirements?: number;
  days: number;
  percentage: number;
  avgDaysPerReq?: number;
  status?: List['status'];
  businessOwner?: string;
  technology?: string;
  requirementId?: string;
  priority?: Requirement['priority'];
  state?: Requirement['state'];
  criticalPathDays?: number;
};

type DataLabelFormatterOpts = {
  dataPointIndex: number;
  [key: string]: unknown;
};

type TooltipCustomParams = {
  dataPointIndex: number;
  seriesIndex: number;
  w: unknown;
};

interface TreemapApexProps {
  lists: List[];
  listStats: Record<string, { totalRequirements: number; totalDays: number; criticalPathDays: number }>;
  listRequirementStats: Record<string, RequirementNode[]>;
  mode: 'lists' | 'requirements';
  focusedListId: string | null;
  onSelectList: (list: List) => void;
  onRequirementSelect?: (listId: string, requirementId: string) => void;
  containerHeight: number;
  showLegend?: boolean;
}

export function TreemapApex({
  lists,
  listStats,
  listRequirementStats,
  mode,
  focusedListId,
  onSelectList,
  onRequirementSelect,
  containerHeight,
  showLegend = true
}: TreemapApexProps) {
  const { series, options, legendEntries, emptyMessage } = useMemo(() => {
    if (mode === 'requirements') {
      if (!focusedListId) {
        return {
          series: [],
          options: {} as ApexOptions,
          legendEntries: [],
          emptyMessage: 'Seleziona una lista con requisiti stimati per approfondire'
        };
      }

      const requirementNodes = listRequirementStats[focusedListId] ?? [];
      if (requirementNodes.length === 0) {
        return {
          series: [],
          options: {} as ApexOptions,
          legendEntries: [],
          emptyMessage: 'Nessun requisito con stima disponibile per questa lista'
        };
      }

      const safeTotal = requirementNodes.reduce((sum, node) => sum + (node.totalDays > 0 ? node.totalDays : 0.1), 0);
      const data: TreemapDatum[] = requirementNodes.map((node) => {
        const safeValue = node.totalDays > 0 ? node.totalDays : 0.1;
        return {
          x: node.title,
          y: safeValue,
          fillColor: getPrioritySolidColor(node.priority),
          kind: 'requirement',
          listId: focusedListId,
          days: node.totalDays,
          percentage: safeValue / safeTotal * 100,
          businessOwner: node.businessOwner,
          requirementId: node.reqId,
          priority: node.priority,
          state: node.state
        };
      });

      const series = [{ data }];

      const MIN_LABEL_PERCENTAGE = 1.2;
      const SINGLE_LINE_PERCENTAGE = 2.8;
      const FULL_DETAILS_PERCENTAGE = 7;

      const options: ApexOptions = {
        chart: {
          type: 'treemap',
          height: containerHeight,
          toolbar: { show: false },
          animations: { enabled: true, speed: 400 },
          events: {
            dataPointSelection: (_event, _chartContext, config) => {
              const selectedData = data[config.dataPointIndex];
              if (selectedData?.kind === 'requirement' && selectedData.requirementId && onRequirementSelect) {
                onRequirementSelect(selectedData.listId, selectedData.requirementId);
              }
            },
            mounted: (chartContext) => {
              const el = chartContext?.el as Element | null | undefined;
              setTimeout(() => hideRotatedTreemapLabels(el), 0);
            },
            updated: (chartContext) => {
              const el = chartContext?.el as Element | null | undefined;
              setTimeout(() => hideRotatedTreemapLabels(el), 0);
            }
          }
        },
        legend: { show: false },
        plotOptions: {
          treemap: {
            enableShades: false,
            distributed: true,
            dataLabels: { format: 'truncate' }
          }
        },
        dataLabels: {
          enabled: true,
          style: { fontSize: '12px', fontWeight: 600, colors: ['#fff'] },
          formatter: function dataLabelFormatter(text: string, opts: DataLabelFormatterOpts) {
            const dataPoint = data[opts.dataPointIndex];
            if (!dataPoint) {
              return text;
            }

            if (dataPoint.percentage < MIN_LABEL_PERCENTAGE) {
              return '';
            }

            const maxChars = dataPoint.percentage < FULL_DETAILS_PERCENTAGE ? 18 : 26;
            const shortTitle = text.length > maxChars ? `${text.slice(0, maxChars - 1)}...` : text;

            if (dataPoint.percentage < SINGLE_LINE_PERCENTAGE) {
              return shortTitle;
            }

            if (dataPoint.percentage < FULL_DETAILS_PERCENTAGE) {
              return `${shortTitle}\n${dataPoint.days.toFixed(1)} gg`;
            }

            const priorityLabel = dataPoint.priority ? PRIORITY_LABELS[dataPoint.priority] : '';
            const stateLabel = dataPoint.state ? STATE_LABELS[dataPoint.state] : '';
            return `${shortTitle}\n${dataPoint.days.toFixed(1)} gg · ${priorityLabel}\n${stateLabel}`;
          }
        },
        colors: data.map((d) => d.fillColor),
        tooltip: {
          enabled: true,
          theme: 'dark',
          style: { fontSize: '13px', fontFamily: 'inherit' },
          custom: function tooltipTemplate({ dataPointIndex }: TooltipCustomParams) {
            const dataPoint = data[dataPointIndex];
            const priorityLabel = dataPoint.priority ? PRIORITY_LABELS[dataPoint.priority] : 'n/d';
            const stateLabel = dataPoint.state ? STATE_LABELS[dataPoint.state] : 'n/d';
            const ownerInfo = dataPoint.businessOwner
              ? `<div style="margin-top: 6px; font-size: 11px; color: rgba(255,255,255,0.85);">Owner: ${dataPoint.businessOwner}</div>`
              : '';

            return `
              <div style="padding: 10px 12px; min-width: 200px;">
                <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">
                  ${dataPoint.x}
                </div>
                <div style="font-size: 11px; color: rgba(255,255,255,0.8); margin-bottom: 6px; display:flex; align-items:center; gap:6px;">
                  <span style="display:inline-flex;width:8px;height:8px;border-radius:999px;background:${dataPoint.priority ? getPrioritySolidColor(dataPoint.priority) : '#94a3b8'};"></span>
                  <span>${priorityLabel} &middot; ${stateLabel}</span>
                </div>
                <div style="font-size: 12px; margin-bottom: 4px;">
                  ${dataPoint.days.toFixed(1)} gg stimati
                </div>
                ${ownerInfo}
              </div>
            `;
          }
        }
      };

      const legendEntries = Array.from(new Set(requirementNodes.map((node) => node.priority))).map((priority) => ({
        label: PRIORITY_LABELS[priority],
        color: getPrioritySolidColor(priority)
      }));

      return { series, options, legendEntries, emptyMessage: undefined };
    }

    const listsWithContent = lists.filter((list) => {
      const stats = listStats[list.list_id] || { totalRequirements: 0, totalDays: 0, criticalPathDays: 0 };
      return stats.totalRequirements > 0 && stats.totalDays > 0;
    });

    if (listsWithContent.length === 0) {
      return { series: [], options: {} as ApexOptions, legendEntries: [] as Array<{ label: string; color: string }>, emptyMessage: 'Nessuna lista con requisiti stimati' };
    }

    const normalizedTechnologies = listsWithContent.map((list) => list.technology?.trim() || TECHNOLOGY_FALLBACK_LABEL);
    const technologies = Array.from(new Set(normalizedTechnologies));

    const totalDays = listsWithContent.reduce((sum, list) => {
      const stats = listStats[list.list_id];
      return sum + stats.totalDays;
    }, 0);

    const data: TreemapDatum[] = listsWithContent.map((list) => {
      const stats = listStats[list.list_id];
      const percentage = (stats.totalDays / totalDays) * 100;
      const avgDaysPerReq = stats.totalDays / stats.totalRequirements;
      const technology = list.technology?.trim() || TECHNOLOGY_FALLBACK_LABEL;

      return {
        x: list.name,
        y: Math.round(stats.totalDays),
        fillColor: getTechnologyColor(technology),
        kind: 'list',
        listId: list.list_id,
        requirements: stats.totalRequirements,
        days: stats.totalDays,
        percentage,
        avgDaysPerReq,
        status: list.status,
        businessOwner: list.default_business_owner || list.owner,
        technology,
        criticalPathDays: stats.criticalPathDays
      };
    });

    const series = [{ data }];

    const MIN_LABEL_PERCENTAGE = 2.5;

    const options: ApexOptions = {
      chart: {
        type: 'treemap',
        height: containerHeight,
        toolbar: { show: false },
        animations: { enabled: true, speed: 400 },
        events: {
          dataPointSelection: (_event, _chartContext, config) => {
            const selectedData = data[config.dataPointIndex];
            const selectedList = listsWithContent.find((l) => l.list_id === selectedData.listId);
            if (selectedList) {
              onSelectList(selectedList);
            }
          },
          mounted: (chartContext) => {
            const el = chartContext?.el as Element | null | undefined;
            setTimeout(() => hideRotatedTreemapLabels(el), 0);
          },
          updated: (chartContext) => {
            const el = chartContext?.el as Element | null | undefined;
            setTimeout(() => hideRotatedTreemapLabels(el), 0);
          }
        }
      },
      legend: { show: false },
      plotOptions: {
        treemap: {
          enableShades: false,
          distributed: true,
          dataLabels: { format: 'truncate' }
        }
      },
      dataLabels: {
        enabled: true,
        style: { fontSize: '12px', fontWeight: 600, colors: ['#fff'] },
        formatter: function dataLabelFormatter(text: string, opts: DataLabelFormatterOpts) {
          const dataPoint = data[opts.dataPointIndex];
          if (!dataPoint) {
            return text;
          }

          if (dataPoint.percentage < MIN_LABEL_PERCENTAGE) {
            return '';
          }

          const maxChars = 22;
          const shortTitle = text.length > maxChars ? `${text.slice(0, maxChars - 1)}...` : text;

          return `${shortTitle}\n${dataPoint.days.toFixed(1)} gg tot`;
        }
      },
      colors: data.map((d) => d.fillColor),
      tooltip: {
        enabled: true,
        theme: 'dark',
        style: { fontSize: '13px', fontFamily: 'inherit' },
        custom: function tooltipTemplate({ dataPointIndex }: TooltipCustomParams) {
          const dataPoint = data[dataPointIndex];
          const statusLabel = dataPoint.status === 'Active' ? 'Attiva' : dataPoint.status === 'Draft' ? 'Bozza' : 'Archiviata';
          const ownerInfo = dataPoint.businessOwner
            ? `<div style="margin-top: 6px; font-size: 11px; color: rgba(255,255,255,0.85);">Owner: ${dataPoint.businessOwner}</div>`
            : '';

          return `
            <div style="padding: 10px 12px; min-width: 200px;">
              <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">
                ${dataPoint.x}
              </div>
              <div style="font-size: 11px; color: rgba(255,255,255,0.8); margin-bottom: 8px;">
                ${dataPoint.technology} &middot; ${statusLabel}
              </div>
              <div style="font-size: 12px; margin-bottom: 4px;">
                ${dataPoint.requirements} req &middot; ${dataPoint.days.toFixed(1)} gg tot
              </div>
              <div style="font-size: 12px; margin-bottom: 4px;">
                Critical path: ${(dataPoint.criticalPathDays ?? 0).toFixed(1)} gg
              </div>
              <div style="font-size: 12px;">
                ${dataPoint.avgDaysPerReq?.toFixed(1) ?? 'n/d'} gg/req &middot; ${dataPoint.percentage.toFixed(1)}%
              </div>
              ${ownerInfo}
            </div>
          `;
        }
      }
    };

    const legendEntries = technologies.map((tech) => ({
      label: tech,
      color: getTechnologyColor(tech)
    }));

    return { series, options, legendEntries, emptyMessage: undefined };
  }, [
    containerHeight,
    focusedListId,
    listRequirementStats,
    listStats,
    lists,
    mode,
    onRequirementSelect,
    onSelectList
  ]);

  if (series.length === 0) {
    return (
      <div className="flex items-center justify-center h-full px-6 text-center text-muted-foreground">
        {emptyMessage ?? 'Nessun dato disponibile'}
      </div>
    );
  }

function hideRotatedTreemapLabels(chartEl?: Element | null): void {
  if (!chartEl) {
    return;
  }

  const groups = chartEl.querySelectorAll<SVGGElement>('.apexcharts-datalabel');
  groups.forEach((group) => {
    const transform = group.getAttribute('transform') ?? '';
    const isRotated = /rotate\(/i.test(transform);
    group.style.display = isRotated ? 'none' : '';
  });
}

  return (
    <div className="w-full h-full">
      <Chart options={options} series={series} type="treemap" height={containerHeight} />
      {showLegend && legendEntries.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
          {legendEntries.map(({ label, color }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
