import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, User, Tag, Edit, Clock, TrendingUp, ChevronRight } from 'lucide-react';
import ReactApexChart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Requirement, Estimate, List } from '../types';
import { getEstimatesByReqId } from '../lib/storage';
import { getPriorityColor, getStateColor } from '@/lib/utils';
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
                onBack={() => {
                    setEditMode(false);
                    loadEstimates(); // Ricarica stime dopo l'edit
                }}
            />
        );
    }

    return (
        <div className="h-screen bg-gray-50 dark:bg-black overflow-hidden flex flex-col p-4">
            <div className="max-w-7xl mx-auto w-full h-full flex flex-col gap-3">
                {/* Header compatto - altezza fissa */}
                <div className="flex items-center justify-between gap-4 bg-white dark:bg-gray-900 p-3 rounded-lg border shadow-sm shrink-0">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Button variant="outline" size="sm" onClick={onBack} className="shrink-0">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-mono text-muted-foreground">{requirement.req_id}</span>
                                <Badge className={`${getPriorityColor(requirement.priority)} text-xs`}>
                                    {priorityLabel}
                                </Badge>
                                <Badge className={`${getStateColor(requirement.state)} text-xs`}>
                                    {stateLabel}
                                </Badge>
                                {requirement.business_owner && (
                                    <>
                                        <span className="text-muted-foreground mx-1">•</span>
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <User className="h-3 w-3" />
                                            <span className="truncate">{requirement.business_owner}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-50 truncate">{requirement.title}</h1>
                        </div>
                    </div>
                </div>

                {/* Layout a 3 colonne - riempie spazio restante */}
                <div className="grid grid-cols-3 gap-3 flex-1 overflow-hidden min-h-0">
                    {/* Colonna 1: Card Stima Corrente */}
                    <div className="flex flex-col h-full">
                        {latestEstimate ? (
                            <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent shadow-md flex flex-col h-full overflow-hidden">
                                <CardHeader className="pb-2 shrink-0">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <TrendingUp className="h-4 w-4 text-primary" />
                                            Stima Corrente
                                        </CardTitle>
                                        <Button size="sm" onClick={() => setEditMode(true)}>
                                            <Edit className="h-3 w-3 mr-1" />
                                            Modifica
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="flex-1 overflow-auto">
                                    <div className="space-y-3">
                                        {/* Totale Giorni Prominente */}
                                        <div className="text-center py-2">
                                            <p className="text-xs text-muted-foreground mb-1">Totale Giorni</p>
                                            <p className="text-4xl font-bold text-primary">{latestEstimate.total_days}</p>
                                        </div>

                                        <Separator />

                                        {/* Radial Chart: Contingency vs Subtotal */}
                                        <div>
                                            <p className="text-xs font-medium mb-2 text-center">Distribuzione Stima</p>
                                            <ReactApexChart
                                                type="radialBar"
                                                height={180}
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
                                                            offsetY: 0,
                                                            hollow: {
                                                                size: '30%'
                                                            },
                                                            dataLabels: {
                                                                name: {
                                                                    fontSize: '11px',
                                                                    offsetY: -5
                                                                },
                                                                value: {
                                                                    fontSize: '14px',
                                                                    fontWeight: 'bold',
                                                                    offsetY: 5,
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
                                                        fontSize: '11px',
                                                        labels: {
                                                            colors: ['#666', '#666']
                                                        }
                                                    }
                                                } as ApexOptions}
                                            />
                                        </div>

                                        <Separator />

                                        {/* Gauge Chart: Risk Score */}
                                        <div>
                                            <p className="text-xs font-medium mb-2 text-center">Risk Score</p>
                                            <ReactApexChart
                                                type="radialBar"
                                                height={160}
                                                series={[Math.min(100, (latestEstimate.risk_score / 30) * 100)]}
                                                options={{
                                                    chart: {
                                                        type: 'radialBar',
                                                        background: 'transparent',
                                                        toolbar: { show: false }
                                                    },
                                                    plotOptions: {
                                                        radialBar: {
                                                            hollow: {
                                                                size: '60%'
                                                            },
                                                            dataLabels: {
                                                                name: {
                                                                    show: false
                                                                },
                                                                value: {
                                                                    fontSize: '24px',
                                                                    fontWeight: 'bold',
                                                                    formatter: () => `${latestEstimate.risk_score}pt`
                                                                }
                                                            },
                                                            track: {
                                                                background: '#e5e7eb'
                                                            }
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
                                            <div className="flex justify-between text-xs text-muted-foreground px-2">
                                                <span>0pt (Low)</span>
                                                <span>30pt+ (High)</span>
                                            </div>
                                        </div>

                                        <Separator />

                                        {/* Metriche Dettagliate */}
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div className="p-2 bg-blue-50 dark:bg-blue-950/20 rounded">
                                                <p className="text-xs text-muted-foreground mb-1">Subtotal</p>
                                                <p className="font-semibold text-blue-600 dark:text-blue-400">{latestEstimate.subtotal_days}gg</p>
                                            </div>
                                            <div className="p-2 bg-orange-50 dark:bg-orange-950/20 rounded">
                                                <p className="text-xs text-muted-foreground mb-1">Contingenza</p>
                                                <p className="font-semibold text-orange-600 dark:text-orange-400">
                                                    {latestEstimate.contingency_days}gg ({Math.round(latestEstimate.contingency_pct * 100)}%)
                                                </p>
                                            </div>
                                        </div>

                                        <Separator />

                                        {/* Info Footer */}
                                        <div className="space-y-2 text-xs text-muted-foreground">
                                            <div className="flex items-center gap-2">
                                                <Clock className="h-3 w-3" />
                                                <span>{new Date(latestEstimate.created_on).toLocaleDateString('it-IT')}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Scenario #{latestEstimate.scenario}</span>
                                                <span>{latestEstimate.included_activities.length} attività • {latestEstimate.selected_risks.length} rischi</span>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ) : (
                            <Card className="border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center h-full">
                                <CardContent className="text-center py-8">
                                    <p className="text-sm text-muted-foreground mb-4">Nessuna stima creata</p>
                                    <Button onClick={() => setEditMode(true)} size="sm">
                                        <Edit className="h-3 w-3 mr-2" />
                                        Crea Stima
                                    </Button>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Colonna 2: Dettagli Requisito */}
                    <Card className="border rounded-lg bg-white dark:bg-gray-900 flex flex-col h-full overflow-hidden">
                        <CardHeader className="pb-2 shrink-0">
                            <CardTitle className="text-base flex items-center gap-2">
                                📋 Dettagli Requisito
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-auto space-y-3">
                            {requirement.description && (
                                <div>
                                    <h4 className="text-xs font-medium mb-1 text-muted-foreground">Descrizione</h4>
                                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{requirement.description}</p>
                                </div>
                            )}

                            <Separator />

                            {/* Timeline Visuale */}
                            <div>
                                <h4 className="text-xs font-medium mb-3 text-muted-foreground">Timeline</h4>
                                <div className="relative pl-6 space-y-4">
                                    {/* Linea verticale */}
                                    <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gradient-to-b from-blue-500 via-purple-500 to-green-500"></div>

                                    {/* Creazione */}
                                    <div className="relative">
                                        <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-blue-500 border-2 border-white dark:border-gray-900"></div>
                                        <div className="bg-blue-50 dark:bg-blue-950/20 p-2 rounded-lg">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Calendar className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Creazione</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                {new Date(requirement.created_on).toLocaleDateString('it-IT', {
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric'
                                                })}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Ultima Stima */}
                                    {requirement.last_estimated_on && (
                                        <div className="relative">
                                            <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-purple-500 border-2 border-white dark:border-gray-900"></div>
                                            <div className="bg-purple-50 dark:bg-purple-950/20 p-2 rounded-lg">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Clock className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                                                    <span className="text-xs font-medium text-purple-600 dark:text-purple-400">Ultima Stima</span>
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    {new Date(requirement.last_estimated_on).toLocaleDateString('it-IT', {
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric'
                                                    })}
                                                </p>
                                                {latestEstimate && (
                                                    <div className="mt-1 flex items-center gap-2 text-xs">
                                                        <Badge variant="outline" className="text-xs px-1">
                                                            {latestEstimate.total_days}gg
                                                        </Badge>
                                                        <Badge variant="outline" className="text-xs px-1">
                                                            Scenario {latestEstimate.scenario}
                                                        </Badge>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Stato Attuale */}
                                    <div className="relative">
                                        <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-green-500 border-2 border-white dark:border-gray-900 animate-pulse"></div>
                                        <div className="bg-green-50 dark:bg-green-950/20 p-2 rounded-lg">
                                            <div className="flex items-center gap-2 mb-1">
                                                <TrendingUp className="h-3 w-3 text-green-600 dark:text-green-400" />
                                                <span className="text-xs font-medium text-green-600 dark:text-green-400">Stato Attuale</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge className={`${getStateColor(requirement.state)} text-xs`}>
                                                    {stateLabel}
                                                </Badge>
                                                <Badge className={`${getPriorityColor(requirement.priority)} text-xs`}>
                                                    {priorityLabel}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Statistiche Stime */}
                            {estimates.length > 0 && (
                                <>
                                    <Separator />
                                    <div>
                                        <h4 className="text-xs font-medium mb-2 text-muted-foreground">Statistiche Stime</h4>
                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="bg-accent/50 p-2 rounded text-center">
                                                <p className="text-lg font-bold text-primary">{estimates.length}</p>
                                                <p className="text-xs text-muted-foreground">Scenari</p>
                                            </div>
                                            <div className="bg-accent/50 p-2 rounded text-center">
                                                <p className="text-lg font-bold text-primary">
                                                    {Math.min(...estimates.map(e => e.total_days))}
                                                </p>
                                                <p className="text-xs text-muted-foreground">Min gg</p>
                                            </div>
                                            <div className="bg-accent/50 p-2 rounded text-center">
                                                <p className="text-lg font-bold text-primary">
                                                    {Math.max(...estimates.map(e => e.total_days))}
                                                </p>
                                                <p className="text-xs text-muted-foreground">Max gg</p>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {requirement.labels && (
                                <>
                                    <Separator />
                                    <div>
                                        <h4 className="text-xs font-medium mb-2 text-muted-foreground">Etichette</h4>
                                        <div className="flex flex-wrap gap-1">
                                            {requirement.labels.split(',').map((label, index) => (
                                                <Badge key={index} variant="outline" className="text-xs">
                                                    <Tag className="h-3 w-3 mr-1" />
                                                    {label.trim()}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Colonna 3: Storico + CTA Nuova Stima */}
                    <div className="flex flex-col gap-3 h-full overflow-hidden">
                        {/* Storico Stime - 70% altezza */}
                        <Card className="border rounded-lg bg-white dark:bg-gray-900 flex flex-col overflow-hidden" style={{ height: '70%' }}>
                            <CardHeader className="pb-2 shrink-0">
                                <CardTitle className="text-base flex items-center gap-2">
                                    📈 Storico Stime
                                    {estimates.length > 0 && (
                                        <Badge variant="secondary" className="text-xs">{estimates.length}</Badge>
                                    )}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex-1 overflow-auto">
                                {loading ? (
                                    <p className="text-xs text-muted-foreground py-4">Caricamento...</p>
                                ) : estimates.length === 0 ? (
                                    <p className="text-xs text-muted-foreground py-4">Nessuna stima storica</p>
                                ) : (
                                    <div className="space-y-3">
                                        {/* Line Chart: Trend Totale Giorni */}
                                        {estimates.length > 1 && (
                                            <div className="mb-3">
                                                <p className="text-xs font-medium mb-2 text-center">Trend Giorni Totali</p>
                                                <ReactApexChart
                                                    type="line"
                                                    height={120}
                                                    series={[{
                                                        name: 'Giorni Totali',
                                                        data: [...estimates].reverse().map(e => e.total_days)
                                                    }]}
                                                    options={{
                                                        chart: {
                                                            type: 'line',
                                                            background: 'transparent',
                                                            toolbar: { show: false },
                                                            sparkline: { enabled: false }
                                                        },
                                                        stroke: {
                                                            curve: 'smooth',
                                                            width: 3
                                                        },
                                                        colors: ['#3b82f6'],
                                                        markers: {
                                                            size: 4,
                                                            colors: ['#fff'],
                                                            strokeColors: '#3b82f6',
                                                            strokeWidth: 2
                                                        },
                                                        xaxis: {
                                                            categories: [...estimates].reverse().map(e => `S${e.scenario}`),
                                                            labels: {
                                                                style: {
                                                                    fontSize: '10px'
                                                                }
                                                            }
                                                        },
                                                        yaxis: {
                                                            labels: {
                                                                style: {
                                                                    fontSize: '10px'
                                                                },
                                                                formatter: (val) => `${val}gg`
                                                            }
                                                        },
                                                        grid: {
                                                            strokeDashArray: 4,
                                                            xaxis: {
                                                                lines: { show: false }
                                                            }
                                                        },
                                                        tooltip: {
                                                            y: {
                                                                formatter: (val) => `${val} giorni`
                                                            }
                                                        }
                                                    } as ApexOptions}
                                                />
                                            </div>
                                        )}

                                        {/* Bar Chart: Confronto ultimi 3 scenari */}
                                        {estimates.length > 1 && (
                                            <div className="mb-3">
                                                <p className="text-xs font-medium mb-2 text-center">Confronto Scenari</p>
                                                <ReactApexChart
                                                    type="bar"
                                                    height={140}
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
                                                                borderRadius: 4
                                                            }
                                                        },
                                                        colors: ['#3b82f6', '#f97316'],
                                                        xaxis: {
                                                            categories: estimates.slice(0, 3).reverse().map(e => `S${e.scenario}`),
                                                            labels: {
                                                                style: {
                                                                    fontSize: '10px'
                                                                }
                                                            }
                                                        },
                                                        yaxis: {
                                                            labels: {
                                                                style: {
                                                                    fontSize: '10px'
                                                                },
                                                                formatter: (val) => `${val}gg`
                                                            }
                                                        },
                                                        legend: {
                                                            position: 'bottom',
                                                            fontSize: '10px',
                                                            markers: {
                                                                width: 8,
                                                                height: 8
                                                            }
                                                        },
                                                        dataLabels: {
                                                            enabled: true,
                                                            style: {
                                                                fontSize: '9px'
                                                            },
                                                            formatter: (val) => `${val}gg`
                                                        },
                                                        tooltip: {
                                                            y: {
                                                                formatter: (val) => `${val} giorni`
                                                            }
                                                        }
                                                    } as ApexOptions}
                                                />
                                            </div>
                                        )}

                                        <Separator />

                                        {/* Lista Scenari Compatta */}
                                        <div className="space-y-2">
                                            {estimates.map((estimate, index) => (
                                                <div
                                                    key={estimate.estimate_id}
                                                    className={`p-2 rounded-lg border text-xs ${index === 0 ? 'border-primary/40 bg-primary/5' : 'border-border hover:bg-accent/50'} cursor-pointer transition-colors`}
                                                    onClick={() => {
                                                        setSelectedEstimate(estimate);
                                                        setEditMode(true);
                                                    }}
                                                >
                                                    <div className="flex items-center justify-between mb-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-semibold">S{estimate.scenario}</span>
                                                            {index === 0 && (
                                                                <Badge variant="default" className="text-xs px-1 py-0">Attuale</Badge>
                                                            )}
                                                        </div>
                                                        <span className="font-bold text-primary">{estimate.total_days}gg</span>
                                                    </div>

                                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                        <span>{new Date(estimate.created_on).toLocaleDateString('it-IT', { month: 'short', day: 'numeric' })}</span>
                                                        <div className="flex items-center gap-2">
                                                            <span>{estimate.complexity}</span>
                                                            <ChevronRight className="h-3 w-3" />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* CTA Nuova Stima - 30% altezza */}
                        <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-transparent flex flex-col justify-center" style={{ height: '30%' }}>
                            <CardContent className="text-center py-4">
                                <p className="text-xs text-muted-foreground mb-3">
                                    Crea nuovo scenario
                                </p>
                                <Button onClick={() => setEditMode(true)} className="w-full">
                                    <Edit className="h-4 w-4 mr-2" />
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
