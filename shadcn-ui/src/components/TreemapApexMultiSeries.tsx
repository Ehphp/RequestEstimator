import { useMemo, useRef, useState } from "react";

import Chart from "react-apexcharts";

import { ApexOptions } from "apexcharts";

import { toast } from "sonner";

import { List, Requirement } from "../types";

import { getPrioritySolidColor, getPriorityStrokeColor } from "@/lib/utils";

import { Button } from "@/components/ui/button";

export const TECHNOLOGY_FALLBACK_LABEL = "Tecnologia non dichiarata";

const PRIORITY_LABELS: Record<Requirement["priority"], string> = {
  High: "Alta",

  Med: "Media",

  Low: "Bassa",
};

const STATE_LABELS: Record<Requirement["state"], string> = {
  Proposed: "Proposto",

  Selected: "Selezionato",

  Scheduled: "Pianificato",

  Done: "Completato",
};

const PRIORITY_BADGE: Record<Requirement["priority"], string> = {
  High: "A",

  Med: "M",

  Low: "B",
};

const TREEMAP_PASTEL_BASE = "#f8fafc";

const TREEMAP_PASTEL_WEIGHT = 0.25;

const LIST_COLOR_PALETTE = [
  "#2563eb",
  "#ea580c",
  "#0f766e",
  "#9333ea",
  "#dc2626",
  "#0891b2",
  "#ca8a04",
  "#93370d",
  "#3f6212",
  "#7c3aed",
  "#047857",
  "#b45309",
  "#1d4ed8",
  "#9d174d",
  "#115e59",
  "#581c87",
];

type Rgb = { r: number; g: number; b: number };

function hexToRgb(hex?: string): Rgb | null {
  if (!hex) return null;

  let sanitized = hex.replace("#", "");

  if (!/^[0-9a-f]{3,6}$/i.test(sanitized)) {
    return null;
  }

  if (sanitized.length === 3) {
    sanitized = sanitized

      .split("")

      .map((char) => char + char)

      .join("");
  }

  if (sanitized.length !== 6) {
    return null;
  }

  const intVal = parseInt(sanitized, 16);

  return {
    r: (intVal >> 16) & 255,

    g: (intVal >> 8) & 255,

    b: intVal & 255,
  };
}

function rgbToHex(rgb: Rgb): string {
  const clamp = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value)));

  return `#${[clamp(rgb.r), clamp(rgb.g), clamp(rgb.b)]

    .map((value) => value.toString(16).padStart(2, "0"))

    .join("")}`;
}

function mixHexColors(color: string, mix: string, weight: number): string {
  const base = hexToRgb(color);

  const mixRgb = hexToRgb(mix);

  if (!base || !mixRgb) return color;

  const ratio = Math.max(0, Math.min(1, weight));

  return rgbToHex({
    r: base.r * (1 - ratio) + mixRgb.r * ratio,

    g: base.g * (1 - ratio) + mixRgb.g * ratio,

    b: base.b * (1 - ratio) + mixRgb.b * ratio,
  });
}

function hashString(value: string): number {
  let hash = 0;

  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }

  return hash;
}

function getListBaseColor(listId: string): string {
  if (!listId) {
    return LIST_COLOR_PALETTE[0];
  }

  const hash = hashString(listId);

  return LIST_COLOR_PALETTE[hash % LIST_COLOR_PALETTE.length];
}

function getTreemapFillColor(baseColor: string): string {
  return mixHexColors(
    baseColor,
    TREEMAP_PASTEL_BASE,
    TREEMAP_PASTEL_WEIGHT,
  );
}

type RequirementNode = {
  reqId: string;

  title: string;

  totalDays: number;

  priority: Requirement["priority"];

  state: Requirement["state"];

  businessOwner?: string;
};

type MultiSeriesDataPoint = {
  x: string;

  y: number;

  fillColor: string;

  listFillColor: string;

  requirementId: string;

  priority: Requirement["priority"];

  priorityBadge: string;

  priorityColor: string;

  state: Requirement["state"];

  businessOwner?: string;

  percentage: number;
};

