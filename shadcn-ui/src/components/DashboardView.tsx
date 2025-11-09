import { useState, useEffect, useMemo } from 'react';
import { BarChart3, Calendar, Users, SlidersHorizontal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
    Tooltip as UITooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from '@/components/ui/tooltip';
import {
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { List, Requirement, DashboardFilters, RequirementWithEstimate } from '../types';
import { TreemapView } from './TreemapView';
import {
    prepareRequirementsWithEstimates,
    calculateDashboardKPIs,
    calculateNeutralProjection,
    calculatePriorityFirstProjection
} from '../lib/calculations';
import { getPrioritySolidColor, getPrioritySolidClass } from '@/lib/utils';

interface DashboardViewProps {
    list: List;
    requirements: Requirement[];
    onBack: () => void;
}

export function DashboardView({ list, requirements, onBack }: DashboardViewProps) {
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

    // Calcola KPI
    const kpis = useMemo(() => {
        return calculateDashboardKPIs(filteredReqs);
    }, [filteredReqs]);

    // Calcola proiezioni
    const projection = useMemo(() => {
        if (priorityPolicy === 'Neutral') {
            return calculateNeutralProjection(
                kpis.totalDays,
                filters.nDevelopers,
                filters.startDate,
                filters.excludeWeekends,
                filters.holidays
            );
        } else {
            const result = calculatePriorityFirstProjection(
                kpis.effortByPriority,
                filters.nDevelopers,
                filters.startDate,
                filters.excludeWeekends,
                filters.holidays
            );
            return result;
        }
    }, [kpis, filters, priorityPolicy]);

    // Dati per scatter plot
    const scatterData = useMemo(() => {
        return filteredReqs
            .filter(r => r.estimationDays > 0)
            .map(r => ({
                difficulty: r.difficulty,
                estimationDays: r.estimationDays,
                priority: r.requirement.priority,
                title: r.requirement.title,
                tags: r.tags.join(', ')
            }));
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
        <div className="space-y-4">
            {/* Header con metriche integrate */}
            <div className="flex items-center justify-end">
                <div className="flex items-center gap-4 text-sm">
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
                    <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
                        <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                        Live
                    </Badge>
                </div>
            </div>

            {/* KPI Row compatta - 4 cards combinate */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                {/* Card 1: Metriche Base */}
                <Card className="border-l-4 border-l-blue-500">
                    <CardContent className="p-2">
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <div className="text-xs text-muted-foreground">Totale</div>
                                <div className="text-lg font-bold flex items-center gap-1">
                                    {kpis.totalDays}
                                    {kpis.totalDays > 100 && kpis.totalDays <= 200 && (
                                        <span className="text-orange-500 text-sm" title="Attenzione: progetto medio-grande">⚠️</span>
                                    )}
                                    {kpis.totalDays > 200 && (
                                        <span className="text-red-500 text-sm" title="Attenzione: progetto molto grande">🔴</span>
                                    )}
                                </div>
                                <div className="text-xs text-muted-foreground">gg/uomo</div>
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground">Media</div>
                                <div className="text-lg font-bold">{kpis.avgDays}</div>
                                <div className="text-xs text-muted-foreground">per req</div>
                            </div>
                        </div>
                        <Separator className="my-1" />
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Mediana: <strong>{kpis.medianDays}</strong></span>
                            <span className="text-muted-foreground">P80: <strong>{kpis.p80Days}</strong></span>
                        </div>
                    </CardContent>
                </Card>

                {/* Card 2: Priority Mix */}
                <Card className="border-l-4 border-l-red-500">
                    <CardContent className="p-2">
                        <div className="text-xs text-muted-foreground mb-1">Priority Mix</div>
                        <TooltipProvider>
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <UITooltip>
                                            <TooltipTrigger asChild>
                                                <Badge className={getPrioritySolidClass('High') + ' cursor-help'}>H</Badge>
                                            </TooltipTrigger>
                                            <TooltipContent side="left">
                                                <p className="text-xs font-semibold">Alta Priorità</p>
                                                <p className="text-xs">{kpis.priorityMix.High} requisiti</p>
                                                <p className="text-xs">{kpis.effortByPriority.High} giorni totali</p>
                                            </TooltipContent>
                                        </UITooltip>
                                        <span className="text-xs">{kpis.priorityMix.High} req</span>
                                    </div>
                                    <span className="text-xs font-semibold">{kpis.effortByPriority.High}gg ({kpis.effortByPriorityPct.High}%)</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <UITooltip>
                                            <TooltipTrigger asChild>
                                                <Badge className={getPrioritySolidClass('Med') + ' cursor-help'}>M</Badge>
                                            </TooltipTrigger>
                                            <TooltipContent side="left">
                                                <p className="text-xs font-semibold">Media Priorità</p>
                                                <p className="text-xs">{kpis.priorityMix.Med} requisiti</p>
                                                <p className="text-xs">{kpis.effortByPriority.Med} giorni totali</p>
                                            </TooltipContent>
                                        </UITooltip>
                                        <span className="text-xs">{kpis.priorityMix.Med} req</span>
                                    </div>
                                    <span className="text-xs font-semibold">{kpis.effortByPriority.Med}gg ({kpis.effortByPriorityPct.Med}%)</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <UITooltip>
                                            <TooltipTrigger asChild>
                                                <Badge className={getPrioritySolidClass('Low') + ' cursor-help'}>L</Badge>
                                            </TooltipTrigger>
                                            <TooltipContent side="left">
                                                <p className="text-xs font-semibold">Bassa Priorità</p>
                                                <p className="text-xs">{kpis.priorityMix.Low} requisiti</p>
                                                <p className="text-xs">{kpis.effortByPriority.Low} giorni totali</p>
                                            </TooltipContent>
                                        </UITooltip>
                                        <span className="text-xs">{kpis.priorityMix.Low} req</span>
                                    </div>
                                    <span className="text-xs font-semibold">{kpis.effortByPriority.Low}gg ({kpis.effortByPriorityPct.Low}%)</span>
                                </div>
                            </div>
                        </TooltipProvider>
                    </CardContent>
                </Card>

                {/* Card 3: Mix Difficoltà con cerchi */}
                <Card className="border-l-4 border-l-green-500 group">
                    <CardContent className="p-2">
                        <div className="text-xs text-muted-foreground mb-1">Mix Difficoltà</div>
                        <TooltipProvider>
                            <div className="flex items-center justify-center gap-2 group-hover:gap-3 transition-all duration-300">
                                {/* Low - Verde */}
                                <UITooltip>
                                    <TooltipTrigger asChild>
                                        <div
                                            className="rounded-full bg-green-500 flex items-center justify-center text-white font-bold cursor-help transition-all duration-300 group-hover:scale-110"
                                            style={{
                                                width: `${Math.max(28, Math.min(48, 28 + (kpis.difficultyMix.low || 0) * 3))}px`,
                                                height: `${Math.max(28, Math.min(48, 28 + (kpis.difficultyMix.low || 0) * 3))}px`,
                                            }}
                                        >
                                            <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                {kpis.difficultyMix.low || 0}
                                            </span>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="text-xs font-semibold">Low</p>
                                        <p className="text-xs">{kpis.difficultyMix.low || 0} requisiti</p>
                                    </TooltipContent>
                                </UITooltip>

                                {/* Medium - Giallo */}
                                <UITooltip>
                                    <TooltipTrigger asChild>
                                        <div
                                            className="rounded-full bg-yellow-500 flex items-center justify-center text-white font-bold cursor-help transition-all duration-300 group-hover:scale-110"
                                            style={{
                                                width: `${Math.max(28, Math.min(48, 28 + (kpis.difficultyMix.medium || 0) * 3))}px`,
                                                height: `${Math.max(28, Math.min(48, 28 + (kpis.difficultyMix.medium || 0) * 3))}px`,
                                            }}
                                        >
                                            <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                {kpis.difficultyMix.medium || 0}
                                            </span>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="text-xs font-semibold">Medium</p>
                                        <p className="text-xs">{kpis.difficultyMix.medium || 0} requisiti</p>
                                    </TooltipContent>
                                </UITooltip>

                                {/* High - Rosso */}
                                <UITooltip>
                                    <TooltipTrigger asChild>
                                        <div
                                            className="rounded-full bg-red-500 flex items-center justify-center text-white font-bold cursor-help transition-all duration-300 group-hover:scale-110"
                                            style={{
                                                width: `${Math.max(28, Math.min(48, 28 + (kpis.difficultyMix.high || 0) * 3))}px`,
                                                height: `${Math.max(28, Math.min(48, 28 + (kpis.difficultyMix.high || 0) * 3))}px`,
                                            }}
                                        >
                                            <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                {kpis.difficultyMix.high || 0}
                                            </span>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="text-xs font-semibold">High</p>
                                        <p className="text-xs">{kpis.difficultyMix.high || 0} requisiti</p>
                                    </TooltipContent>
                                </UITooltip>
                            </div>
                        </TooltipProvider>
                    </CardContent>
                </Card>

                {/* Card 4: Timeline */}
                <Card className="border-l-4 border-l-purple-500">
                    <CardContent className="p-2">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-muted-foreground">Timeline ({priorityPolicy})</span>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 px-2 text-xs hover:bg-purple-100 dark:hover:bg-purple-900"
                                onClick={() => setPriorityPolicy(priorityPolicy === 'Neutral' ? 'PriorityFirst' : 'Neutral')}
                                title="Cambia strategia di scheduling"
                            >
                                ⇄ Cambia
                            </Button>
                        </div>
                        <div className="space-y-0.5">
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">Inizio</span>
                                <span className="text-xs font-semibold">{formatDate(filters.startDate)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">Fine prevista</span>
                                <span className="text-lg font-bold text-purple-600">
                                    {formatDate(projection.finishDate)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">Durata</span>
                                <span className="text-xs font-semibold">{projection.totalWorkdays} gg lavorativi</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-2">
                {/* Colonna sinistra: Grafici principali (3 colonne) */}
                <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {/* Scatter Plot - Effort vs Difficulty */}
                    <Card className="flex flex-col">
                        <CardHeader className="pb-1 px-3 pt-2">
                            <CardTitle className="flex items-center gap-2 text-sm">
                                <BarChart3 className="h-4 w-4" />
                                Effort × Difficulty
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 p-0 px-1 pb-1">
                            <div className="w-full h-full min-h-[140px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ScatterChart margin={{ top: 5, right: 10, bottom: 15, left: 10 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis
                                            type="number"
                                            dataKey="difficulty"
                                            name="Difficulty"
                                            domain={[0, 6]}
                                            tick={{ fontSize: 11 }}
                                        />
                                        <YAxis
                                            type="number"
                                            dataKey="estimationDays"
                                            name="Giorni/uomo"
                                            tick={{ fontSize: 11 }}
                                        />
                                        <Tooltip
                                            content={({ payload }) => {
                                                if (!payload || !payload[0]) return null;
                                                const data = payload[0].payload as {
                                                    title: string;
                                                    estimationDays: number;
                                                    difficulty: number;
                                                    priority: string;
                                                    tags: string;
                                                };
                                                return (
                                                    <div className="bg-background border rounded-lg p-2 shadow-lg">
                                                        <p className="font-semibold text-xs">{data.title}</p>
                                                        <p className="text-xs text-muted-foreground">Giorni: {data.estimationDays}</p>
                                                        <p className="text-xs text-muted-foreground">Difficulty: {data.difficulty}</p>
                                                        <Badge className={getPrioritySolidClass(data.priority) + ' text-xs'}>
                                                            {data.priority}
                                                        </Badge>
                                                    </div>
                                                );
                                            }}
                                        />
                                        <Scatter name="High" data={scatterData.filter(d => d.priority === 'High')} fill={getPrioritySolidColor('High')} />
                                        <Scatter name="Med" data={scatterData.filter(d => d.priority === 'Med')} fill={getPrioritySolidColor('Med')} />
                                        <Scatter name="Low" data={scatterData.filter(d => d.priority === 'Low')} fill={getPrioritySolidColor('Low')} />
                                    </ScatterChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Treemap */}
                    <Card className="flex flex-col">
                        <CardHeader className="pb-1 px-3 pt-2">
                            <CardTitle className="text-sm">Treemap Requisiti</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 p-0 px-1 pb-1">
                            <div className="w-full h-full min-h-[140px]">
                                <TreemapView
                                    requirements={filteredReqs.map(r => ({
                                        requirement: r.requirement,
                                        estimateDays: r.estimationDays,
                                        hasEstimate: r.estimate !== null
                                    }))}
                                    colorBy="priority"
                                    onSelectRequirement={() => { }}
                                />
                            </div>
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
                                        {/* Start date */}
                                        <div>
                                            <Label htmlFor="startDate-mobile" className="flex items-center gap-1.5 text-xs mb-1">
                                                <Calendar className="h-3 w-3" />
                                                Start date
                                            </Label>
                                            <Input
                                                id="startDate-mobile"
                                                type="date"
                                                value={filters.startDate}
                                                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                                                className="h-8 text-xs"
                                            />
                                        </div>

                                        {/* N sviluppatori */}
                                        <div>
                                            <Label htmlFor="nDevelopers-mobile" className="flex items-center gap-1.5 text-xs mb-1">
                                                <Users className="h-3 w-3" />
                                                N° sviluppatori
                                            </Label>
                                            <Input
                                                id="nDevelopers-mobile"
                                                type="number"
                                                min="1"
                                                value={filters.nDevelopers}
                                                onChange={(e) => setFilters({ ...filters, nDevelopers: parseInt(e.target.value) || 1 })}
                                                className="h-8 text-xs"
                                            />
                                        </div>

                                        {/* Escludi weekend */}
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="excludeWeekends-mobile"
                                                checked={filters.excludeWeekends}
                                                onCheckedChange={(checked) => setFilters({ ...filters, excludeWeekends: checked as boolean })}
                                            />
                                            <Label htmlFor="excludeWeekends-mobile" className="text-xs">Escludi weekend</Label>
                                        </div>

                                        {/* Festività */}
                                        <div>
                                            <Label htmlFor="holidays-mobile" className="text-xs mb-1 block">Festività (YYYY-MM-DD)</Label>
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
                    <Card className="sticky top-4 h-fit">
                        <CardHeader className="pb-2 px-3 pt-3">
                            <CardTitle className="text-sm">Controlli</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 pb-2">
                            <Tabs defaultValue="scenario" className="w-full">
                                <TabsList className="grid w-full grid-cols-2 h-7 mx-3">
                                    <TabsTrigger value="scenario" className="text-xs py-1">Scenario</TabsTrigger>
                                    <TabsTrigger value="filtri" className="text-xs py-1">Filtri</TabsTrigger>
                                </TabsList>

                                <TabsContent value="scenario" className="space-y-2 mt-2 px-3">
                                    {/* Start date */}
                                    <div>
                                        <Label htmlFor="startDate" className="flex items-center gap-1.5 text-xs mb-0.5">
                                            <Calendar className="h-3 w-3" />
                                            Start date
                                        </Label>
                                        <Input
                                            id="startDate"
                                            type="date"
                                            value={filters.startDate}
                                            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                                            className="h-7 text-xs"
                                        />
                                    </div>

                                    {/* N sviluppatori */}
                                    <div>
                                        <Label htmlFor="nDevelopers" className="flex items-center gap-1.5 text-xs mb-0.5">
                                            <Users className="h-3 w-3" />
                                            N° sviluppatori
                                        </Label>
                                        <Input
                                            id="nDevelopers"
                                            type="number"
                                            min="1"
                                            value={filters.nDevelopers}
                                            onChange={(e) => setFilters({ ...filters, nDevelopers: parseInt(e.target.value) || 1 })}
                                            className="h-7 text-xs"
                                        />
                                    </div>

                                    {/* Escludi weekend */}
                                    <div className="flex items-center space-x-2 py-1">
                                        <Checkbox
                                            id="excludeWeekends"
                                            checked={filters.excludeWeekends}
                                            onCheckedChange={(checked) => setFilters({ ...filters, excludeWeekends: checked as boolean })}
                                            className="h-3.5 w-3.5"
                                        />
                                        <Label htmlFor="excludeWeekends" className="text-xs">Escludi weekend</Label>
                                    </div>

                                    {/* Festività */}
                                    <div>
                                        <Label htmlFor="holidays" className="text-xs mb-0.5 block">Festività (YYYY-MM-DD)</Label>
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
                                            className="h-7 text-xs"
                                        />
                                    </div>
                                </TabsContent>

                                <TabsContent value="filtri" className="space-y-2 mt-2 px-3">
                                    {/* Filtro priorità */}
                                    <div>
                                        <Label className="text-xs mb-1 block">Filtro Priorità</Label>
                                        <div className="space-y-1.5">
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="priority-high"
                                                    checked={filters.priorities.includes('High')}
                                                    onCheckedChange={() => handleTogglePriority('High')}
                                                    className="h-3.5 w-3.5"
                                                />
                                                <Label htmlFor="priority-high" className="flex items-center gap-2 text-xs">
                                                    <Badge className={getPrioritySolidClass('High') + ' text-[10px] px-1.5 py-0'}>H</Badge>
                                                    <span>{kpis.priorityMix.High} req</span>
                                                </Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="priority-med"
                                                    checked={filters.priorities.includes('Med')}
                                                    onCheckedChange={() => handleTogglePriority('Med')}
                                                    className="h-3.5 w-3.5"
                                                />
                                                <Label htmlFor="priority-med" className="flex items-center gap-2 text-xs">
                                                    <Badge className={getPrioritySolidClass('Med') + ' text-[10px] px-1.5 py-0'}>M</Badge>
                                                    <span>{kpis.priorityMix.Med} req</span>
                                                </Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="priority-low"
                                                    checked={filters.priorities.includes('Low')}
                                                    onCheckedChange={() => handleTogglePriority('Low')}
                                                    className="h-3.5 w-3.5"
                                                />
                                                <Label htmlFor="priority-low" className="flex items-center gap-2 text-xs">
                                                    <Badge className={getPrioritySolidClass('Low') + ' text-[10px] px-1.5 py-0'}>L</Badge>
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
