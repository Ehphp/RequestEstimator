import { useState, useEffect, useMemo } from 'react';
import { Calendar, Users, SlidersHorizontal, HelpCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
    Tooltip as UITooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from '@/components/ui/tooltip';
import { List, Requirement, DashboardFilters, RequirementWithEstimate } from '../types';
import { TreemapApexRequirements } from './TreemapApexRequirements';
import {
    prepareRequirementsWithEstimates,
    calculateDashboardKPIs,
    calculateNeutralProjection,
    calculatePriorityFirstProjection,
    calculateConfidenceScore,
    calculateDeviationAlerts,
    calculateRequirementCriticalPath
} from '../lib/calculations';
import { getPrioritySolidClass } from '@/lib/utils';
import { RISK_THRESHOLDS } from '@/lib/constants';

// Mini Sparkline component
const MiniSparkline = ({
    values,
    width = 50,
    height = 20,
    color = '#3b82f6'
}: {
    values: number[];
    width?: number;
    height?: number;
    color?: string;
}) => {
    if (values.length < 2) return null;

    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;

    const points = values.map((val, idx) => {
        const x = (idx / (values.length - 1)) * width;
        const y = height - ((val - min) / range) * height;
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg width={width} height={height} className="inline-block ml-2">
            <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
};

// Mini Radial Gauge per difficoltà
const MiniRadialGauge = ({
    percentage,
    size = 24,
    strokeWidth = 3,
    color = '#10b981'
}: {
    percentage: number;
    size?: number;
    strokeWidth?: number;
    color?: string;
}) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;

    return (
        <svg width={size} height={size} className="inline-block ml-1 -rotate-90">
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                className="opacity-20"
            />
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
            />
        </svg>
    );
};

interface DashboardViewProps {
    list: List;
    requirements: Requirement[];
    onBack: () => void;
    onSelectRequirement: (requirement: Requirement) => void;
}

export function DashboardView({ list, requirements, onBack, onSelectRequirement }: DashboardViewProps) {
    const [reqsWithEstimates, setReqsWithEstimates] = useState<RequirementWithEstimate[]>([]);
    const [filters, setFilters] = useState<DashboardFilters>({
        priorities: ['High', 'Med', 'Low'],
        tags: [],
        startDate: new Date().toISOString().split('T')[0],
        nDevelopers: 3,
        excludeWeekends: true,
        holidays: []
    });
    const [priorityPolicy, setPriorityPolicy] = useState<'Neutral' | 'PriorityFirst'>('Neutral');

    useEffect(() => {
        loadData();
    }, [requirements]); // eslint-disable-line react-hooks/exhaustive-deps

    const loadData = async () => {
        const data = await prepareRequirementsWithEstimates(requirements);
        setReqsWithEstimates(data);
    };

    // Filtra requisiti in base ai filtri attivi
    const filteredReqs = useMemo(() => {
        return reqsWithEstimates.filter(r => {
            // Filtro priorità
            if (!filters.priorities.includes(r.requirement.priority)) return false;

            // Filtro tag (se specificato)
            if (filters.tags.length > 0) {
                const hasMatchingTag = r.tags.some(tag => filters.tags.includes(tag));
                if (!hasMatchingTag) return false;
            }

            return true;
        });
    }, [reqsWithEstimates, filters]);

    const criticalPathDays = useMemo(() => {
        return calculateRequirementCriticalPath(filteredReqs);
    }, [filteredReqs]);

    // Calcola KPI
    const kpis = useMemo(() => {
        return calculateDashboardKPIs(filteredReqs);
    }, [filteredReqs]);

    const effectiveEffortDays = useMemo(() => {
        return Math.max(kpis.totalDays, criticalPathDays * filters.nDevelopers);
    }, [kpis.totalDays, criticalPathDays, filters.nDevelopers]);

    // Calcola proiezioni
    const projection = useMemo(() => {
        if (priorityPolicy === 'Neutral') {
            return calculateNeutralProjection(
                effectiveEffortDays,
                filters.nDevelopers,
                filters.startDate,
                filters.excludeWeekends,
                filters.holidays
            );
        } else {
            const scalingFactor = kpis.totalDays > 0 ? effectiveEffortDays / kpis.totalDays : 1;
            const adjustedEffortByPriority = {
                High: kpis.effortByPriority.High * scalingFactor,
                Med: kpis.effortByPriority.Med * scalingFactor,
                Low: kpis.effortByPriority.Low * scalingFactor
            };
            return calculatePriorityFirstProjection(
                adjustedEffortByPriority,
                filters.nDevelopers,
                filters.startDate,
                filters.excludeWeekends,
                filters.holidays
            );
        }
    }, [kpis, filters, priorityPolicy, effectiveEffortDays]);

    // Calcola Confidence Score
    const confidence = useMemo(() => {
        return calculateConfidenceScore(kpis, requirements.length);
    }, [kpis, requirements.length]);

    // Calcola Deviation Alerts
    const alerts = useMemo(() => {
        return calculateDeviationAlerts(kpis, projection.totalWorkdays, effectiveEffortDays);
    }, [kpis, projection, effectiveEffortDays]);

    // Prepara dati per sparklines
    const sparklineData = useMemo(() => {
        // Estrai tutte le stime ordinate
        const estimates = filteredReqs
            .filter(r => r.estimationDays > 0)
            .map(r => r.estimationDays)
            .sort((a, b) => a - b);

        // Per priority: calcola cumulative effort
        const priorityEfforts = [
            kpis.effortByPriority.High,
            kpis.effortByPriority.Med,
            kpis.effortByPriority.Low
        ];

        return {
            estimates,
            priorityEfforts
        };
    }, [filteredReqs, kpis]);

    // Prepara Risk Heatmap data
    const riskHeatmapData = useMemo(() => {
        // Matrix: [priority][riskBand] = count
        const matrix: Record<string, Record<string, number>> = {
            High: { None: 0, Low: 0, Medium: 0, High: 0 },
            Med: { None: 0, Low: 0, Medium: 0, High: 0 },
            Low: { None: 0, Low: 0, Medium: 0, High: 0 }
        };

        filteredReqs.forEach(req => {
            if (!req.estimate) return;

            const priority = req.requirement.priority;
            const riskScore = req.estimate.risk_score;

            let riskBand: 'None' | 'Low' | 'Medium' | 'High';
            if (riskScore === RISK_THRESHOLDS.NONE) riskBand = 'None';
            else if (riskScore <= RISK_THRESHOLDS.LOW) riskBand = 'Low';
            else if (riskScore <= RISK_THRESHOLDS.MEDIUM) riskBand = 'Medium';
            else riskBand = 'High';

            matrix[priority][riskBand]++;
        });

        // Trova max per normalizzazione colori
        let maxCount = 0;
        Object.values(matrix).forEach(row => {
            Object.values(row).forEach(count => {
                if (count > maxCount) maxCount = count;
            });
        });

        return { matrix, maxCount };
    }, [filteredReqs]);

    const handleTogglePriority = (priority: 'High' | 'Med' | 'Low') => {
        setFilters(prev => ({
            ...prev,
            priorities: prev.priorities.includes(priority)
                ? prev.priorities.filter(p => p !== priority)
                : [...prev.priorities, priority]
        }));
    };

    // Helper per formattare le date in modo leggibile
    const formatDate = (dateString: string) => {
        const [year, month, day] = dateString.split('-');
        return `${day}/${month}/${year}`;
    };

    return (
        <div className="space-y-2">
            {/* Header con metriche integrate */}
            <div className="flex items-center justify-end">
                <div className="flex items-center gap-3 text-xs">
                    {filteredReqs.length === requirements.length ? (
                        <>
                            <span className="font-semibold">{filteredReqs.length} requisiti</span>
                            <span className="text-muted-foreground">•</span>
                        </>
                    ) : (
                        <>
                            <span className="font-semibold">
                                {filteredReqs.length} di {requirements.length} requisiti
                            </span>
                            <Badge variant="secondary" className="text-xs">Filtrati</Badge>
                            <span className="text-muted-foreground">•</span>
                        </>
                    )}
                    <span className="font-semibold">{kpis.totalDays} gg/uomo</span>
                    <span className="text-muted-foreground">•</span>
                    <TooltipProvider>
                        <UITooltip>
                            <TooltipTrigger asChild>
                                <Badge
                                    variant="outline"
                                    className={`gap-1 cursor-help ${confidence.level === 'high'
                                        ? 'text-green-600 border-green-600'
                                        : confidence.level === 'medium'
                                            ? 'text-yellow-600 border-yellow-600'
                                            : 'text-red-600 border-red-600'
                                        }`}
                                >
                                    <span className="w-2 h-2 rounded-full" style={{
                                        backgroundColor: confidence.level === 'high'
                                            ? '#16a34a'
                                            : confidence.level === 'medium'
                                                ? '#ca8a04'
                                                : '#dc2626'
                                    }}></span>
                                    {confidence.score}%
                                </Badge>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-[240px]">
                                <div className="space-y-2">
                                    <div>
                                        <p className="text-xs font-semibold mb-1">Confidence Score</p>
                                        <p className="text-xs text-muted-foreground">
                                            Affidabilità complessiva della dashboard basata su qualità e completezza dati
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs border-t pt-2">
                                        <div>
                                            <div className="text-muted-foreground">Completezza</div>
                                            <div className="font-bold">{confidence.breakdown.completeness}/40</div>
                                        </div>
                                        <div>
                                            <div className="text-muted-foreground">Consistenza</div>
                                            <div className="font-bold">{confidence.breakdown.consistency}/30</div>
                                        </div>
                                        <div>
                                            <div className="text-muted-foreground">Volume</div>
                                            <div className="font-bold">{confidence.breakdown.volume}/20</div>
                                        </div>
                                        <div>
                                            <div className="text-muted-foreground">Tags</div>
                                            <div className="font-bold">{confidence.breakdown.categorization}/10</div>
                                        </div>
                                    </div>
                                    <div className="text-xs text-muted-foreground border-t pt-2">
                                        {confidence.level === 'high' && '🟢 Alta affidabilità - dati robusti'}
                                        {confidence.level === 'medium' && '🟡 Media affidabilità - migliorabile'}
                                        {confidence.level === 'low' && '🔴 Bassa affidabilità - dati insufficienti'}
                                    </div>
                                </div>
                            </TooltipContent>
                        </UITooltip>
                    </TooltipProvider>
                    <span className="text-muted-foreground">•</span>
                    <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
                        <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                        Live
                    </Badge>
                </div>
            </div>

            {/* Burn-Down Velocity Indicator */}
            {(() => {
                // Protezione edge case: nDevelopers deve essere >= 1
                if (filters.nDevelopers < 1 || projection.totalWorkdays === 0) {
                    return null;
                }

                // Calcola velocity corretta:
                // - totalDays = giorni/uomo totali necessari
                // - projection.totalWorkdays = giorni lavorativi dal calendario
                // - nDevelopers = numero sviluppatori
                // - Capacity disponibile = totalWorkdays * nDevelopers (gg/uomo disponibili)
                // - Velocity = totalDays / capacity (quanto "veloce" consumi la capacity)
                // - Ideale = 1.0 (consumi esattamente la capacity disponibile)
                const availableCapacity = projection.totalWorkdays * filters.nDevelopers;
                const velocity = availableCapacity > 0 ? kpis.totalDays / availableCapacity : 0;
                const idealVelocity = 1.0;

                // Delta: velocity > 1 = serve più tempo/persone, velocity < 1 = capacity in eccesso
                const delta = ((velocity - idealVelocity) / idealVelocity) * 100;
                const isHealthy = Math.abs(delta) <= 20; // ±20% è accettabile

                // Se c'è una target date, verifica se è fattibile
                let targetWarning = '';
                let daysDiff = 0;
                if (filters.targetDate) {
                    const projectedEnd = new Date(projection.finishDate);
                    const targetEnd = new Date(filters.targetDate);
                    daysDiff = Math.floor((targetEnd.getTime() - projectedEnd.getTime()) / (1000 * 60 * 60 * 24));

                    if (daysDiff < 0) {
                        targetWarning = `⚠️ In ritardo di ${Math.abs(daysDiff)} giorni`;
                    } else if (daysDiff === 0) {
                        targetWarning = '✓ Perfettamente in linea';
                    } else {
                        targetWarning = `✓ In anticipo di ${daysDiff} giorni`;
                    }
                }

                return (
                    <TooltipProvider>
                        <UITooltip>
                            <TooltipTrigger asChild>
                                <div className="flex items-center gap-2">
                                    <div className="relative h-5 flex-1 bg-gradient-to-r from-blue-50 via-blue-100 to-blue-50 dark:from-blue-950 dark:via-blue-900 dark:to-blue-950 rounded-md overflow-hidden border cursor-help">
                                        {/* Baseline marker al 50% */}
                                        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-blue-400 dark:bg-blue-600 opacity-50" />

                                        {/* Velocity bar */}
                                        <div
                                            className={`absolute top-0 bottom-0 left-0 transition-all duration-500 ${isHealthy
                                                ? 'bg-gradient-to-r from-green-400 to-green-500'
                                                : delta > 0
                                                    ? 'bg-gradient-to-r from-orange-400 to-red-500'
                                                    : 'bg-gradient-to-r from-blue-400 to-blue-500'
                                                }`}
                                            style={{
                                                width: `${Math.min(100, Math.max(5, 50 + delta / 2))}%`,
                                                opacity: 0.8
                                            }}
                                        />

                                        {/* Label centrale */}
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span className="text-[10px] font-bold text-gray-900 dark:text-gray-100 drop-shadow-sm px-2 py-0.5 bg-white/60 dark:bg-black/40 rounded">
                                                Velocity: {velocity.toFixed(2)}x
                                                {isHealthy && ' ✓'}
                                                {!isHealthy && delta > 0 && ' ⚠️'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Badge target date - compatto inline */}
                                    {targetWarning && (
                                        <div
                                            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold whitespace-nowrap cursor-help ${daysDiff < 0
                                                ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700'
                                                : daysDiff === 0
                                                    ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700'
                                                    : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700'
                                                }`}
                                        >
                                            <span className="text-[10px]">
                                                {daysDiff < 0 ? '⚠️' : daysDiff === 0 ? '✓' : 'ℹ️'}
                                            </span>
                                            <span>
                                                {daysDiff < 0 ? '-' : daysDiff === 0 ? '±' : '+'}{Math.abs(daysDiff)}d
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-[300px]">
                                <div className="space-y-2">
                                    <div>
                                        <p className="text-xs font-semibold mb-1">Project Velocity</p>
                                        <p className="text-xs text-muted-foreground">
                                            Rapporto tra effort richiesto e capacity disponibile (workdays × team size)
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs border-t pt-2">
                                        <div>
                                            <div className="text-muted-foreground">Velocity</div>
                                            <div className="font-bold">{velocity.toFixed(2)}x</div>
                                        </div>
                                        <div>
                                            <div className="text-muted-foreground">Ideale</div>
                                            <div className="font-bold">{idealVelocity.toFixed(2)}x</div>
                                        </div>
                                        <div>
                                            <div className="text-muted-foreground">Effort</div>
                                            <div className="font-bold">{kpis.totalDays} gg/uomo</div>
                                        </div>
                                        <div>
                                            <div className="text-muted-foreground">Capacity</div>
                                            <div className="font-bold">{availableCapacity.toFixed(0)} gg/uomo</div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 gap-1 text-xs border-t pt-2">
                                        <div>
                                            <div className="text-muted-foreground">Critical path</div>
                                            <div className="font-bold">{criticalPathDays.toFixed(1)} gg sequenziali</div>
                                        </div>
                                        <div className={`font-bold ${delta > 20 ? 'text-red-500' : delta < -20 ? 'text-blue-500' : 'text-green-500'}`}>
                                            Delta: {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
                                        </div>
                                    </div>
                                    <div className="text-xs border-t pt-2">
                                        {isHealthy && (
                                            <p className="text-green-600">✓ Bilanciato - effort e capacity allineati (±20%)</p>
                                        )}
                                        {!isHealthy && delta > 20 && (
                                            <p className="text-orange-600">⚠️ Overload - serve più tempo o più risorse ({delta.toFixed(0)}% sopra capacity)</p>
                                        )}
                                        {!isHealthy && delta < -20 && (
                                            <p className="text-blue-600">ℹ️ Under-utilized - capacity eccessiva ({Math.abs(delta).toFixed(0)}% in più del necessario)</p>
                                        )}
                                    </div>
                                    {targetWarning && (
                                        <div className="text-xs border-t pt-2">
                                            <p className="font-semibold mb-1">Target Date</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <div className="text-muted-foreground">Proiezione</div>
                                                    <div className="font-mono text-[11px]">{new Date(projection.finishDate).toLocaleDateString('it-IT')}</div>
                                                </div>
                                                <div>
                                                    <div className="text-muted-foreground">Target</div>
                                                    <div className="font-mono text-[11px]">{new Date(filters.targetDate!).toLocaleDateString('it-IT')}</div>
                                                </div>
                                            </div>
                                            <p className={`mt-2 font-semibold ${daysDiff < 0 ? 'text-red-600' : daysDiff === 0 ? 'text-green-600' : 'text-blue-600'}`}>
                                                {targetWarning}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </TooltipContent>
                        </UITooltip>
                    </TooltipProvider>
                );
            })()}

            {/* KPI Row compatta - 5 cards inline con hover expansion */}
            <div className="grid grid-cols-5 gap-1.5">
                {/* Card 1: Metriche Base - Compatta con hover */}
                <Card className="border-l-4 border-l-blue-500 group">
                    <CardContent className="p-1.5">
                        <div className="flex items-baseline justify-between">
                            <div className="text-[10px] text-muted-foreground">Metriche</div>
                        </div>
                        <TooltipProvider>
                            <UITooltip>
                                <TooltipTrigger asChild>
                                    <div className="cursor-help">
                                        <div className="text-lg font-bold text-blue-600 flex items-center leading-none mt-0.5">
                                            {kpis.totalDays}
                                            {sparklineData.estimates.length >= 3 && (
                                                <MiniSparkline
                                                    values={sparklineData.estimates.slice(0, 10)}
                                                    width={40}
                                                    height={16}
                                                    color="#3b82f6"
                                                />
                                            )}
                                            {kpis.totalDays > 100 && kpis.totalDays <= 200 && (
                                                <span className="text-orange-500 text-xs ml-1" title="Attenzione: progetto medio-grande">⚠️</span>
                                            )}
                                            {kpis.totalDays > 200 && (
                                                <span className="text-red-500 text-xs ml-1" title="Attenzione: progetto molto grande">🔴</span>
                                            )}
                                        </div>
                                        <div className="text-[9px] text-muted-foreground leading-none">gg totali</div>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[200px]">
                                    <div className="space-y-1">
                                        <p className="text-xs font-semibold">Metriche Base</p>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div>
                                                <div className="text-muted-foreground">Totale</div>
                                                <div className="font-bold">{kpis.totalDays} gg</div>
                                            </div>
                                            <div>
                                                <div className="text-muted-foreground">Media</div>
                                                <div className="font-bold">{kpis.avgDays} gg</div>
                                            </div>
                                            <div>
                                                <div className="text-muted-foreground">Mediana</div>
                                                <div className="font-bold">{kpis.medianDays} gg</div>
                                            </div>
                                            <div>
                                                <div className="text-muted-foreground">P80</div>
                                                <div className="font-bold">{kpis.p80Days} gg</div>
                                            </div>
                                        </div>
                                    </div>
                                </TooltipContent>
                            </UITooltip>
                        </TooltipProvider>
                    </CardContent>
                </Card>

                {/* Card 2: Priority Mix - Compatta */}
                <Card className="border-l-4 border-l-red-500 group">
                    <CardContent className="p-1.5">
                        <div className="flex items-baseline justify-between mb-0.5">
                            <div className="text-[10px] text-muted-foreground">Priority</div>
                        </div>
                        <TooltipProvider>
                            <div className="space-y-0.5">
                                <div className="flex items-center justify-center gap-1">
                                    <UITooltip>
                                        <TooltipTrigger asChild>
                                            <Badge className={getPrioritySolidClass('High') + ' cursor-help text-[10px] px-1 py-0 h-4'}>
                                                H
                                            </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p className="text-xs font-semibold">High Priority</p>
                                            <p className="text-xs">{kpis.effortByPriority.High}gg ({kpis.effortByPriorityPct.High}%)</p>
                                            <p className="text-xs text-muted-foreground">{kpis.priorityMix.High} requisiti</p>
                                        </TooltipContent>
                                    </UITooltip>

                                    <UITooltip>
                                        <TooltipTrigger asChild>
                                            <Badge className={getPrioritySolidClass('Med') + ' cursor-help text-[10px] px-1 py-0 h-4'}>
                                                M
                                            </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p className="text-xs font-semibold">Medium Priority</p>
                                            <p className="text-xs">{kpis.effortByPriority.Med}gg ({kpis.effortByPriorityPct.Med}%)</p>
                                            <p className="text-xs text-muted-foreground">{kpis.priorityMix.Med} requisiti</p>
                                        </TooltipContent>
                                    </UITooltip>

                                    <UITooltip>
                                        <TooltipTrigger asChild>
                                            <Badge className={getPrioritySolidClass('Low') + ' cursor-help text-[10px] px-1 py-0 h-4'}>
                                                L
                                            </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p className="text-xs font-semibold">Low Priority</p>
                                            <p className="text-xs">{kpis.effortByPriority.Low}gg ({kpis.effortByPriorityPct.Low}%)</p>
                                            <p className="text-xs text-muted-foreground">{kpis.priorityMix.Low} requisiti</p>
                                        </TooltipContent>
                                    </UITooltip>
                                </div>

                                {/* Mini stacked bar - effort % per priority */}
                                <div className="w-full h-1 flex rounded-full overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    <UITooltip>
                                        <TooltipTrigger asChild>
                                            <div
                                                className="bg-red-500 cursor-help"
                                                style={{ width: `${kpis.effortByPriorityPct.High}%` }}
                                            />
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom">
                                            <p className="text-xs">High: {kpis.effortByPriorityPct.High}%</p>
                                        </TooltipContent>
                                    </UITooltip>
                                    <UITooltip>
                                        <TooltipTrigger asChild>
                                            <div
                                                className="bg-yellow-500 cursor-help"
                                                style={{ width: `${kpis.effortByPriorityPct.Med}%` }}
                                            />
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom">
                                            <p className="text-xs">Med: {kpis.effortByPriorityPct.Med}%</p>
                                        </TooltipContent>
                                    </UITooltip>
                                    <UITooltip>
                                        <TooltipTrigger asChild>
                                            <div
                                                className="bg-green-500 cursor-help"
                                                style={{ width: `${kpis.effortByPriorityPct.Low}%` }}
                                            />
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom">
                                            <p className="text-xs">Low: {kpis.effortByPriorityPct.Low}%</p>
                                        </TooltipContent>
                                    </UITooltip>
                                </div>
                            </div>
                        </TooltipProvider>
                    </CardContent>
                </Card>

                {/* Card 3: Mix Difficoltà - Compatta con cerchi */}
                <Card className="border-l-4 border-l-green-500 group">
                    <CardContent className="p-1.5">
                        <div className="flex items-baseline justify-between mb-0.5">
                            <div className="text-[10px] text-muted-foreground">Difficoltà</div>
                        </div>
                        <TooltipProvider>
                            <div className="flex items-center justify-center gap-1 group-hover:gap-1.5 transition-all duration-300">
                                {/* Low - Verde */}
                                <UITooltip>
                                    <TooltipTrigger asChild>
                                        <div
                                            className="rounded-full bg-green-500 flex items-center justify-center text-white font-bold cursor-help transition-all duration-300 group-hover:scale-110"
                                            style={{
                                                width: `${Math.max(16, Math.min(28, 16 + (kpis.difficultyMix.low || 0) * 1.5))}px`,
                                                height: `${Math.max(16, Math.min(28, 16 + (kpis.difficultyMix.low || 0) * 1.5))}px`,
                                            }}
                                        >
                                            <span className="text-[9px] opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                {kpis.difficultyMix.low || 0}
                                            </span>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="text-xs font-semibold">Bassa</p>
                                        <p className="text-xs">{kpis.difficultyMix.low || 0} requisiti</p>
                                    </TooltipContent>
                                </UITooltip>

                                {/* Medium - Giallo */}
                                <UITooltip>
                                    <TooltipTrigger asChild>
                                        <div
                                            className="rounded-full bg-yellow-500 flex items-center justify-center text-white font-bold cursor-help transition-all duration-300 group-hover:scale-110"
                                            style={{
                                                width: `${Math.max(16, Math.min(28, 16 + (kpis.difficultyMix.medium || 0) * 1.5))}px`,
                                                height: `${Math.max(16, Math.min(28, 16 + (kpis.difficultyMix.medium || 0) * 1.5))}px`,
                                            }}
                                        >
                                            <span className="text-[9px] opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                {kpis.difficultyMix.medium || 0}
                                            </span>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="text-xs font-semibold">Media</p>
                                        <p className="text-xs">{kpis.difficultyMix.medium || 0} requisiti</p>
                                    </TooltipContent>
                                </UITooltip>

                                {/* High - Rosso */}
                                <UITooltip>
                                    <TooltipTrigger asChild>
                                        <div
                                            className="rounded-full bg-red-500 flex items-center justify-center text-white font-bold cursor-help transition-all duration-300 group-hover:scale-110"
                                            style={{
                                                width: `${Math.max(16, Math.min(28, 16 + (kpis.difficultyMix.high || 0) * 1.5))}px`,
                                                height: `${Math.max(16, Math.min(28, 16 + (kpis.difficultyMix.high || 0) * 1.5))}px`,
                                            }}
                                        >
                                            <span className="text-[9px] opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                {kpis.difficultyMix.high || 0}
                                            </span>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="text-xs font-semibold">Alta</p>
                                        <p className="text-xs">{kpis.difficultyMix.high || 0} requisiti</p>
                                    </TooltipContent>
                                </UITooltip>
                            </div>
                            {/* Mini radial gauge per % difficoltà alta */}
                            <div className="flex items-center justify-center mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <span className="text-[9px] text-muted-foreground mr-0.5">High:</span>
                                <MiniRadialGauge
                                    percentage={(() => {
                                        const total = kpis.difficultyMix.low + kpis.difficultyMix.medium + kpis.difficultyMix.high;
                                        return total > 0 ? Math.round((kpis.difficultyMix.high / total) * 100) : 0;
                                    })()}
                                    size={16}
                                    strokeWidth={2}
                                    color="#ef4444"
                                />
                                <span className="text-[9px] font-semibold ml-0.5">
                                    {(() => {
                                        const total = kpis.difficultyMix.low + kpis.difficultyMix.medium + kpis.difficultyMix.high;
                                        return total > 0 ? Math.round((kpis.difficultyMix.high / total) * 100) : 0;
                                    })()}%
                                </span>
                            </div>
                        </TooltipProvider>
                    </CardContent>
                </Card>

                {/* Card 4: Top Tag per Effort - Compatta con Tooltip */}
                {kpis.topTagByEffort && (
                    <Card className="border-l-4 border-l-blue-500">
                        <CardContent className="p-1.5">
                            <TooltipProvider>
                                <UITooltip>
                                    <TooltipTrigger asChild>
                                        <div className="cursor-help">
                                            <div className="flex items-baseline justify-between mb-0.5">
                                                <span className="text-[10px] text-muted-foreground">Top Tag</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <Badge variant="outline" className="text-[9px] truncate max-w-[70px] px-1 py-0 h-4">
                                                    {kpis.topTagByEffort.tag}
                                                </Badge>
                                                <span className="text-base font-bold text-blue-600 leading-none">
                                                    {kpis.topTagByEffort.effort}gg
                                                </span>
                                            </div>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-[200px]">
                                        <div className="space-y-1">
                                            <p className="text-xs font-semibold">Top Tag per Effort</p>
                                            <div className="flex items-center justify-between gap-2">
                                                <Badge variant="outline" className="text-xs">
                                                    {kpis.topTagByEffort.tag}
                                                </Badge>
                                                <span className="text-sm font-bold text-blue-600">
                                                    {kpis.topTagByEffort.effort} giorni
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Tag con il maggiore effort totale nel progetto
                                            </p>
                                        </div>
                                    </TooltipContent>
                                </UITooltip>
                            </TooltipProvider>
                        </CardContent>
                    </Card>
                )}

                {/* Card 5: Timeline - Compatta */}
                <Card className="border-l-4 border-l-purple-500">
                    <CardContent className="p-1.5">
                        <div className="flex items-baseline justify-between mb-0.5">
                            <span className="text-[10px] text-muted-foreground">Timeline</span>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-3.5 px-1 text-[9px] hover:bg-purple-100 dark:hover:bg-purple-900"
                                onClick={() => setPriorityPolicy(priorityPolicy === 'Neutral' ? 'PriorityFirst' : 'Neutral')}
                                title={`Cambia strategia: ${priorityPolicy}`}
                            >
                                ⇄
                            </Button>
                        </div>
                        <div className="text-lg font-bold text-purple-600 leading-none">
                            {formatDate(projection.finishDate)}
                        </div>
                        <div className="text-[9px] text-muted-foreground leading-none mt-0.5">
                            {projection.totalWorkdays} gg da {formatDate(filters.startDate)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Deviation Alerts Bar */}
            {alerts.length > 0 && (
                <div className="flex items-center gap-2 px-2 py-1 bg-muted/50 rounded-md border">
                    <TooltipProvider>
                        {alerts.map((alert, idx) => (
                            <UITooltip key={idx}>
                                <TooltipTrigger asChild>
                                    <Badge
                                        variant="outline"
                                        className={`gap-1 text-xs cursor-help ${alert.type === 'critical'
                                            ? 'border-red-500 text-red-700 dark:text-red-400'
                                            : alert.type === 'warning'
                                                ? 'border-yellow-500 text-yellow-700 dark:text-yellow-400'
                                                : 'border-blue-500 text-blue-700 dark:text-blue-400'
                                            }`}
                                    >
                                        <span>{alert.icon}</span>
                                        <span>{alert.message}</span>
                                    </Badge>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-[280px]">
                                    <p className="text-xs">{alert.tooltip}</p>
                                </TooltipContent>
                            </UITooltip>
                        ))}
                    </TooltipProvider>
                </div>
            )}

            {/* Risk Heatmap Matrix */}
            {riskHeatmapData.maxCount > 0 && (
                <Card className="border-l-4 border-l-orange-500">
                    <CardHeader className="pb-1 px-2 pt-1.5">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm">Risk/Priority Correlation</CardTitle>
                            <TooltipProvider>
                                <UITooltip>
                                    <TooltipTrigger asChild>
                                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="max-w-xs">
                                        <p className="text-xs">
                                            Matrice di correlazione tra priorità e livello di rischio.
                                            Intensità colore = numero requisiti in quella categoria.
                                        </p>
                                    </TooltipContent>
                                </UITooltip>
                            </TooltipProvider>
                        </div>
                    </CardHeader>
                    <CardContent className="px-2 pb-1.5">
                        <div className="grid grid-cols-5 gap-0.5 text-[10px]">
                            {/* Header row */}
                            <div className="text-right pr-1 text-muted-foreground font-semibold"></div>
                            <div className="text-center text-muted-foreground font-semibold">None</div>
                            <div className="text-center text-muted-foreground font-semibold">Low</div>
                            <div className="text-center text-muted-foreground font-semibold">Med</div>
                            <div className="text-center text-muted-foreground font-semibold">High</div>

                            {/* High Priority row */}
                            <div className="text-right pr-1 font-semibold text-red-600">H</div>
                            {(['None', 'Low', 'Medium', 'High'] as const).map(riskBand => {
                                const count = riskHeatmapData.matrix.High[riskBand];
                                const intensity = riskHeatmapData.maxCount > 0 ? count / riskHeatmapData.maxCount : 0;
                                return (
                                    <TooltipProvider key={`H-${riskBand}`}>
                                        <UITooltip>
                                            <TooltipTrigger asChild>
                                                <div
                                                    className="aspect-square rounded flex items-center justify-center cursor-help font-bold transition-all duration-200 hover:scale-110 border"
                                                    style={{
                                                        backgroundColor: count > 0
                                                            ? `rgba(239, 68, 68, ${0.2 + intensity * 0.8})`
                                                            : 'transparent',
                                                        borderColor: count > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(0,0,0,0.1)'
                                                    }}
                                                >
                                                    {count > 0 ? count : '·'}
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">
                                                <p className="text-xs font-semibold">High Priority × {riskBand} Risk</p>
                                                <p className="text-xs">{count} requisiti</p>
                                            </TooltipContent>
                                        </UITooltip>
                                    </TooltipProvider>
                                );
                            })}

                            {/* Med Priority row */}
                            <div className="text-right pr-1 font-semibold text-yellow-600">M</div>
                            {(['None', 'Low', 'Medium', 'High'] as const).map(riskBand => {
                                const count = riskHeatmapData.matrix.Med[riskBand];
                                const intensity = riskHeatmapData.maxCount > 0 ? count / riskHeatmapData.maxCount : 0;
                                return (
                                    <TooltipProvider key={`M-${riskBand}`}>
                                        <UITooltip>
                                            <TooltipTrigger asChild>
                                                <div
                                                    className="aspect-square rounded flex items-center justify-center cursor-help font-bold transition-all duration-200 hover:scale-110 border"
                                                    style={{
                                                        backgroundColor: count > 0
                                                            ? `rgba(234, 179, 8, ${0.2 + intensity * 0.8})`
                                                            : 'transparent',
                                                        borderColor: count > 0 ? 'rgba(234, 179, 8, 0.3)' : 'rgba(0,0,0,0.1)'
                                                    }}
                                                >
                                                    {count > 0 ? count : '·'}
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">
                                                <p className="text-xs font-semibold">Med Priority × {riskBand} Risk</p>
                                                <p className="text-xs">{count} requisiti</p>
                                            </TooltipContent>
                                        </UITooltip>
                                    </TooltipProvider>
                                );
                            })}

                            {/* Low Priority row */}
                            <div className="text-right pr-1 font-semibold text-green-600">L</div>
                            {(['None', 'Low', 'Medium', 'High'] as const).map(riskBand => {
                                const count = riskHeatmapData.matrix.Low[riskBand];
                                const intensity = riskHeatmapData.maxCount > 0 ? count / riskHeatmapData.maxCount : 0;
                                return (
                                    <TooltipProvider key={`L-${riskBand}`}>
                                        <UITooltip>
                                            <TooltipTrigger asChild>
                                                <div
                                                    className="aspect-square rounded flex items-center justify-center cursor-help font-bold transition-all duration-200 hover:scale-110 border"
                                                    style={{
                                                        backgroundColor: count > 0
                                                            ? `rgba(34, 197, 94, ${0.2 + intensity * 0.8})`
                                                            : 'transparent',
                                                        borderColor: count > 0 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(0,0,0,0.1)'
                                                    }}
                                                >
                                                    {count > 0 ? count : '·'}
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">
                                                <p className="text-xs font-semibold">Low Priority × {riskBand} Risk</p>
                                                <p className="text-xs">{count} requisiti</p>
                                            </TooltipContent>
                                        </UITooltip>
                                    </TooltipProvider>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-1.5">
                {/* Colonna sinistra: Grafici principali (3 colonne) */}
                <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-1.5">
                    {/* Treemap */}
                    <Card className="flex flex-col md:col-span-2">
                        <CardHeader className="pb-1 px-2 pt-1.5">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm">Treemap Requisiti</CardTitle>
                                <TooltipProvider>
                                    <UITooltip>
                                        <TooltipTrigger asChild>
                                            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent side="left" className="max-w-xs">
                                            <p className="text-xs">
                                                Visualizzazione grafica dei requisiti filtrati.
                                                L'area di ciascun box rappresenta i giorni di stima.
                                                I colori indicano la priorità (rosso=High, giallo=Med, verde=Low).
                                                Passa il mouse per dettagli completi.
                                            </p>
                                        </TooltipContent>
                                    </UITooltip>
                                </TooltipProvider>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 p-0 px-1 pb-1 min-h-[280px] max-h-[280px]">
                            <TreemapApexRequirements
                                requirements={filteredReqs.map(r => ({
                                    requirement: r.requirement,
                                    estimateDays: r.estimationDays,
                                    hasEstimate: r.estimate !== null
                                }))}
                                colorBy="priority"
                                onSelectRequirement={onSelectRequirement}
                                containerHeight="100%"
                            />
                        </CardContent>
                    </Card>
                </div>

                {/* Controlli mobile: Sheet */}
                <div className="lg:hidden">
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="outline" size="sm" className="w-full">
                                <SlidersHorizontal className="h-4 w-4 mr-2" />
                                Controlli
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="w-[300px]">
                            <SheetHeader>
                                <SheetTitle className="text-sm">Controlli</SheetTitle>
                            </SheetHeader>
                            <div className="mt-4">
                                <Tabs defaultValue="scenario" className="w-full">
                                    <TabsList className="grid w-full grid-cols-2 h-8">
                                        <TabsTrigger value="scenario" className="text-xs">Scenario</TabsTrigger>
                                        <TabsTrigger value="filtri" className="text-xs">Filtri</TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="scenario" className="space-y-3 mt-3">
                                        {/* Date Range */}
                                        <div className="space-y-3 pb-3 border-b">
                                            <div>
                                                <Label htmlFor="startDate-mobile" className="flex items-center gap-1.5 text-xs mb-1">
                                                    <Calendar className="h-3 w-3" />
                                                    Data inizio
                                                </Label>
                                                <Input
                                                    id="startDate-mobile"
                                                    type="date"
                                                    value={filters.startDate}
                                                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                                                    className="h-8 text-xs"
                                                />
                                            </div>

                                            <div>
                                                <Label htmlFor="targetDate-mobile" className="flex items-center gap-1.5 text-xs mb-1">
                                                    <Calendar className="h-3 w-3 text-red-500" />
                                                    Data obiettivo
                                                </Label>
                                                <Input
                                                    id="targetDate-mobile"
                                                    type="date"
                                                    value={filters.targetDate || ''}
                                                    onChange={(e) => setFilters({ ...filters, targetDate: e.target.value || undefined })}
                                                    className="h-8 text-xs"
                                                    placeholder="Opzionale"
                                                />
                                            </div>
                                        </div>

                                        {/* Team Configuration */}
                                        <div>
                                            <Label htmlFor="nDevelopers-mobile" className="flex items-center gap-1.5 text-xs mb-1">
                                                <Users className="h-3 w-3" />
                                                Team size
                                            </Label>
                                            <Input
                                                id="nDevelopers-mobile"
                                                type="number"
                                                min="1"
                                                max="20"
                                                value={filters.nDevelopers}
                                                onChange={(e) => setFilters({ ...filters, nDevelopers: parseInt(e.target.value) || 1 })}
                                                className="h-8 text-xs"
                                            />
                                        </div>

                                        {/* Calendar Options */}
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="excludeWeekends-mobile"
                                                checked={filters.excludeWeekends}
                                                onCheckedChange={(checked) => setFilters({ ...filters, excludeWeekends: checked as boolean })}
                                            />
                                            <Label htmlFor="excludeWeekends-mobile" className="text-xs">Escludi weekend</Label>
                                        </div>

                                        <div>
                                            <Label htmlFor="holidays-mobile" className="text-xs mb-1 block">Festività</Label>
                                            <Input
                                                id="holidays-mobile"
                                                type="text"
                                                placeholder="2025-12-25, 2025-12-26"
                                                value={filters.holidays.join(', ')}
                                                onChange={(e) => {
                                                    const holidayList = e.target.value
                                                        .split(',')
                                                        .map(h => h.trim())
                                                        .filter(h => h.length > 0);
                                                    setFilters({ ...filters, holidays: holidayList });
                                                }}
                                                className="h-8 text-xs"
                                            />
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="filtri" className="space-y-3 mt-3">
                                        {/* Filtro priorità */}
                                        <div>
                                            <Label className="text-xs mb-2 block">Filtro Priorità</Label>
                                            <div className="space-y-2">
                                                <div className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id="priority-high-mobile"
                                                        checked={filters.priorities.includes('High')}
                                                        onCheckedChange={() => handleTogglePriority('High')}
                                                    />
                                                    <Label htmlFor="priority-high-mobile" className="flex items-center gap-2 text-xs">
                                                        <Badge className={getPrioritySolidClass('High')}>H</Badge>
                                                        <span>{kpis.priorityMix.High} req</span>
                                                    </Label>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id="priority-med-mobile"
                                                        checked={filters.priorities.includes('Med')}
                                                        onCheckedChange={() => handleTogglePriority('Med')}
                                                    />
                                                    <Label htmlFor="priority-med-mobile" className="flex items-center gap-2 text-xs">
                                                        <Badge className={getPrioritySolidClass('Med')}>M</Badge>
                                                        <span>{kpis.priorityMix.Med} req</span>
                                                    </Label>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id="priority-low-mobile"
                                                        checked={filters.priorities.includes('Low')}
                                                        onCheckedChange={() => handleTogglePriority('Low')}
                                                    />
                                                    <Label htmlFor="priority-low-mobile" className="flex items-center gap-2 text-xs">
                                                        <Badge className={getPrioritySolidClass('Low')}>L</Badge>
                                                        <span>{kpis.priorityMix.Low} req</span>
                                                    </Label>
                                                </div>
                                            </div>
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>

                {/* Colonna destra: Pannello filtri compatto desktop (1 colonna) */}
                <div className="hidden lg:block lg:col-span-1">
                    <Card className="sticky top-2 h-fit max-h-[calc(100vh-8rem)] overflow-auto">
                        <CardHeader className="pb-1.5 px-2 pt-2">
                            <CardTitle className="text-xs">Controlli</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 pb-1.5">
                            <Tabs defaultValue="scenario" className="w-full">
                                <TabsList className="grid w-full grid-cols-2 h-6 mx-2">
                                    <TabsTrigger value="scenario" className="text-[10px] py-0.5">Scenario</TabsTrigger>
                                    <TabsTrigger value="filtri" className="text-[10px] py-0.5">Filtri</TabsTrigger>
                                </TabsList>

                                <TabsContent value="scenario" className="space-y-1.5 mt-1.5 px-2">
                                    {/* Date Range */}
                                    <div className="space-y-1.5 pb-1.5 border-b">
                                        <div>
                                            <Label htmlFor="startDate" className="flex items-center gap-1 text-[10px] mb-0.5">
                                                <Calendar className="h-2.5 w-2.5" />
                                                Data inizio
                                            </Label>
                                            <Input
                                                id="startDate"
                                                type="date"
                                                value={filters.startDate}
                                                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                                                className="h-6 text-[10px]"
                                            />
                                        </div>

                                        <div>
                                            <Label htmlFor="targetDate" className="flex items-center gap-1 text-[10px] mb-0.5">
                                                <Calendar className="h-2.5 w-2.5 text-red-500" />
                                                Data obiettivo
                                            </Label>
                                            <Input
                                                id="targetDate"
                                                type="date"
                                                value={filters.targetDate || ''}
                                                onChange={(e) => setFilters({ ...filters, targetDate: e.target.value || undefined })}
                                                className="h-6 text-[10px]"
                                                placeholder="Opzionale"
                                            />
                                            {filters.targetDate && (
                                                <p className="text-[9px] text-muted-foreground mt-0.5">
                                                    Target: {formatDate(filters.targetDate)}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Team Configuration */}
                                    <div className="space-y-1.5 pb-1.5 border-b">
                                        <div>
                                            <Label htmlFor="nDevelopers" className="flex items-center gap-1 text-[10px] mb-0.5">
                                                <Users className="h-2.5 w-2.5" />
                                                Team size
                                            </Label>
                                            <Input
                                                id="nDevelopers"
                                                type="number"
                                                min="1"
                                                max="20"
                                                value={filters.nDevelopers}
                                                onChange={(e) => setFilters({ ...filters, nDevelopers: parseInt(e.target.value) || 1 })}
                                                className="h-6 text-[10px]"
                                            />
                                            <p className="text-[9px] text-muted-foreground mt-0.5">
                                                {filters.nDevelopers} sviluppatore{filters.nDevelopers > 1 ? 'i' : ''}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Calendar Options */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center space-x-1.5 py-0.5">
                                            <Checkbox
                                                id="excludeWeekends"
                                                checked={filters.excludeWeekends}
                                                onCheckedChange={(checked) => setFilters({ ...filters, excludeWeekends: checked as boolean })}
                                                className="h-3 w-3"
                                            />
                                            <Label htmlFor="excludeWeekends" className="text-[10px] cursor-pointer">
                                                Escludi weekend
                                            </Label>
                                        </div>

                                        <div>
                                            <Label htmlFor="holidays" className="text-[10px] mb-0.5 block">
                                                Festività
                                            </Label>
                                            <Input
                                                id="holidays"
                                                type="text"
                                                placeholder="2025-12-25, 2025-12-26"
                                                value={filters.holidays.join(', ')}
                                                onChange={(e) => {
                                                    const holidayList = e.target.value
                                                        .split(',')
                                                        .map(h => h.trim())
                                                        .filter(h => h.length > 0);
                                                    setFilters({ ...filters, holidays: holidayList });
                                                }}
                                                className="h-6 text-[10px]"
                                            />
                                            {filters.holidays.length > 0 && (
                                                <p className="text-[9px] text-muted-foreground mt-0.5">
                                                    {filters.holidays.length} festività
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="filtri" className="space-y-1.5 mt-1.5 px-2">
                                    {/* Filtro priorità */}
                                    <div>
                                        <Label className="text-[10px] mb-1 block">Filtro Priorità</Label>
                                        <div className="space-y-1">
                                            <div className="flex items-center space-x-1.5">
                                                <Checkbox
                                                    id="priority-high"
                                                    checked={filters.priorities.includes('High')}
                                                    onCheckedChange={() => handleTogglePriority('High')}
                                                    className="h-3 w-3"
                                                />
                                                <Label htmlFor="priority-high" className="flex items-center gap-1.5 text-[10px]">
                                                    <Badge className={getPrioritySolidClass('High') + ' text-[9px] px-1 py-0'}>H</Badge>
                                                    <span>{kpis.priorityMix.High} req</span>
                                                </Label>
                                            </div>
                                            <div className="flex items-center space-x-1.5">
                                                <Checkbox
                                                    id="priority-med"
                                                    checked={filters.priorities.includes('Med')}
                                                    onCheckedChange={() => handleTogglePriority('Med')}
                                                    className="h-3 w-3"
                                                />
                                                <Label htmlFor="priority-med" className="flex items-center gap-1.5 text-[10px]">
                                                    <Badge className={getPrioritySolidClass('Med') + ' text-[9px] px-1 py-0'}>M</Badge>
                                                    <span>{kpis.priorityMix.Med} req</span>
                                                </Label>
                                            </div>
                                            <div className="flex items-center space-x-1.5">
                                                <Checkbox
                                                    id="priority-low"
                                                    checked={filters.priorities.includes('Low')}
                                                    onCheckedChange={() => handleTogglePriority('Low')}
                                                    className="h-3 w-3"
                                                />
                                                <Label htmlFor="priority-low" className="flex items-center gap-1.5 text-[10px]">
                                                    <Badge className={getPrioritySolidClass('Low') + ' text-[9px] px-1 py-0'}>L</Badge>
                                                    <span>{kpis.priorityMix.Low} req</span>
                                                </Label>
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
