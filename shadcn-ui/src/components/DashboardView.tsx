import { useState, useEffect, useMemo } from 'react';
import { BarChart3, Calendar, Users, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
    ScatterChart,
    Scatter,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { List, Requirement, DashboardFilters, RequirementWithEstimate, ProjectionResult } from '../types';
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

export function DashboardView({ list, requirements }: DashboardViewProps) {
    const [reqsWithEstimates, setReqsWithEstimates] = useState<RequirementWithEstimate[]>([]);
    const [filters, setFilters] = useState<DashboardFilters>({
        priorities: ['High', 'Med', 'Low'],
        tags: [],
        startDate: new Date().toISOString().split('T')[0],
        nDevelopers: 3,
        excludeWeekends: true,
        holidays: [],
        colorBy: 'priority'
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

    // Dati per bar chart per tag
    const tagChartData = useMemo(() => {
        const tagEfforts = new Map<string, { total: number; High: number; Med: number; Low: number }>();

        filteredReqs
            .filter(r => r.estimationDays > 0)
            .forEach(r => {
                r.tags.forEach(tag => {
                    if (!tagEfforts.has(tag)) {
                        tagEfforts.set(tag, { total: 0, High: 0, Med: 0, Low: 0 });
                    }
                    const entry = tagEfforts.get(tag)!;
                    entry.total += r.estimationDays;
                    entry[r.requirement.priority] += r.estimationDays;
                });
            });

        return Array.from(tagEfforts.entries())
            .map(([tag, efforts]) => ({
                tag,
                ...efforts
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 10); // Top 10 tag
    }, [filteredReqs]);

    const handleTogglePriority = (priority: 'High' | 'Med' | 'Low') => {
        setFilters(prev => ({
            ...prev,
            priorities: prev.priorities.includes(priority)
                ? prev.priorities.filter(p => p !== priority)
                : [...prev.priorities, priority]
        }));
    };

    return (
        <div className="space-y-2">
            {/* Header ultra-compatto */}
            <div className="flex items-center justify-between py-1">
                <div className="flex items-baseline gap-3">
                    <h1 className="text-lg font-bold">Dashboard — {list.name}</h1>
                    <p className="text-xs text-muted-foreground">
                        {filteredReqs.length} requisiti • {kpis.totalDays} gg/uomo
                    </p>
                </div>
                <Select value={priorityPolicy} onValueChange={(v: any) => setPriorityPolicy(v)}>
                    <SelectTrigger className="w-[150px] h-8">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Neutral">Neutral</SelectItem>
                        <SelectItem value="PriorityFirst">Priority-first</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* KPI Row compatta - 3 cards combinate */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Card 1: Metriche Base */}
                <Card className="border-l-4 border-l-blue-500">
                    <CardContent className="p-2.5">
                        <div className="grid grid-cols-2 gap-2.5">
                            <div>
                                <div className="text-xs text-muted-foreground">Totale</div>
                                <div className="text-lg font-bold">{kpis.totalDays}</div>
                                <div className="text-xs text-muted-foreground">gg/uomo</div>
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground">Media</div>
                                <div className="text-lg font-bold">{kpis.avgDays}</div>
                                <div className="text-xs text-muted-foreground">per req</div>
                            </div>
                        </div>
                        <Separator className="my-1.5" />
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Mediana: <strong>{kpis.medianDays}</strong></span>
                            <span className="text-muted-foreground">P80: <strong>{kpis.p80Days}</strong></span>
                        </div>
                    </CardContent>
                </Card>

                {/* Card 2: Priority Mix */}
                <Card className="border-l-4 border-l-red-500">
                    <CardContent className="p-2.5">
                        <div className="text-xs text-muted-foreground mb-1.5">Priority Mix</div>
                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Badge className={getPrioritySolidClass('High') + ' text-white'}>H</Badge>
                                    <span className="text-xs">{kpis.priorityMix.High} req</span>
                                </div>
                                <span className="text-xs font-semibold">{kpis.effortByPriority.High}gg ({kpis.effortByPriorityPct.High}%)</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Badge className={getPrioritySolidClass('Med') + ' text-white'}>M</Badge>
                                    <span className="text-xs">{kpis.priorityMix.Med} req</span>
                                </div>
                                <span className="text-xs font-semibold">{kpis.effortByPriority.Med}gg ({kpis.effortByPriorityPct.Med}%)</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Badge className={getPrioritySolidClass('Low') + ' text-white'}>L</Badge>
                                    <span className="text-xs">{kpis.priorityMix.Low} req</span>
                                </div>
                                <span className="text-xs font-semibold">{kpis.effortByPriority.Low}gg ({kpis.effortByPriorityPct.Low}%)</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Card 3: Timeline */}
                <Card className="border-l-4 border-l-purple-500">
                    <CardContent className="p-2.5">
                        <div className="text-xs text-muted-foreground mb-1.5">Timeline ({priorityPolicy})</div>
                        <div className="space-y-1">
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">Inizio</span>
                                <span className="text-xs font-semibold">{filters.startDate}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">Fine prevista</span>
                                <span className="text-lg font-bold text-purple-600">{projection.finishDate.split('-')[2]}/{projection.finishDate.split('-')[1]}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">Durata</span>
                                <span className="text-xs font-semibold">{projection.totalWorkdays} gg lavorativi</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-2.5">
                {/* Colonna sinistra: Grafici principali (3 colonne) */}
                <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {/* Scatter Plot - Effort vs Difficulty */}
                    <Card>
                        <CardHeader className="pb-1.5">
                            <CardTitle className="flex items-center gap-2 text-sm">
                                <BarChart3 className="h-4 w-4" />
                                Effort × Difficulty
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pb-1.5">
                            <ResponsiveContainer width="100%" height={180}>
                                <ScatterChart margin={{ top: 5, right: 10, bottom: 20, left: 10 }}>
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
                                            const data = payload[0].payload as any;
                                            return (
                                                <div className="bg-background border rounded-lg p-2 shadow-lg">
                                                    <p className="font-semibold text-xs">{data.title}</p>
                                                    <p className="text-xs text-muted-foreground">Giorni: {data.estimationDays}</p>
                                                    <p className="text-xs text-muted-foreground">Difficulty: {data.difficulty}</p>
                                                    <Badge className={getPrioritySolidClass(data.priority) + ' text-white text-xs'}>
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
                        </CardContent>
                    </Card>

                    {/* Bar Chart - Top Tags */}
                    <Card>
                        <CardHeader className="pb-1.5">
                            <CardTitle className="flex items-center gap-2 text-sm">
                                <TrendingUp className="h-4 w-4" />
                                Top 10 Tags
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pb-1.5">
                            <ResponsiveContainer width="100%" height={180}>
                                <BarChart data={tagChartData} margin={{ top: 5, right: 10, bottom: 40, left: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="tag" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 10 }} />
                                    <YAxis tick={{ fontSize: 11 }} />
                                    <Tooltip />
                                    <Bar dataKey="High" stackId="a" fill={getPrioritySolidColor('High')} name="High" />
                                    <Bar dataKey="Med" stackId="a" fill={getPrioritySolidColor('Med')} name="Med" />
                                    <Bar dataKey="Low" stackId="a" fill={getPrioritySolidColor('Low')} name="Low" />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* Mix difficoltà compatto */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Mix Difficoltà & Top Tag</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-1.5 text-xs">
                                {Object.entries(kpis.difficultyMix).map(([diff, count]) => (
                                    <div key={diff} className="flex justify-between">
                                        <span className="text-muted-foreground capitalize">{diff}</span>
                                        <span className="font-semibold">{count} req</span>
                                    </div>
                                ))}
                                {kpis.topTagByEffort && (
                                    <>
                                        <Separator className="my-1.5" />
                                        <div>
                                            <div className="text-muted-foreground mb-1">Tag top:</div>
                                            <div className="flex justify-between items-center">
                                                <Badge variant="outline" className="text-xs">{kpis.topTagByEffort.tag}</Badge>
                                                <span className="font-semibold">{kpis.topTagByEffort.effort}gg</span>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Timeline milestones compatta */}
                    {priorityPolicy === 'PriorityFirst' && 'milestones' in projection && projection.milestones && (
                        <Card className="md:col-span-2">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Calendar className="h-4 w-4" />
                                    Milestones Priority-First
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-3 gap-3 text-xs">
                                    {(projection as ProjectionResult).milestones?.finishHigh && (
                                        <div>
                                            <Badge variant="outline" className="border-red-500 text-xs mb-1">High</Badge>
                                            <div className="font-semibold">{(projection as ProjectionResult).milestones?.finishHigh}</div>
                                        </div>
                                    )}
                                    {(projection as ProjectionResult).milestones?.finishMed && (
                                        <div>
                                            <Badge variant="outline" className="border-yellow-500 text-xs mb-1">Med</Badge>
                                            <div className="font-semibold">{(projection as ProjectionResult).milestones?.finishMed}</div>
                                        </div>
                                    )}
                                    {(projection as ProjectionResult).milestones?.finishLow && (
                                        <div>
                                            <Badge variant="outline" className="border-green-500 text-xs mb-1">Low</Badge>
                                            <div className="font-semibold">{(projection as ProjectionResult).milestones?.finishLow}</div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Colonna destra: Pannello filtri compatto (1 colonna) */}
                <div className="lg:col-span-1">
                    <Card className="sticky top-4">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Controlli Scenario</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {/* Start date */}
                            <div>
                                <Label htmlFor="startDate" className="flex items-center gap-1.5 text-xs mb-1">
                                    <Calendar className="h-3 w-3" />
                                    Start date
                                </Label>
                                <Input
                                    id="startDate"
                                    type="date"
                                    value={filters.startDate}
                                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                                    className="h-8 text-xs"
                                />
                            </div>

                            {/* N sviluppatori */}
                            <div>
                                <Label htmlFor="nDevelopers" className="flex items-center gap-1.5 text-xs mb-1">
                                    <Users className="h-3 w-3" />
                                    N° sviluppatori
                                </Label>
                                <Input
                                    id="nDevelopers"
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
                                    id="excludeWeekends"
                                    checked={filters.excludeWeekends}
                                    onCheckedChange={(checked) => setFilters({ ...filters, excludeWeekends: checked as boolean })}
                                />
                                <Label htmlFor="excludeWeekends" className="text-xs">Escludi weekend</Label>
                            </div>

                            {/* Festività */}
                            <div>
                                <Label htmlFor="holidays" className="text-xs mb-1 block">Festività (YYYY-MM-DD)</Label>
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
                                    className="h-8 text-xs"
                                />
                            </div>

                            <Separator />

                            {/* Filtro priorità */}
                            <div>
                                <Label className="text-xs mb-2 block">Filtro Priorità</Label>
                                <div className="space-y-2">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="priority-high"
                                            checked={filters.priorities.includes('High')}
                                            onCheckedChange={() => handleTogglePriority('High')}
                                        />
                                        <Label htmlFor="priority-high" className="flex items-center gap-2 text-xs">
                                            <Badge className={getPrioritySolidClass('High') + ' text-white'}>H</Badge>
                                            <span>{kpis.priorityMix.High} req</span>
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="priority-med"
                                            checked={filters.priorities.includes('Med')}
                                            onCheckedChange={() => handleTogglePriority('Med')}
                                        />
                                        <Label htmlFor="priority-med" className="flex items-center gap-2 text-xs">
                                            <Badge className={getPrioritySolidClass('Med') + ' text-white'}>M</Badge>
                                            <span>{kpis.priorityMix.Med} req</span>
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="priority-low"
                                            checked={filters.priorities.includes('Low')}
                                            onCheckedChange={() => handleTogglePriority('Low')}
                                        />
                                        <Label htmlFor="priority-low" className="flex items-center gap-2 text-xs">
                                            <Badge className={getPrioritySolidClass('Low') + ' text-white'}>L</Badge>
                                            <span>{kpis.priorityMix.Low} req</span>
                                        </Label>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
