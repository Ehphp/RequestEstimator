import { useMemo, useRef, useState } from "react";
import Chart from "react-apexcharts";
import type { ApexOptions } from "apexcharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { List, Requirement } from "../types";

/* =========================================================================
 * Costanti e utilità
 * ========================================================================= */

const TECHNOLOGY_FALLBACK_LABEL = "Tecnologia";

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


// Palette inspired by Tailwind/shadcn-ui theme colors for lists
const LIST_COLOR_PALETTE = [
  "#2563eb", // blue-600 (primary)
  "#0ea5e9", // sky-500 (accent)
  "#f59e0b", // amber-500 (secondary)
  "#10b981", // emerald-500 (success/low)
  "#f43f5e", // rose-500 (destructive/high)
  "#a21caf", // purple-700 (card)
  "#f97316", // orange-500
  "#8b5cf6", // violet-500
  "#14b8a6", // teal-500
  "#eab308", // yellow-500
  "#6366f1", // indigo-500
  "#38bdf8", // sky-400
];

const TREEMAP_PASTEL_BASE = "#f8fafc";
const TREEMAP_PASTEL_WEIGHT = 0.25;

// Priority colors matching Tailwind/shadcn-ui theme
function getPrioritySolidColor(p: Requirement["priority"]) {
  switch (p) {
    case "High": return "#ef4444"; // red-500 (destructive)
    case "Med": return "#f59e0b"; // amber-500 (secondary)
    case "Low":
    default: return "#10b981"; // emerald-500 (success)
  }
}
function getPriorityStrokeColor(p: Requirement["priority"]) {
  switch (p) {
    case "High": return "#b91c1c"; // red-700
    case "Med": return "#b45309"; // amber-700
    case "Low":
    default: return "#047857"; // emerald-700
  }
}