type SeriesMetadata = {
  listId: string;

  listName: string;

  technology: string;

  listColor: string;

  treemapFillColor: string;

  status: List["status"];

  businessOwner: string;

  totalDays: number;

  totalRequirements: number;

  criticalPathDays: number;
};

type TooltipCustomParams = {
  dataPointIndex: number;

  seriesIndex: number;

  w: {
    config: {
      series: Array<{
        name: string;

        data: MultiSeriesDataPoint[];
      }>;
    };
  };
};

type ColorMode = "list" | "priority";

interface TreemapApexMultiSeriesProps {
  lists: List[];

  listStats: Record<
    string,
    { totalRequirements: number; totalDays: number; criticalPathDays: number }
  >;

  listRequirementStats: Record<string, RequirementNode[]>;

  onSelectList: (list: List) => void;

  onRequirementSelect: (listId: string, requirementId: string) => void;

  containerHeight: number;

  showLegend: boolean;
}

function prepareMultiSeriesData(
  lists: List[],

  listStats: Record<
    string,
    { totalRequirements: number; totalDays: number; criticalPathDays: number }
  >,

  listRequirementStats: Record<string, RequirementNode[]>,
): {
  series: Array<{ name: string; data: MultiSeriesDataPoint[] }>;

  metadata: SeriesMetadata[];

  hasData: boolean;

  emptyMessage: string;
} {
  // Filtra liste con contenuto

  const listsWithContent = lists.filter((list) => {
    const stats = listStats[list.list_id] || {
      totalRequirements: 0,
      totalDays: 0,
      criticalPathDays: 0,
    };

    const requirements = listRequirementStats[list.list_id] || [];

    return (
      stats.totalRequirements > 0 &&
      stats.totalDays > 0 &&
      requirements.length > 0
    );
  });

  if (listsWithContent.length === 0) {
    return {
      series: [],

      metadata: [],

      hasData: false,

      emptyMessage: "Nessuna lista con requisiti stimati",
    };
  }

  // Limite raccomandato per evitare affollamento

  if (listsWithContent.length > 10) {
    return {
      series: [],

      metadata: [],

      hasData: false,

      emptyMessage: "Troppe liste (>10). Usa filtri o vista singola serie.",
    };
  }

  const metadata: SeriesMetadata[] = [];

  const series = listsWithContent.map((list) => {
    const stats = listStats[list.list_id] || {
      totalRequirements: 0,
      totalDays: 0,
      criticalPathDays: 0,
    };

    const requirements = listRequirementStats[list.list_id] || [];

    const technologyLabel =
      list.technology?.trim() || TECHNOLOGY_FALLBACK_LABEL;

    const listColor = getListBaseColor(list.list_id);

    const treemapFillColor = getTreemapFillColor(listColor);

    // Calcola percentuali all'interno della lista

    const listTotal = requirements.reduce(
      (sum, req) => sum + (req.totalDays > 0 ? req.totalDays : 0.1),
      0,
    );

    const data: MultiSeriesDataPoint[] = requirements.map((req) => {
      const safeValue = req.totalDays > 0 ? req.totalDays : 0.1;

      return {
        x: req.title,

        y: safeValue,

        listFillColor: treemapFillColor,

        fillColor: treemapFillColor,

        requirementId: req.reqId,

        priority: req.priority,

        priorityBadge: PRIORITY_BADGE[req.priority],

        priorityColor: getPrioritySolidColor(req.priority),

        state: req.state,

        businessOwner: req.businessOwner,

        percentage: (safeValue / listTotal) * 100,
      };
    });

    // Salva metadata della lista

    metadata.push({
      listId: list.list_id,

      listName: list.name,

      technology: technologyLabel,

      listColor,

      treemapFillColor,

      status: list.status,

      businessOwner: list.default_business_owner || list.owner || '',

      totalDays: stats.totalDays,

      totalRequirements: stats.totalRequirements,

      criticalPathDays: stats.criticalPathDays,
    });

    return {
      name: "",

      data,
    };
  });

  return { series, metadata, hasData: true, emptyMessage: '' };
}

