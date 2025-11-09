import { useMemo } from 'react';
import Chart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import { Requirement } from '../types';

type RequirementTreemapDatum = {
    x: string;
    y: number;
    fillColor: string;
    reqId: string;
    priority: Requirement['priority'];
    state: Requirement['state'];
    days: number;
    percentage: number;
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

interface TreemapApexRequirementsProps {
    requirements: Array<{
        requirement: Requirement;
        estimateDays: number;
        hasEstimate: boolean;
    }>;
    onSelectRequirement: (requirement: Requirement) => void;
    colorBy: 'priority' | 'state';
    containerHeight?: number | string;
}

export function TreemapApexRequirements({
    requirements,
    onSelectRequirement,
    colorBy,
    containerHeight = 300
}: TreemapApexRequirementsProps) {
    const { series, options } = useMemo(() => {
        // Filter requirements with estimates
        const reqsWithEstimates = requirements.filter(r => r.estimateDays > 0);

        if (reqsWithEstimates.length === 0) {
            return { series: [], options: {} as ApexOptions };
        }

        const totalDays = reqsWithEstimates.reduce((sum, r) => sum + r.estimateDays, 0);

        const data: RequirementTreemapDatum[] = reqsWithEstimates.map(({ requirement, estimateDays }) => {
            const percentage = (estimateDays / totalDays) * 100;

            return {
                x: requirement.title,
                y: Math.round(estimateDays * 10) / 10, // Round to 1 decimal
                fillColor: colorBy === 'priority'
                    ? getPriorityColor(requirement.priority)
                    : getStateColor(requirement.state),
                reqId: requirement.req_id,
                priority: requirement.priority,
                state: requirement.state,
                days: estimateDays,
                percentage: percentage
            };
        });

        const series = [{
            data: data
        }];

        const options: ApexOptions = {
            chart: {
                type: 'treemap',
                height: containerHeight,
                toolbar: {
                    show: false
                },
                animations: {
                    enabled: true,
                    speed: 400
                },
                events: {
                    dataPointSelection: (_event, _chartContext, config) => {
                        const selectedData = data[config.dataPointIndex];
                        const selectedReq = reqsWithEstimates.find(r => r.requirement.req_id === selectedData.reqId);
                        if (selectedReq) {
                            onSelectRequirement(selectedReq.requirement);
                        }
                    }
                }
            },
            legend: {
                show: false
            },
            plotOptions: {
                treemap: {
                    enableShades: false,
                    distributed: true,
                    dataLabels: {
                        format: 'truncate'
                    }
                }
            },
            dataLabels: {
                enabled: true,
                style: {
                    fontSize: '11px',
                    fontWeight: 600,
                    colors: ['#fff']
                },
                formatter: function (text: string, opts: DataLabelFormatterOpts) {
                    const dataPoint = data[opts.dataPointIndex];
                    // Truncate long titles
                    const shortTitle = text.length > 20 ? text.substring(0, 17) + '...' : text;
                    return `${shortTitle}\n${dataPoint.days.toFixed(1)} gg`;
                }
            },
            colors: data.map(d => d.fillColor),
            tooltip: {
                enabled: true,
                theme: 'dark',
                style: {
                    fontSize: '12px',
                    fontFamily: 'inherit'
                },
                custom: function ({ dataPointIndex }: TooltipCustomParams) {
                    const dataPoint = data[dataPointIndex];
                    const colorLabel = colorBy === 'priority'
                        ? `Priorità ${dataPoint.priority}`
                        : `Stato ${dataPoint.state}`;

                    return `
                        <div style="padding: 8px 10px; min-width: 160px;">
                            <div style="font-weight: 600; font-size: 13px; margin-bottom: 2px;">
                                ${dataPoint.x}
                            </div>
                            <div style="font-size: 11px; color: rgba(255,255,255,0.8); margin-bottom: 6px;">
                                ${colorLabel}
                            </div>
                            <div style="font-size: 12px;">
                                ${dataPoint.days.toFixed(1)} gg • ${dataPoint.percentage.toFixed(1)}%
                            </div>
                        </div>
                    `;
                }
            }
        };

        return { series, options };
    }, [requirements, onSelectRequirement, colorBy, containerHeight]);

    if (series.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
                Nessun requisito con stima
            </div>
        );
    }

    return (
        <div className="w-full h-full">
            <Chart
                options={options}
                series={series}
                type="treemap"
                height={containerHeight}
            />
        </div>
    );
}

// Color mapping functions to match the site's color scheme
function getPriorityColor(priority: string): string {
    switch (priority) {
        case 'High':
            return '#ef4444'; // red-500
        case 'Med':
            return '#eab308'; // yellow-500
        case 'Low':
            return '#22c55e'; // green-500
        default:
            return '#3b82f6'; // blue-500
    }
}

function getStateColor(state: string): string {
    switch (state) {
        case 'Proposed':
            return '#3b82f6'; // blue-500
        case 'Selected':
            return '#a855f7'; // purple-500
        case 'Scheduled':
            return '#f97316'; // orange-500
        case 'Done':
            return '#16a34a'; // green-600
        default:
            return '#64748b'; // slate-500
    }
}