type Rgb = { r: number; g: number; b: number };
export function hexToRgb(hex?: string): Rgb | null {
  if (!hex) return null;
  let sanitized = hex.replace("#", "");
  if (!/^[0-9a-f]{3,6}$/i.test(sanitized)) return null;
  if (sanitized.length === 3) {
    sanitized = sanitized.split("").map((c) => c + c).join("");
  }
  if (sanitized.length !== 6) return null;
  const intVal = parseInt(sanitized, 16);
  return { r: (intVal >> 16) & 255, g: (intVal >> 8) & 255, b: intVal & 255 };
}
function rgbToHex(rgb: Rgb): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[clamp(rgb.r), clamp(rgb.g), clamp(rgb.b)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}
export function mixHexColors(color: string, mix: string, weight: number): string {
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
export function getListBaseColor(listId: string): string {
  if (!listId) return LIST_COLOR_PALETTE[0];
  const hash = hashString(listId);
  return LIST_COLOR_PALETTE[hash % LIST_COLOR_PALETTE.length];
}
function getTreemapFillColor(baseColor: string): string {
  return mixHexColors(baseColor, TREEMAP_PASTEL_BASE, TREEMAP_PASTEL_WEIGHT);
}
function hideRotatedTreemapLabels(chartEl: Element | null): void {
  if (!chartEl) return;
  const groups = chartEl.querySelectorAll<SVGGElement>(".apexcharts-datalabel");
  groups.forEach((group) => {
    const transform = group.getAttribute("transform") ?? "";
    const isRotated = /rotate\(/i.test(transform);
    group.style.display = isRotated ? "none" : "";
  });
}

/* =========================================================================
 * Tipi locali
 * ========================================================================= */

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

/* =========================================================================
 * Props componente
 * ========================================================================= */

export interface TreemapApexMultiSeriesProps {
  lists: List[];
  listStats: Record<string, { totalRequirements: number; totalDays: number; criticalPathDays: number }>;
  listRequirementStats: Record<string, RequirementNode[]>;
  onRequirementSelect?: (listId: string, reqId: string) => void;
  onSelectList?: (list: List) => void;
  containerHeight?: number;
  showLegend?: boolean;
  className?: string;
}

/* =========================================================================
 * Preparazione dati multi-serie
 * ========================================================================= */

function prepareMultiSeriesData(
  lists: List[],
  listStats: TreemapApexMultiSeriesProps["listStats"],
  listRequirementStats: TreemapApexMultiSeriesProps["listRequirementStats"],
) {
  const listsWithContent = lists.filter((list) => {
    const stats = listStats[list.list_id] || {
      totalRequirements: 0,
      totalDays: 0,
      criticalPathDays: 0,
    };
    const requirements = listRequirementStats[list.list_id] || [];
    return stats.totalRequirements > 0 && stats.totalDays > 0 && requirements.length > 0;
  });

  if (listsWithContent.length === 0) {
    return {
      series: [] as Array<{ name: string; data: MultiSeriesDataPoint[] }>,
      metadata: [] as SeriesMetadata[],
      hasData: false,
      emptyMessage: "Nessuna lista con requisiti stimati",
    };
  }

  if (listsWithContent.length > 10) {
    return {
      series: [] as Array<{ name: string; data: MultiSeriesDataPoint[] }>,
      metadata: [] as SeriesMetadata[],
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

    const technologyLabel = list.technology?.trim() || TECHNOLOGY_FALLBACK_LABEL;
    const listColor = getListBaseColor(list.list_id);
    const treemapFillColor = getTreemapFillColor(listColor);

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

    metadata.push({
      listId: list.list_id,
      listName: list.name,
      technology: technologyLabel,
      listColor,
      treemapFillColor,
      status: list.status,
      businessOwner: list.default_business_owner || list.owner || "",
      totalDays: stats.totalDays,
      totalRequirements: stats.totalRequirements,
      criticalPathDays: stats.criticalPathDays,
    });

    return { name: list.name, data };
  });

  return { series, metadata, hasData: true as const, emptyMessage: "" as const };
}

/* =========================================================================
 * Componente
 * ========================================================================= */

export function TreemapApexMultiSeries({
  lists,
  listStats,
  listRequirementStats,
  onSelectList,
  onRequirementSelect,
  containerHeight = 200,
  showLegend = true,
  className,
}: TreemapApexMultiSeriesProps) {
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastClickRef = useRef<{ seriesIndex: number; dataPointIndex: number; time: number } | null>(null);
  const navigationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [colorMode, setColorMode] = useState<ColorMode>("list");

  const DOUBLE_CLICK_DELAY = 400;
  const NAVIGATION_DELAY = 2000;

  const { series, options, legendEntries, emptyMessage } = useMemo(() => {
    const prepared = prepareMultiSeriesData(lists, listStats, listRequirementStats);

    if (!prepared.hasData) {
      return {
        series: [] as Array<{ name: string; data: MultiSeriesDataPoint[] }>,
        options: {} as ApexOptions,
        legendEntries: [] as Array<
          | { type: "list"; label: string; listId: string; color: string; fillColor: string }
          | { type: "priority"; label: string; color: string; border: string; badge: string }
        >,
        emptyMessage: prepared.emptyMessage,
      };
    }

    const { series, metadata } = prepared;

    const chartSeries = series.map((serie) => ({
      ...serie,
      data: serie.data.map((point) => ({
        ...point,
        fillColor: colorMode === "list" ? point.listFillColor : point.priorityColor,
      })),
    }));

    const listPalette = metadata.map((m) => m.treemapFillColor);
    const paletteForMode =
      colorMode === "list"
        ? listPalette
        : [getPrioritySolidColor("High"), getPrioritySolidColor("Med"), getPrioritySolidColor("Low")];

    const MIN_LABEL_PERCENTAGE = 0.5;
    const SINGLE_LINE_PERCENTAGE = 1.5;
    const FULL_DETAILS_PERCENTAGE = 2.0;

    const options: ApexOptions = {
      chart: {
        type: "treemap",
        height: containerHeight,
        toolbar: { show: false },
        animations: { enabled: true, speed: 400 },
        events: {
          dataPointSelection: (_event, _chartCtx, config) => {
            const { seriesIndex, dataPointIndex } = config;
            const now = Date.now();
            const isDoubleClick =
              lastClickRef.current &&
              lastClickRef.current.seriesIndex === seriesIndex &&
              lastClickRef.current.dataPointIndex === dataPointIndex &&
              now - lastClickRef.current.time < DOUBLE_CLICK_DELAY;

            if (isDoubleClick) {
              if (clickTimeoutRef.current) {
                clearTimeout(clickTimeoutRef.current);
                clickTimeoutRef.current = null;
              }

              const selectedListMeta = metadata[seriesIndex];
              const list = lists.find((l) => l.list_id === selectedListMeta.listId);

              if (list && onSelectList) {
                let cancelled = false;

                const id = toast.custom(
                  (t) => (
                    <div className="flex items-center justify-between gap-3 w-full">
                      <div className="flex items-center gap-2">
                        <span className="text-base">📋</span>
                        <span className="text-sm font-medium">Apertura lista “{list.name}”...</span>
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
                          toast.dismiss(t);
                          toast("Navigazione annullata", { duration: 1500 });
                        }}
                      >
                        Annulla
                      </Button>
                    </div>
                  ),
                  { duration: NAVIGATION_DELAY, position: "top-center" },
                );

                navigationTimeoutRef.current = setTimeout(() => {
                  if (!cancelled) {
                    toast.dismiss(id);
                    onSelectList(list);
                  }
                }, NAVIGATION_DELAY);
              }

              lastClickRef.current = null;
            } else {
              lastClickRef.current = { seriesIndex, dataPointIndex, time: now };

              clickTimeoutRef.current = setTimeout(() => {
                const selectedListMeta = metadata[seriesIndex];
                const selectedReq = chartSeries[seriesIndex].data[dataPointIndex];

                if (selectedReq?.requirementId && onRequirementSelect) {
                  onRequirementSelect(selectedListMeta.listId, selectedReq.requirementId);
                }
                lastClickRef.current = null;
              }, DOUBLE_CLICK_DELAY);
            }
          },
          mounted: (chartContext) => {
            const el = chartContext?.el as Element | null | undefined;
            if (el !== undefined) setTimeout(() => hideRotatedTreemapLabels(el), 0);
          },
          updated: (chartContext) => {
            const el = chartContext?.el as Element | null | undefined;
            if (el !== undefined) setTimeout(() => hideRotatedTreemapLabels(el), 0);
          },
        },
      },
      legend: { show: false },
      plotOptions: {
        treemap: {
          distributed: false,
          enableShades: false,
          useFillColorAsStroke: false,
          borderRadius: 4,
          dataLabels: { format: "truncate" },
        },
      },
      stroke: {
        colors: ["hsla(0, 0%, 50%, 0.93)"],
        width: 3,
        lineCap: "round",
      },
      dataLabels: {
        enabled: true,
        style: { fontSize: "11px", fontWeight: 400, colors: ["rgba(247, 249, 255, 0.92)"] },
        dropShadow: { enabled: true, top: 1, left: 0, blur: 3, opacity: 0.55, color: "#0c0c0cff" },
        formatter: function (text: string, opts) {
          const dataPoint = chartSeries[opts.seriesIndex]?.data[opts.dataPointIndex] as MultiSeriesDataPoint | undefined;
          if (!dataPoint) return text;

          if (dataPoint.percentage < MIN_LABEL_PERCENTAGE) return "";

          const maxChars = dataPoint.percentage < FULL_DETAILS_PERCENTAGE ? 14 : 24;
          const shortTitle = text.length > maxChars ? `${text.slice(0, maxChars - 3)}...` : text;
          const badge = dataPoint.priorityBadge ? `[${dataPoint.priorityBadge}]` : "";
          const titleWithBadge = badge ? `${badge} ${shortTitle}` : shortTitle;

          if (dataPoint.percentage < SINGLE_LINE_PERCENTAGE) return titleWithBadge;
          if (dataPoint.percentage < FULL_DETAILS_PERCENTAGE) return `${titleWithBadge}\n${dataPoint.y.toFixed(1)} gg`;

          return `${shortTitle}\n${dataPoint.y.toFixed(1)} gg `;
        },
      },
      colors: paletteForMode,
      tooltip: {
        enabled: true,
        theme: "dark",
        style: { fontSize: "13px", fontFamily: "inherit" },
        custom: function ({ dataPointIndex, seriesIndex, w }: TooltipCustomParams) {
          const listMeta = metadata[seriesIndex];
          const dataPoint = w.config.series[seriesIndex].data[dataPointIndex];
          const priorityLabel = PRIORITY_LABELS[dataPoint.priority];
          const stateLabel = STATE_LABELS[dataPoint.state];
          const priorityColor = dataPoint.priorityColor ?? getPrioritySolidColor(dataPoint.priority);
          const priorityStroke = getPriorityStrokeColor(dataPoint.priority);
          const priorityBadge = dataPoint.priorityBadge ?? PRIORITY_BADGE[dataPoint.priority];

          const statusLabel =
            listMeta.status === "Active" ? "Attiva" : listMeta.status === "Draft" ? "Bozza" : "Archiviata";

          const ownerInfo = dataPoint.businessOwner
            ? `<div style="margin-top: 4px; font-size: 11px; color: rgba(255,255,255,0.75);">Owner: ${dataPoint.businessOwner}</div>`
            : "";

          return `
            <div style="padding: 10px 12px; min-width: 220px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                <div style="font-size:11px;color:rgba(255,255,255,0.6);display:flex;align-items:center;gap:4px;">
                  <span style="display:inline-flex;width:6px;height:6px;border-radius:999px;background:${listMeta.listColor};"></span>
                  <span>${listMeta.listName}</span>
                  <span style="opacity:0.5;">›</span>
                </div>
                <span style="
                  font-size:9px;padding:2px 6px;background:rgba(59,130,246,0.2);
                  border:1px solid rgba(59,130,246,0.4);border-radius:4px;color:#60a5fa;
                  white-space:nowrap;font-weight:600;">
                  2× → Lista
                </span>
              </div>
              <div style="font-weight:600;font-size:14px;margin-bottom:6px;">${dataPoint.x}</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.8);margin-bottom:6px;display:flex;flex-wrap:wrap;align-items:center;gap:10px;">
                <span style="display:inline-flex;align-items:center;gap:6px;">
                  <span style="display:inline-flex;width:10px;height:10px;border-radius:3px;background:${listMeta.listColor};"></span>
                  <span>${listMeta.technology}</span>
                </span>
                <span style="display:inline-flex;align-items:center;gap:6px;">
                  <span style="
                    display:inline-flex;align-items:center;justify-content:center;
                    width:18px;height:18px;border-radius:4px;background:${priorityColor};
                    border:1px solid ${priorityStroke};color:#fff;font-size:10px;font-weight:700;">
                    ${priorityBadge}
                  </span>
                  <span>${priorityLabel} - ${stateLabel}</span>
                </span>
              </div>
              <div style="font-size:12px;margin-bottom:2px;">
                ${dataPoint.y.toFixed(1)} gg stimati (${dataPoint.percentage.toFixed(1)}% della lista)
              </div>
              <div style="font-size:11px;color:rgba(255,255,255,0.65);margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.15);">
                Lista: ${listMeta.totalRequirements} req · ${listMeta.totalDays.toFixed(1)} gg tot · ${statusLabel}
                <div style="margin-top:4px;">Critical path: ${listMeta.criticalPathDays.toFixed(1)} gg</div>
              </div>
              ${ownerInfo}
            </div>
          `;
        },
      },
    };

    const listEntries = metadata.map((m) => ({
      type: "list" as const,
      label: m.listName,
      listId: m.listId,
      color: m.listColor,
      fillColor: m.treemapFillColor,
    }));
    const priorityOrder: Requirement["priority"][] = ["High", "Med", "Low"];
    const priorityEntries = priorityOrder.map((p) => ({
      type: "priority" as const,
      label: `Priorità ${PRIORITY_LABELS[p]}`,
      color: getPrioritySolidColor(p),
      border: getPriorityStrokeColor(p),
      badge: PRIORITY_BADGE[p],
    }));

    return {
      series: chartSeries,
      options,
      legendEntries: [...listEntries, ...priorityEntries],
      emptyMessage: undefined as string | undefined,
    };
  }, [lists, listStats, listRequirementStats, onSelectList, onRequirementSelect, containerHeight, colorMode]);

  if (series.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border bg-background text-card-foreground shadow-sm my-4 py-6",
          className,
        )}
        style={{ borderColor: 'hsl(var(--card-border))' }}
      >
        <div className="flex items-center justify-center h-full px-6 text-center text-muted-foreground">
          {emptyMessage ?? "Nessun dato disponibile"}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("rounded-lg border bg-background text-card-foreground shadow-sm my-4", className)}
      style={{ borderColor: 'hsl(var(--card-border))' }}
    >
      {/* Header toolbar: compact title (optional) + palette buttons */}
      <div className="flex items-center justify-between px-3 pt-2">
        <div className="text-sm font-semibold text-foreground/90">Treemap</div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={colorMode === "list" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={() => setColorMode("list")}
          >
            Palette Liste
          </Button>
          <Button
            type="button"
            variant={colorMode === "priority" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={() => setColorMode("priority")}
          >
            Palette Priorità
          </Button>
        </div>
      </div>

      <div className="w-full flex flex-col px-3 pb-3">
        <div className="min-h-0">
          <Chart options={options} series={series} type="treemap" height={containerHeight} />
        </div>

        {/* compact spacer; legend (if needed) can be enabled here */}
        <div className="mt-2" />

        {/* {showLegend && legendEntries.length > 0 && (
          <div className="mt-4 px-1">
            <div className="flex gap-4 sm:gap-8 items-start sm:items-center justify-center">
              <div className="flex  items-center gap-2">
                <span className="text-xs font-semibold text-foreground/90 mr-1">Liste:</span>
                {legendEntries
                  .filter((e) => e.type === "list")
                  .map((entry, idx) => {
                    const listEntry = entry as Extract<typeof entry, { type: "list" }>;
                    return (
                      <div
                        key={listEntry.listId || `list-legend-${idx}`}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <span
                          className="h-3 w-3 rounded-sm shadow-sm border border-white/30"
                          style={{
                            backgroundColor: listEntry.fillColor ?? listEntry.color,
                            borderColor: listEntry.color,
                          }}
                        />
                        <span className="text-xs text-foreground/80">{listEntry.label}</span>
                      </div>
                    );
                  })}
              </div>


            </div>
          </div>
        )} */}
      </div>
    </div>
  );
}