function hideRotatedTreemapLabels(chartEl: Element | null): void {
  if (!chartEl) {
    return;
  }

  const groups = chartEl.querySelectorAll<SVGGElement>(".apexcharts-datalabel");

  groups.forEach((group) => {
    const transform = group.getAttribute("transform") ?? "";

    const isRotated = /rotate\(/i.test(transform);

    group.style.display = isRotated ? "none" : "";
  });
}

export function TreemapApexMultiSeries({
  lists,

  listStats,

  listRequirementStats,

  onSelectList,

  onRequirementSelect,

  containerHeight,

  showLegend = true,
}: TreemapApexMultiSeriesProps) {
  // Stato per gestire il doppio click

  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const lastClickRef = useRef<{
    seriesIndex: number;
    dataPointIndex: number;
    time: number;
  } | null>(null);

  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [colorMode, setColorMode] = useState<ColorMode>("list");

  const DOUBLE_CLICK_DELAY = 400; // Aumentato da 300ms

  const NAVIGATION_DELAY = 2000; // Countdown 2 secondi

  const { series, options, legendEntries, emptyMessage } = useMemo(() => {
    const prepared = prepareMultiSeriesData(
      lists,
      listStats,
      listRequirementStats,
    );

    if (!prepared.hasData) {
      return {
        series: [],

        options: {} as ApexOptions,

        legendEntries: [],

        emptyMessage: prepared.emptyMessage,
      };
    }

    const { series, metadata } = prepared;

    const chartSeries = series.map((serie) => ({
      ...serie,
      data: serie.data.map((point) => ({
        ...point,
        fillColor:
          colorMode === "list" ? point.listFillColor : point.priorityColor,
      })),
    }));

    const listPalette = metadata.map((meta) => meta.treemapFillColor);

    const paletteForMode =
      colorMode === "list"
        ? listPalette
        : [
            getPrioritySolidColor("High"),
            getPrioritySolidColor("Med"),
            getPrioritySolidColor("Low"),
          ];

    // Soglie per visibilità label

    const MIN_LABEL_PERCENTAGE = 1.5;

    const SINGLE_LINE_PERCENTAGE = 3;

    const FULL_DETAILS_PERCENTAGE = 8;

    const options: ApexOptions = {
      chart: {
        type: "treemap",

        height: containerHeight,

        toolbar: { show: false },

        animations: { enabled: true, speed: 400 },

        events: {
          dataPointSelection: (_event, _chartContext, config) => {
            const { seriesIndex, dataPointIndex } = config;

            const now = Date.now();

            // Verifica se è un doppio click (entro 400ms)

            const isDoubleClick =
              lastClickRef.current &&
              lastClickRef.current.seriesIndex === seriesIndex &&
              lastClickRef.current.dataPointIndex === dataPointIndex &&
              now - lastClickRef.current.time < DOUBLE_CLICK_DELAY;

            if (isDoubleClick) {
              // Doppio click -> mostra toast con countdown

              if (clickTimeoutRef.current) {
                clearTimeout(clickTimeoutRef.current);

                clickTimeoutRef.current = null;
              }

              const selectedListMeta = metadata[seriesIndex];

              const list = lists.find(
                (l) => l.list_id === selectedListMeta.listId,
              );

              if (list && onSelectList) {
                let cancelled = false;

                // Mostra toast con pulsante annulla

                const toastId = toast(
                  <div className="flex items-center justify-between gap-3 w-full">
                    <div className="flex items-center gap-2">
                      <span className="text-base">📋</span>

                      <span className="text-sm font-medium">
                        Apertura lista "{list.name}"...
                      </span>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs shrink-0"
                      onClick={() => {
                        cancelled = true;

                        if (navigationTimeoutRef.current) {
                          clearTimeout(navigationTimeoutRef.current);

                          navigationTimeoutRef.current = null;
                        }

                        toast.dismiss(toastId);

                        toast.info("Navigazione annullata", { duration: 1500 });
                      }}
                    >
                      Annulla
                    </Button>
                  </div>,

                  {
                    duration: NAVIGATION_DELAY,

                    position: "top-center",
                  },
                );

                // Naviga dopo il countdown

                navigationTimeoutRef.current = setTimeout(() => {
                  if (!cancelled) {
                    onSelectList(list);
                  }
                }, NAVIGATION_DELAY);
              }

              lastClickRef.current = null;
            } else {
              // Primo click -> attendi per vedere se è doppio click

              lastClickRef.current = { seriesIndex, dataPointIndex, time: now };

              clickTimeoutRef.current = setTimeout(() => {
                // Click singolo -> apri requisito

                const selectedListMeta = metadata[seriesIndex];

                const selectedReqData =
                  chartSeries[seriesIndex].data[dataPointIndex];

                if (selectedReqData?.requirementId && onRequirementSelect) {
                  onRequirementSelect(
                    selectedListMeta.listId,
                    selectedReqData.requirementId,
                  );
                }

                lastClickRef.current = null;
              }, DOUBLE_CLICK_DELAY);
            }
          },

          mounted: (chartContext) => {
            const el = chartContext?.el as Element | null | undefined;
            if (el !== undefined) {
              setTimeout(() => hideRotatedTreemapLabels(el), 0);
            }
          },

          updated: (chartContext) => {
            const el = chartContext?.el as Element | null | undefined;
            if (el !== undefined) {
              setTimeout(() => hideRotatedTreemapLabels(el), 0);
            }
          },
        },
      },

      legend: {
        show: false, // Gestiamo legenda custom
      },

      plotOptions: {
        treemap: {
          distributed: false, // Multiple series richiede distributed=false

          enableShades: false,

          useFillColorAsStroke: false,

          borderRadius: 4,

          dataLabels: {
            format: "truncate",
          },
        },
      },

      stroke: {
        colors: ["rgba(15,23,42,0.22)"],

        width: 1,

        lineCap: "round",
      },

      dataLabels: {
        enabled: true,

        style: {
          fontSize: "11px",

          fontWeight: 600,

          colors: ["rgba(15,23,42,0.92)"],
        },

        dropShadow: {
          enabled: true,

          top: 1,

          left: 0,

          blur: 3,

          opacity: 0.35,

          color: "#f8fafc",
        },

        formatter: function dataLabelFormatter(
          text: string,

          opts: { dataPointIndex: number; seriesIndex: number },
        ) {
          const dataPoint =
            chartSeries[opts.seriesIndex]?.data[opts.dataPointIndex];

          if (!dataPoint) {
            return text;
          }

          // Nascondi label su aree troppo piccole

          if (dataPoint.percentage < MIN_LABEL_PERCENTAGE) {
            return "";
          }

          const maxChars =
            dataPoint.percentage < FULL_DETAILS_PERCENTAGE ? 14 : 24;

          const shortTitle =
            text.length > maxChars ? `${text.slice(0, maxChars - 3)}...` : text;

          const badge = dataPoint.priorityBadge
            ? `[${dataPoint.priorityBadge}]`
            : "";

          const titleWithBadge = badge ? `${badge} ${shortTitle}` : shortTitle;

          // Solo titolo per aree piccole

          if (dataPoint.percentage < SINGLE_LINE_PERCENTAGE) {
            return titleWithBadge;
          }

          // Titolo + giorni per aree medie

          if (dataPoint.percentage < FULL_DETAILS_PERCENTAGE) {
            return `${titleWithBadge}\n${dataPoint.y.toFixed(1)} gg`;
          }

          // Full details per aree grandi

          const priorityLabel = PRIORITY_LABELS[dataPoint.priority];

          const stateLabel = STATE_LABELS[dataPoint.state];

          return `${titleWithBadge}\n${dataPoint.y.toFixed(1)} gg - ${priorityLabel}\n${stateLabel}`;
        },
      },

      colors: paletteForMode,

      tooltip: {
        enabled: true,

        theme: "dark",

        style: { fontSize: "13px", fontFamily: "inherit" },

        custom: function tooltipTemplate({
          dataPointIndex,
          seriesIndex,
          w,
        }: TooltipCustomParams) {
          const listMeta = metadata[seriesIndex];

          const dataPoint = w.config.series[seriesIndex].data[dataPointIndex];

          const priorityLabel = PRIORITY_LABELS[dataPoint.priority];

          const stateLabel = STATE_LABELS[dataPoint.state];

          const priorityColor =
            dataPoint.priorityColor ??
            getPrioritySolidColor(dataPoint.priority);

          const priorityStroke = getPriorityStrokeColor(dataPoint.priority);

          const priorityBadge =
            dataPoint.priorityBadge ?? PRIORITY_BADGE[dataPoint.priority];

          const statusLabel =
            listMeta.status === "Active"
              ? "Attiva"
              : listMeta.status === "Draft"
                ? "Bozza"
                : "Archiviata";

          const ownerInfo = dataPoint.businessOwner
            ? `<div style="margin-top: 4px; font-size: 11px; color: rgba(255,255,255,0.75);">Owner: ${dataPoint.businessOwner}</div>`
            : "";

          return `

            <div style="padding: 10px 12px; min-width: 220px;">

              <!-- Header con Badge doppio click -->

              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">

                <div style="font-size: 11px; color: rgba(255,255,255,0.6); display: flex; align-items: center; gap: 4px;">

                  <span style="display:inline-flex;width:6px;height:6px;border-radius:999px;background:${listMeta.listColor};"></span>

                  <span>${listMeta.listName}</span>

                  <span style="opacity: 0.5;">›</span>

                </div>

                <span style="

                  font-size: 9px;

                  padding: 2px 6px;

                  background: rgba(59, 130, 246, 0.2);

                  border: 1px solid rgba(59, 130, 246, 0.4);

                  border-radius: 4px;

                  color: #60a5fa;

                  white-space: nowrap;

                  font-weight: 600;

                ">

                  2× → Lista

                </span>

              </div>

              

              <!-- Nome Requisito -->

              <div style="font-weight: 600; font-size: 14px; margin-bottom: 6px;">

                ${dataPoint.x}

              </div>

              

              <!-- Priorita + Stato -->

              <div style="font-size: 11px; color: rgba(255,255,255,0.8); margin-bottom: 6px; display:flex; flex-wrap: wrap; align-items:center; gap:10px;">

                <span style="display:inline-flex; align-items:center; gap:6px;">

                  <span style="display:inline-flex;width:10px;height:10px;border-radius:3px;background:${listMeta.listColor};"></span>

                  <span>${listMeta.technology}</span>

                </span>

                <span style="display:inline-flex; align-items:center; gap:6px;">

                  <span style="

                    display:inline-flex;

                    align-items:center;

                    justify-content:center;

                    width:18px;

                    height:18px;

                    border-radius:4px;

                    background:${priorityColor};

                    border:1px solid ${priorityStroke};

                    color:#fff;

                    font-size:10px;

                    font-weight:700;

                  ">

                    ${priorityBadge}

                  </span>

                  <span>${priorityLabel} - ${stateLabel}</span>

                </span>

              </div>

<!-- Metriche -->

              <div style="font-size: 12px; margin-bottom: 2px;">

                ${dataPoint.y.toFixed(1)} gg stimati (${dataPoint.percentage.toFixed(1)}% della lista)

              </div>

              

              <!-- Contesto Lista -->

              <div style="font-size: 11px; color: rgba(255,255,255,0.65); margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.15);">

                Lista: ${listMeta.totalRequirements} req · ${listMeta.totalDays.toFixed(1)} gg tot · ${statusLabel}

                <div style="margin-top:4px;">Critical path: ${listMeta.criticalPathDays.toFixed(1)} gg</div>

              </div>

              

              ${ownerInfo}

            </div>

          `;
        },
      },
    };

    // Legenda: Liste (colori sfondo) + Priorità (colori requisiti)

    const listEntries = metadata.map((meta) => ({
      label: meta.listName,

      color: meta.listColor,

      fillColor: meta.treemapFillColor,

      type: "list" as const,
    }));

    const priorityOrder: Requirement["priority"][] = ["High", "Med", "Low"];

    const priorityEntries = priorityOrder.map((priority) => ({
      label: `Priorita ${PRIORITY_LABELS[priority]}`,

      color: getPrioritySolidColor(priority),

      border: getPriorityStrokeColor(priority),

      badge: PRIORITY_BADGE[priority],

      type: "priority" as const,
    }));

    const legendEntries = [...listEntries, ...priorityEntries];

    return {
      series: chartSeries,

      options,

      legendEntries,

      emptyMessage: undefined,
    };
  }, [
    lists,

    listStats,

    listRequirementStats,

    onSelectList,

    onRequirementSelect,

    containerHeight,

    colorMode,
  ]);

  if (series.length === 0) {
    return (
      <div className="flex items-center justify-center h-full px-6 text-center text-muted-foreground">
        {emptyMessage ?? "Nessun dato disponibile"}
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 min-h-0">
        <Chart
          options={options}
          series={series}
          type="treemap"
          height={containerHeight}
        />
      </div>

      {/* Hint navigazione */}

      <div className="flex items-center justify-center gap-2 py-2 text-[10px] text-muted-foreground/70">
        <span className="inline-flex items-center gap-1">
          <span className="font-semibold">💡 Suggerimento:</span>

          <span>Click = Dettaglio requisito</span>
        </span>

        <span className="opacity-50">•</span>

        <span className="inline-flex items-center gap-1">
          <span>Doppio click = Lista completa</span>

          <span className="text-[9px] px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-blue-400">
            (2s countdown)
          </span>
        </span>
      </div>
      <div className="text-center text-[10px] text-muted-foreground/70 px-4">
        Riempimento pastello = Lista - Badge [A/M/B] = Priorita
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 py-1">
        <Button
          type="button"
          variant={colorMode === "list" ? "secondary" : "ghost"}
          size="sm"
          className="h-6 px-2 text-[10px]"
          onClick={() => setColorMode("list")}
        >
          Palette Liste
        </Button>
        <Button
          type="button"
          variant={colorMode === "priority" ? "secondary" : "ghost"}
          size="sm"
          className="h-6 px-2 text-[10px]"
          onClick={() => setColorMode("priority")}
        >
          Palette Priorita
        </Button>
      </div>

      {showLegend && legendEntries.length > 0 && (
        <div className="mt-4 px-1">
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 items-start sm:items-center justify-center">
            {/* Liste */}

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-foreground/90 mr-1">
                Liste:
              </span>

              {legendEntries

                .filter((e) => e.type === "list")

                .map((entry) => (
                  <div
                    key={entry.label}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <span
                      className="h-3 w-3 rounded-sm shadow-sm border border-white/30"
                      style={{
                        backgroundColor:
                          entry.type === "list"
                            ? entry.fillColor ?? entry.color
                            : entry.color,
                        borderColor: entry.color,
                      }}
                    />

                    <span className="text-xs text-foreground/80">{entry.label}</span>
                  </div>
                ))}
            </div>

            {/* Divider verticale */}

            <div className="hidden sm:block h-8 w-px bg-border" />

            {/* Priorita (Requisiti) */}

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-foreground/90 mr-1">
                Priorita (Requisiti):
              </span>

              {legendEntries

                .filter((e) => e.type === "priority")

                .map((entry) => (
                  <div
                    key={entry.label}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <span
                      className="h-4 w-4 rounded-sm shadow-sm border text-[9px] font-semibold text-white flex items-center justify-center"
                      style={{
                        backgroundColor: entry.color,
                        borderColor: entry.type === 'priority' ? entry.border : entry.color
                      }}
                    >
                      {entry.type === 'priority' ? entry.badge : ''}
                    </span>

                    <span className="text-xs text-foreground/80">{entry.label}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
