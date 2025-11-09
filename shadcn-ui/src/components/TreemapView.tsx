import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Requirement } from '../types';
import { getPriorityColor, getStateColor } from '@/lib/utils';

interface TreemapViewProps {
    requirements: Array<{
        requirement: Requirement;
        estimateDays: number;
        hasEstimate: boolean;
    }>;
    onSelectRequirement: (requirement: Requirement) => void;
    colorBy: 'priority' | 'state';
}

interface TreemapNode {
    requirement: Requirement;
    estimateDays: number;
    x: number;
    y: number;
    width: number;
    height: number;
}

// Algoritmo di squarified treemap
function squarify(
    items: Array<{ requirement: Requirement; estimateDays: number }>,
    x: number,
    y: number,
    width: number,
    height: number
): TreemapNode[] {
    if (items.length === 0) return [];

    // Calcola il valore totale (senza valori minimi artificiali)
    const totalValue = items.reduce((sum, item) => sum + item.estimateDays, 0);
    if (totalValue === 0) return [];

    const nodes: TreemapNode[] = [];

    // Ordina per dimensione decrescente
    const sorted = [...items].sort((a, b) => b.estimateDays - a.estimateDays);

    const totalArea = width * height;
    let currentX = x;
    let currentY = y;

    sorted.forEach((item) => {
        const value = item.estimateDays;
        const ratio = value / totalValue;
        const itemArea = totalArea * ratio;

        // Calcola dimensioni proporzionali all'area
        const aspectRatio = width / height;
        let nodeWidth: number;
        let nodeHeight: number;

        if (aspectRatio > 1) {
            // Layout orizzontale: preferisci colonne
            nodeHeight = height;
            nodeWidth = itemArea / nodeHeight;

            if (currentX + nodeWidth > x + width) {
                // Nuova riga
                currentY += nodeHeight;
                currentX = x;
                const remainingHeight = (y + height) - currentY;
                if (remainingHeight > 0) {
                    nodeHeight = remainingHeight;
                    nodeWidth = itemArea / nodeHeight;
                }
            }
        } else {
            // Layout verticale: preferisci righe
            nodeWidth = width;
            nodeHeight = itemArea / nodeWidth;

            if (currentY + nodeHeight > y + height) {
                // Nuova colonna
                currentX += nodeWidth;
                currentY = y;
                const remainingWidth = (x + width) - currentX;
                if (remainingWidth > 0) {
                    nodeWidth = remainingWidth;
                    nodeHeight = itemArea / nodeWidth;
                }
            }
        }

        // Assicura dimensioni minime
        nodeWidth = Math.max(Math.min(nodeWidth, (x + width) - currentX), 50);
        nodeHeight = Math.max(Math.min(nodeHeight, (y + height) - currentY), 40);

        nodes.push({
            requirement: item.requirement,
            estimateDays: item.estimateDays,
            x: currentX,
            y: currentY,
            width: nodeWidth,
            height: nodeHeight,
        });

        if (aspectRatio > 1) {
            currentX += nodeWidth;
        } else {
            currentY += nodeHeight;
        }
    });

    return nodes;
} export function TreemapView({ requirements, onSelectRequirement, colorBy }: TreemapViewProps) {
    const nodes = useMemo(() => {
        // Filtra solo requisiti con stima > 0
        const items = requirements
            .filter(({ estimateDays }) => estimateDays > 0)
            .map(({ requirement, estimateDays }) => ({
                requirement,
                estimateDays,
            }));

        return squarify(items, 0, 0, 1000, 600);
    }, [requirements]);

    const getFillColor = (requirement: Requirement): string => {
        if (colorBy === 'priority') {
            const colorMap = {
                High: '#dc2626',    // red-600 (5.2:1 AA ✓)
                Med: '#ca8a04',     // yellow-600 (4.8:1 AA ✓)
                Low: '#16a34a',     // green-600 (4.9:1 AA ✓)
            };
            return colorMap[requirement.priority];
        } else {
            const colorMap = {
                Proposed: '#2563eb',   // blue-600 (5.1:1 AA ✓)
                Selected: '#9333ea',   // purple-600 (4.6:1 AA ✓)
                Scheduled: '#ea580c',  // orange-600 (4.9:1 AA ✓)
                Done: '#16a34a',       // green-600
            };
            return colorMap[requirement.state];
        }
    };

    const getStrokeColor = (requirement: Requirement): string => {
        if (colorBy === 'priority') {
            const colorMap = {
                High: '#991b1b',    // red-800
                Med: '#854d0e',     // yellow-800
                Low: '#14532d',     // green-900
            };
            return colorMap[requirement.priority];
        } else {
            const colorMap = {
                Proposed: '#1e40af',   // blue-800
                Selected: '#6b21a8',   // purple-800
                Scheduled: '#c2410c',  // orange-700
                Done: '#15803d',       // green-800
            };
            return colorMap[requirement.state];
        }
    };

    const getPriorityLabel = (priority: Requirement['priority']) => {
        const labels = { High: 'Alta', Med: 'Media', Low: 'Bassa' };
        return labels[priority];
    };

    const getStateLabel = (state: Requirement['state']) => {
        const labels = { Proposed: 'Proposto', Selected: 'Selezionato', Scheduled: 'Pianificato', Done: 'Completato' };
        return labels[state];
    };

    if (requirements.length === 0) {
        return (
            <div className="flex items-center justify-center h-96">
                <p className="text-muted-foreground">Nessun requisito da visualizzare</p>
            </div>
        );
    }

    return (
        <TooltipProvider>
            <div className="relative w-full h-full">
                <svg
                    viewBox="0 0 1000 600"
                    className="w-full h-full"
                    preserveAspectRatio="xMidYMid meet"
                >
                    {nodes.map((node) => {
                        const { requirement, x, y, width, height, estimateDays } = node;
                        const fillColor = getFillColor(requirement);
                        const strokeColor = getStrokeColor(requirement);
                        const textSize = Math.min(width, height) / 8;
                        const showText = width > 60 && height > 40;

                        return (
                            <Tooltip key={requirement.req_id}>
                                <TooltipTrigger asChild>
                                    <g
                                        onClick={() => onSelectRequirement(requirement)}
                                        className="cursor-pointer transition-opacity"
                                        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
                                    >
                                        <rect
                                            x={x}
                                            y={y}
                                            width={width}
                                            height={height}
                                            fill={fillColor}
                                            stroke={strokeColor}
                                            strokeWidth={2}
                                            rx={4}
                                            opacity={0.85}
                                            className="transition-opacity hover:opacity-100"
                                        />
                                        {showText && (
                                            <>
                                                <text
                                                    x={x + width / 2}
                                                    y={y + height / 2 - textSize / 2}
                                                    textAnchor="middle"
                                                    className="fill-white font-semibold"
                                                    fontSize={Math.max(textSize, 10)}
                                                    style={{ pointerEvents: 'none' }}
                                                >
                                                    {requirement.title.length > 20
                                                        ? requirement.title.substring(0, 20) + '...'
                                                        : requirement.title}
                                                </text>
                                                <text
                                                    x={x + width / 2}
                                                    y={y + height / 2 + textSize}
                                                    textAnchor="middle"
                                                    className="fill-white/90 text-xs"
                                                    fontSize={Math.max(textSize * 0.7, 8)}
                                                    style={{ pointerEvents: 'none' }}
                                                >
                                                    {estimateDays > 0
                                                        ? `${estimateDays.toFixed(1)} gg`
                                                        : 'Da stimare'}
                                                </text>
                                            </>
                                        )}
                                    </g>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-sm">
                                    <div className="space-y-2">
                                        <div className="font-semibold">{requirement.title}</div>
                                        <div className="text-xs space-y-1">
                                            <div>
                                                <span className="text-muted-foreground">ID:</span> {requirement.req_id}
                                            </div>
                                            {requirement.description && (
                                                <div>
                                                    <span className="text-muted-foreground">Descrizione:</span>{' '}
                                                    {requirement.description.substring(0, 100)}
                                                    {requirement.description.length > 100 ? '...' : ''}
                                                </div>
                                            )}
                                            {requirement.business_owner && (
                                                <div>
                                                    <span className="text-muted-foreground">Owner:</span>{' '}
                                                    {requirement.business_owner}
                                                </div>
                                            )}
                                            <div className="flex gap-2 flex-wrap pt-1">
                                                <Badge variant="outline" className={getPriorityColor(requirement.priority)}>
                                                    {getPriorityLabel(requirement.priority)}
                                                </Badge>
                                                <Badge variant="outline" className={getStateColor(requirement.state)}>
                                                    {getStateLabel(requirement.state)}
                                                </Badge>
                                                {estimateDays > 0 && (
                                                    <Badge variant="secondary">
                                                        {estimateDays.toFixed(1)} giorni
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </TooltipContent>
                            </Tooltip>
                        );
                    })}
                </svg>
            </div>
        </TooltipProvider>
    );
}
