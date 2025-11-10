import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, User, Tag, Edit, Clock, TrendingUp, ChevronRight } from 'lucide-react';
import ReactApexChart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Requirement, Estimate, List } from '../types';
import { getEstimatesByReqId } from '../lib/storage';
import { getPriorityColor, getStateColor, parseLabels } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { EstimateEditor } from './EstimateEditor';

interface RequirementDetailViewProps {
    requirement: Requirement;
    list: List;
    onBack: () => void;
}

export function RequirementDetailView({ requirement, list, onBack }: RequirementDetailViewProps) {
    const [estimates, setEstimates] = useState<Estimate[]>([]);
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [selectedEstimate, setSelectedEstimate] = useState<Estimate | null>(null);

    useEffect(() => {
        loadEstimates();
    }, [requirement.req_id]);

    const loadEstimates = async () => {
        setLoading(true);
        try {
            const data = await getEstimatesByReqId(requirement.req_id);
            setEstimates(data);
            logger.info('Loaded estimates for requirement:', { count: data.length });
        } catch (error) {
            logger.error('Failed to load estimates:', error);
        } finally {
            setLoading(false);
        }
    };

    const latestEstimate = estimates.length > 0 ? estimates[0] : null;

    const priorityLabel = {
        High: 'Alta',
        Med: 'Media',
        Low: 'Bassa'
    }[requirement.priority];

    const stateLabel = {
        Proposed: 'Proposto',
        Selected: 'Selezionato',
        Scheduled: 'Pianificato',
        Done: 'Completato'
    }[requirement.state];

    // Se in modalità edit, mostra l'editor completo
    if (editMode) {
        return (
            <EstimateEditor
                requirement={requirement}
                list={list}
                selectedEstimate={selectedEstimate}
                onBack={() => {
                    setEditMode(false);
                    setSelectedEstimate(null);
                    loadEstimates(); // Ricarica stime dopo l'edit
                }}
            />
        );
    }

    return (
        <div className="h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-black dark:to-gray-950 overflow-hidden flex flex-col p-3">
            <div className="max-w-7xl mx-auto w-full h-full flex flex-col gap-2">
                {/* Header Ultra-Compatto - singola riga */}
                <div className="flex items-center justify-between gap-3 bg-white dark:bg-gray-900 px-3 py-2 rounded-lg border shadow-sm shrink-0">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Button variant="ghost" size="sm" onClick={onBack} className="h-7 w-7 p-0 shrink-0">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-xs font-mono text-muted-foreground shrink-0">{requirement.req_id}</span>
                        <h1 className="text-sm font-bold text-gray-900 dark:text-gray-50 truncate flex-1">{requirement.title}</h1>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                        <Badge className={`${getPriorityColor(requirement.priority)} text-xs px-2 py-0`}>
                            {priorityLabel}
                        </Badge>
                        <Badge className={`${getStateColor(requirement.state)} text-xs px-2 py-0`}>
                            {stateLabel}
                        </Badge>
                        {requirement.business_owner && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground ml-1">
                                <User className="h-3 w-3" />
                                <span className="max-w-[120px] truncate">{requirement.business_owner}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Layout a 3 colonne - 100% altezza disponibile */}
                <div className="grid grid-cols-3 gap-2 flex-1 min-h-0">
                    {/* Colonna 1: Card Stima Corrente - Layout Compatto */}
                    <div className="flex flex-col h-full min-h-0">
                        {latestEstimate ? (
                            <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent shadow-md flex flex-col h-full overflow-hidden">
                                <CardHeader className="pb-1.5 pt-2 px-3 shrink-0">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                                            <TrendingUp className="h-3.5 w-3.5 text-primary" />
                                            Stima Corrente
                                        </CardTitle>
                                        <Button size="sm" onClick={() => setEditMode(true)} className="h-6 text-xs px-2">
                                            <Edit className="h-3 w-3 mr-1" />
                                            Modifica
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-1 px-3 pb-3 overflow-auto space-y-2">
                                    {/* Totale Giorni Super Prominente */}
                                    <div className="text-center py-1 bg-gradient-to-br from-primary/10 to-transparent rounded-lg">
                                        <p className="text-[10px] text-muted-foreground mb-0.5">Totale Giorni</p>
                                        <p className="text-3xl font-bold text-primary leading-none">{latestEstimate.total_days}</p>
                                    </div>

                                    {/* Mini Radial Chart: Distribuzione Compatta */}
                                    <div className="bg-accent/30 rounded-lg p-2">
                                        <p className="text-[10px] font-medium mb-1 text-center">Distribuzione</p>
                                        <ReactApexChart
                                            type="radialBar"
                                            height={140}
                                            series={[
                                                Math.round((latestEstimate.subtotal_days / latestEstimate.total_days) * 100),
                                                Math.round((latestEstimate.contingency_days / latestEstimate.total_days) * 100)
                                            ]}
                                            options={{
                                                chart: {
                                                    type: 'radialBar',
                                                    background: 'transparent',
                                                    toolbar: { show: false }
                                                },
                                                plotOptions: {
                                                    radialBar: {
                                                        offsetY: -5,
                                                        hollow: { size: '35%' },
                                                        dataLabels: {
                                                            name: {
                                                                fontSize: '9px',
                                                                offsetY: -3
                                                            },
                                                            value: {
                                                                fontSize: '11px',
                                                                fontWeight: 'bold',
                                                                offsetY: 3,
                                                                formatter: (val) => `${val}%`
                                                            }
                                                        }
                                                    }
                                                },
                                                colors: ['#3b82f6', '#f97316'],
                                                labels: ['Subtotal', 'Contingenza'],
                                                legend: {
                                                    show: true,
                                                    position: 'bottom',
                                                    fontSize: '9px',
                                                    offsetY: -5,
                                                    labels: { colors: ['#666', '#666'] }
                                                }
                                            } as ApexOptions}
                                        />
                                    </div>

                                    {/* Mini Gauge: Risk Score */}
                                    <div className="bg-accent/30 rounded-lg p-2">
                                        <p className="text-[10px] font-medium mb-1 text-center">Risk Score</p>
                                        <ReactApexChart
                                            type="radialBar"
                                            height={120}
                                            series={[Math.min(100, (latestEstimate.risk_score / 30) * 100)]}
                                            options={{
                                                chart: {
                                                    type: 'radialBar',
                                                    background: 'transparent',
                                                    toolbar: { show: false }
                                                },
                                                plotOptions: {
                                                    radialBar: {
                                                        hollow: { size: '60%' },
                                                        dataLabels: {
                                                            name: { show: false },
                                                            value: {
                                                                fontSize: '18px',
                                                                fontWeight: 'bold',
                                                                formatter: () => `${latestEstimate.risk_score}pt`
                                                            }
                                                        },
                                                        track: { background: '#e5e7eb' }
                                                    }
                                                },
                                                fill: {
                                                    type: 'gradient',
                                                    gradient: {
                                                        shade: 'dark',
                                                        type: 'horizontal',
                                                        shadeIntensity: 0.5,
                                                        gradientToColors: latestEstimate.risk_score <= 10 ? ['#22c55e'] : latestEstimate.risk_score <= 20 ? ['#f59e0b'] : ['#ef4444'],
                                                        stops: [0, 100]
                                                    }
                                                },
                                                colors: [latestEstimate.risk_score <= 10 ? '#10b981' : latestEstimate.risk_score <= 20 ? '#eab308' : '#dc2626'],
                                            } as ApexOptions}
                                        />
                                        <div className="flex justify-between text-[9px] text-muted-foreground px-1 -mt-2">
                                            <span>0pt</span>
                                            <span>30pt+</span>
                                        </div>
                                    </div>

                                    {/* Metriche Compatte */}
                                    <div className="grid grid-cols-2 gap-1.5 text-xs">
                                        <div className="p-1.5 bg-blue-50 dark:bg-blue-950/20 rounded">
                                            <p className="text-[9px] text-muted-foreground mb-0.5">Subtotal</p>
                                            <p className="font-semibold text-blue-600 dark:text-blue-400 text-sm">{latestEstimate.subtotal_days}gg</p>
                                        </div>
                                        <div className="p-1.5 bg-orange-50 dark:bg-orange-950/20 rounded">
                                            <p className="text-[9px] text-muted-foreground mb-0.5">Contingenza</p>
                                            <p className="font-semibold text-orange-600 dark:text-orange-400 text-sm">
                                                {latestEstimate.contingency_days}gg
                                            </p>
                                        </div>
                                    </div>

                                    {/* Info Footer Compatto */}
                                    <div className="space-y-1 text-[10px] text-muted-foreground bg-accent/20 p-1.5 rounded">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                <span>{new Date(latestEstimate.created_on).toLocaleDateString('it-IT', { month: 'short', day: 'numeric' })}</span>
                                            </div>
                                            <span>S#{latestEstimate.scenario}</span>
                                        </div>
                                        <div className="text-[9px]">
                                            {latestEstimate.included_activities.length} attività • {latestEstimate.selected_risks.length} rischi
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ) : (
                            <Card className="border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center h-full">
                                <CardContent className="text-center py-6">
                                    <p className="text-xs text-muted-foreground mb-3">Nessuna stima creata</p>
                                    <Button onClick={() => setEditMode(true)} size="sm">
                                        <Edit className="h-3 w-3 mr-1.5" />
                                        Crea Stima
                                    </Button>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Colonna 2: Dettagli Requisito - Layout Compatto */}
                    <Card className="border rounded-lg bg-white dark:bg-gray-900 flex flex-col h-full overflow-hidden">
                        <CardHeader className="pb-1.5 pt-2 px-3 shrink-0">
                            <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                                📋 Dettagli
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 px-3 pb-3 overflow-auto space-y-2">
                            {requirement.description && (
                                <div className="bg-accent/30 p-2 rounded-lg">
                                    <h4 className="text-[10px] font-medium mb-1 text-muted-foreground">Descrizione</h4>
                                    <p className="text-xs whitespace-pre-wrap leading-relaxed">{requirement.description}</p>
                                </div>
                            )}

                            {/* Timeline Compatta */}
                            <div className="bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20 p-2 rounded-lg">
                                <h4 className="text-[10px] font-medium mb-2 text-muted-foreground">Timeline</h4>
                                <div className="space-y-1.5">
                                    {/* Creazione */}
                                    <div className="flex items-center gap-2 p-1.5 bg-white/80 dark:bg-gray-900/80 rounded">
                                        <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <Calendar className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                                <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">Creazione</span>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground">
                                                {new Date(requirement.created_on).toLocaleDateString('it-IT', { month: 'short', day: 'numeric', year: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Ultima Stima */}
                                    {requirement.last_estimated_on && (
                                        <div className="flex items-center gap-2 p-1.5 bg-white/80 dark:bg-gray-900/80 rounded">
                                            <div className="w-2 h-2 rounded-full bg-purple-500 shrink-0"></div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                    <Clock className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                                                    <span className="text-[10px] font-medium text-purple-600 dark:text-purple-400">Ultima Stima</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <p className="text-[10px] text-muted-foreground">
                                                        {new Date(requirement.last_estimated_on).toLocaleDateString('it-IT', { month: 'short', day: 'numeric', year: '2-digit' })}
                                                    </p>
                                                    {latestEstimate && (
                                                        <div className="flex items-center gap-1">
                                                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                                                                {latestEstimate.total_days}gg
                                                            </Badge>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Stato Attuale */}
                                    <div className="flex items-center gap-2 p-1.5 bg-white/80 dark:bg-gray-900/80 rounded">
                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0"></div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <TrendingUp className="h-3 w-3 text-green-600 dark:text-green-400" />
                                                <span className="text-[10px] font-medium text-green-600 dark:text-green-400">Stato</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Badge className={`${getStateColor(requirement.state)} text-[9px] px-1 py-0 h-4`}>
                                                    {stateLabel}
                                                </Badge>
                                                <Badge className={`${getPriorityColor(requirement.priority)} text-[9px] px-1 py-0 h-4`}>
                                                    {priorityLabel}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Statistiche Stime - Compatto */}
                            {estimates.length > 0 && (
                                <div className="bg-accent/30 p-2 rounded-lg">
                                    <h4 className="text-[10px] font-medium mb-1.5 text-muted-foreground">Statistiche Stime</h4>
                                    <div className="grid grid-cols-3 gap-1.5">
                                        <div className="bg-primary/10 p-1.5 rounded text-center">
                                            <p className="text-base font-bold text-primary leading-none">{estimates.length}</p>
                                            <p className="text-[9px] text-muted-foreground mt-0.5">Scenari</p>
                                        </div>
                                        <div className="bg-green-500/10 p-1.5 rounded text-center">
                                            <p className="text-base font-bold text-green-600 dark:text-green-400 leading-none">
                                                {Math.min(...estimates.map(e => e.total_days))}
                                            </p>
                                            <p className="text-[9px] text-muted-foreground mt-0.5">Min gg</p>
                                        </div>
                                        <div className="bg-red-500/10 p-1.5 rounded text-center">
                                            <p className="text-base font-bold text-red-600 dark:text-red-400 leading-none">
                                                {Math.max(...estimates.map(e => e.total_days))}
                                            </p>
                                            <p className="text-[9px] text-muted-foreground mt-0.5">Max gg</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {requirement.labels && (
                                <div className="bg-accent/30 p-2 rounded-lg">
                                    <h4 className="text-[10px] font-medium mb-1.5 text-muted-foreground">Etichette</h4>
                                    <div className="flex flex-wrap gap-1">
                                        {parseLabels(requirement.labels).map((label, index) => (
                                            <Badge key={index} variant="outline" className="text-[9px] px-1.5 py-0 h-5">
                                                <Tag className="h-2.5 w-2.5 mr-1" />
                                                {label.trim()}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Colonna 3: Storico Compatto + CTA */}
                    <div className="flex flex-col gap-2 h-full min-h-0">
                        {/* Storico Stime - con scroll interno */}
                        <Card className="border rounded-lg bg-white dark:bg-gray-900 flex flex-col overflow-hidden flex-1 min-h-0">
                            <CardHeader className="pb-1.5 pt-2 px-3 shrink-0">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                                        📈 Storico
                                        {estimates.length > 0 && (
                                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">{estimates.length}</Badge>
                                        )}
                                    </CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-1 px-3 pb-3 overflow-auto min-h-0">
                                {loading ? (
                                    <p className="text-[10px] text-muted-foreground py-3">Caricamento...</p>
                                ) : estimates.length === 0 ? (
                                    <p className="text-[10px] text-muted-foreground py-3">Nessuna stima storica</p>
                                ) : (
                                    <div className="space-y-2">
                                        {/* Mini Line Chart: Trend */}
                                        {estimates.length > 1 && (
                                            <div className="bg-accent/30 rounded-lg p-2">
                                                <p className="text-[10px] font-medium mb-1 text-center">Trend Giorni</p>
                                                <ReactApexChart
                                                    type="line"
                                                    height={100}
                                                    series={[{
                                                        name: 'Giorni',
                                                        data: [...estimates].reverse().map(e => e.total_days)
                                                    }]}
                                                    options={{
                                                        chart: {
                                                            type: 'line',
                                                            background: 'transparent',
                                                            toolbar: { show: false },
                                                            sparkline: { enabled: false }
                                                        },
                                                        stroke: { curve: 'smooth', width: 2 },
                                                        colors: ['#3b82f6'],
                                                        markers: {
                                                            size: 3,
                                                            colors: ['#fff'],
                                                            strokeColors: '#3b82f6',
                                                            strokeWidth: 1.5
                                                        },
                                                        xaxis: {
                                                            categories: [...estimates].reverse().map(e => `S${e.scenario}`),
                                                            labels: { style: { fontSize: '9px' } }
                                                        },
                                                        yaxis: {
                                                            labels: {
                                                                style: { fontSize: '9px' },
                                                                formatter: (val) => `${val}gg`
                                                            }
                                                        },
                                                        grid: {
                                                            strokeDashArray: 3,
                                                            xaxis: { lines: { show: false } },
                                                            padding: { top: -5, bottom: 0, left: 5, right: 5 }
                                                        },
                                                        tooltip: {
                                                            y: { formatter: (val) => `${val} giorni` }
                                                        }
                                                    } as ApexOptions}
                                                />
                                            </div>
                                        )}

                                        {/* Mini Bar Chart: Confronto ultimi 3 */}
                                        {estimates.length > 1 && (
                                            <div className="bg-accent/30 rounded-lg p-2">
                                                <p className="text-[10px] font-medium mb-1 text-center">Confronto Scenari</p>
                                                <ReactApexChart
                                                    type="bar"
                                                    height={110}
                                                    series={[
                                                        {
                                                            name: 'Subtotal',
                                                            data: estimates.slice(0, 3).reverse().map(e => e.subtotal_days)
                                                        },
                                                        {
                                                            name: 'Contingenza',
                                                            data: estimates.slice(0, 3).reverse().map(e => e.contingency_days)
                                                        }
                                                    ]}
                                                    options={{
                                                        chart: {
                                                            type: 'bar',
                                                            background: 'transparent',
                                                            toolbar: { show: false },
                                                            stacked: true
                                                        },
                                                        plotOptions: {
                                                            bar: {
                                                                horizontal: false,
                                                                borderRadius: 3,
                                                                columnWidth: '60%'
                                                            }
                                                        },
                                                        colors: ['#3b82f6', '#f97316'],
                                                        xaxis: {
                                                            categories: estimates.slice(0, 3).reverse().map(e => `S${e.scenario}`),
                                                            labels: { style: { fontSize: '9px' } }
                                                        },
                                                        yaxis: {
                                                            labels: {
                                                                style: { fontSize: '9px' },
                                                                formatter: (val) => `${val}gg`
                                                            }
                                                        },
                                                        legend: {
                                                            position: 'bottom',
                                                            fontSize: '9px',
                                                            offsetY: -5,
                                                            markers: { width: 6, height: 6 }
                                                        },
                                                        dataLabels: {
                                                            enabled: true,
                                                            style: { fontSize: '8px' },
                                                            formatter: (val) => `${val}`
                                                        },
                                                        grid: {
                                                            padding: { top: -10, bottom: 0, left: 5, right: 5 }
                                                        },
                                                        tooltip: {
                                                            y: { formatter: (val) => `${val} giorni` }
                                                        }
                                                    } as ApexOptions}
                                                />
                                            </div>
                                        )}

                                        {/* Lista Scenari Compatta - SCROLLABILE */}
                                        <div className="space-y-1.5">
                                            {estimates.map((estimate, index) => (
                                                <div
                                                    key={estimate.estimate_id}
                                                    className={`p-2 rounded-lg border text-xs ${index === 0 ? 'border-primary/40 bg-gradient-to-r from-primary/10 to-primary/5' : 'border-border hover:bg-accent/50'} cursor-pointer transition-all hover:shadow-sm`}
                                                    onClick={() => {
                                                        setSelectedEstimate(estimate);
                                                        setEditMode(true);
                                                    }}
                                                >
                                                    <div className="flex items-center justify-between mb-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-semibold text-xs">S{estimate.scenario}</span>
                                                            {index === 0 && (
                                                                <Badge variant="default" className="text-[9px] px-1 py-0 h-4">Attuale</Badge>
                                                            )}
                                                        </div>
                                                        <span className="font-bold text-primary text-sm">{estimate.total_days}gg</span>
                                                    </div>

                                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                                        <span>{new Date(estimate.created_on).toLocaleDateString('it-IT', { month: 'short', day: 'numeric' })}</span>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="bg-accent px-1.5 py-0.5 rounded">{estimate.complexity}</span>
                                                            <ChevronRight className="h-3 w-3" />
                                                        </div>
                                                    </div>

                                                    {/* Mini progress bar */}
                                                    <div className="mt-1.5 h-1 bg-accent rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-blue-500 to-orange-500"
                                                            style={{ width: `${(estimate.subtotal_days / estimate.total_days) * 100}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* CTA Nuova Stima - Fisso in basso */}
                        <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-transparent shrink-0">
                            <CardContent className="text-center py-3 px-3">
                                <Button onClick={() => setEditMode(true)} className="w-full h-8 text-xs">
                                    <Edit className="h-3.5 w-3.5 mr-1.5" />
                                    Nuova Stima
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
