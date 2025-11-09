import { useMemo } from 'react';
import Chart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import { List } from '../types';
import { getTechnologyColor } from '../lib/technology-colors';

export const TECHNOLOGY_FALLBACK_LABEL = 'Tecnologia non dichiarata';

type TreemapDatum = {
  x: string;
  y: number;
  fillColor: string;
  listId: string;
  requirements: number;
  days: number;
  percentage: number;
  avgDaysPerReq: number;
  status: List['status'];
  businessOwner?: string;
  technology: string;
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
  listStats: Record<string, { totalRequirements: number; totalDays: number }>;
  onSelectList: (list: List) => void;
  containerHeight: number;
  showLegend?: boolean;
}

export function TreemapApex({
  lists,
  listStats,
  onSelectList,
  containerHeight,
  showLegend = true
}: TreemapApexProps) {
  const { series, options, legendEntries } = useMemo(() => {
    const listsWithContent = lists.filter((list) => {
      const stats = listStats[list.list_id] || { totalRequirements: 0, totalDays: 0 };
      return stats.totalRequirements > 0 && stats.totalDays > 0;
    });

    if (listsWithContent.length === 0) {
      return { series: [], options: {} as ApexOptions, legendEntries: [] as Array<{ label: string; color: string }> };
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
        listId: list.list_id,
        requirements: stats.totalRequirements,
        days: stats.totalDays,
        percentage,
        avgDaysPerReq,
        status: list.status,
        businessOwner: list.default_business_owner || list.owner,
        technology
      };
    });

    const series = [{ data }];

    const MIN_LABEL_PERCENTAGE = 2.5;
    const SINGLE_LINE_PERCENTAGE = 5;
    const FULL_DETAILS_PERCENTAGE = 12;

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

          const maxChars = dataPoint.percentage < FULL_DETAILS_PERCENTAGE ? 18 : 26;
          const shortTitle = text.length > maxChars ? `${text.slice(0, maxChars - 1)}...` : text;

          if (dataPoint.percentage < SINGLE_LINE_PERCENTAGE) {
            return shortTitle;
          }

          if (dataPoint.percentage < FULL_DETAILS_PERCENTAGE) {
            return `${shortTitle}\n${dataPoint.days.toFixed(1)} gg`;
          }

          return `${shortTitle}\n${dataPoint.days.toFixed(1)} gg | ${dataPoint.requirements} req\n${dataPoint.percentage.toFixed(1)}% | ${dataPoint.avgDaysPerReq.toFixed(1)} gg/req`;
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
            <div style="padding: 10px 12px; min-width: 180px;">
              <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">
                ${dataPoint.x}
              </div>
              <div style="font-size: 11px; color: rgba(255,255,255,0.8); margin-bottom: 8px;">
                ${dataPoint.technology} &middot; ${statusLabel}
              </div>
              <div style="font-size: 12px; margin-bottom: 4px;">
                ${dataPoint.requirements} req &middot; ${dataPoint.days.toFixed(1)} gg tot
              </div>
              <div style="font-size: 12px;">
                ${dataPoint.avgDaysPerReq.toFixed(1)} gg/req &middot; ${dataPoint.percentage.toFixed(1)}%
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

    return { series, options, legendEntries };
  }, [lists, listStats, onSelectList, containerHeight]);

  if (series.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Nessuna lista con requisiti stimati
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
