import { AlertCircle, FileText, Trash2, User, ListChecks, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { List } from '../types';

import { getTechnologyColor } from '../lib/technology-colors';
import { getListBaseColor, mixHexColors, hexToRgb } from './TreemapApexMultiSeries';
// Funzione per scegliere colore testo leggibile su background
function getContrastTextColor(bgColor: string): string {
    const rgb = hexToRgb(bgColor);
    if (!rgb) return '#222';
    // Calcolo luminanza relativa (WCAG)
    const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
    return luminance > 0.6 ? '#222' : '#fff';
}

interface EmptyListsSidebarProps {
    emptyLists: List[];
    nonEmptyLists: List[];
    listStats: Record<string, { totalRequirements: number; totalDays: number; criticalPathDays: number }>;
    onSelectList: (list: List) => void;
    onDeleteList: (list: List) => void;
}

export function EmptyListsSidebar({
    emptyLists,
    nonEmptyLists,
    listStats,
    onSelectList,
    onDeleteList
}: EmptyListsSidebarProps) {
    if (emptyLists.length === 0 && nonEmptyLists.length === 0) return null;

    return (
        <div className="w-64 shrink-0 flex flex-col space-y-4">
            {/* Header Liste Vuote */}
            {emptyLists.length > 0 && (
                <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-2 dark:border-amber-700 dark:bg-amber-950/30 mb-4">
                    <div className="mb-1.5 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <h3 className="text-xs font-semibold text-amber-900 dark:text-amber-100">Liste Vuote</h3>
                        <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1.5">
                            {emptyLists.length}
                        </Badge>
                    </div>
                    <p className="text-[10px] text-amber-700 dark:text-amber-300">
                        Senza requisiti o stime
                    </p>
                </div>
            )}

            {/* Empty Lists Cards */}
            {emptyLists.length > 0 && (
                <div className="flex-1 min-h-0 space-y-1.5 overflow-y-auto pr-1">
                    {emptyLists.map((list) => {
                        const stats = listStats[list.list_id] || { totalRequirements: 0, totalDays: 0, criticalPathDays: 0 };
                        const technology = list.technology?.trim();
                        const technologyColor = technology ? getTechnologyColor(technology) : undefined;

                        return (
                            <Card
                                key={list.list_id}
                                className="cursor-pointer border border-amber-100 bg-white transition-all hover:border-amber-400 hover:shadow-lg dark:bg-gray-900"
                                onClick={() => onSelectList(list)}
                            >
                                <CardContent className="px-2 py-1.5">
                                    <div className="flex items-start gap-1.5">
                                        <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                                        <div className="min-w-0 flex-1 space-y-0.5">
                                            <div className="flex items-center gap-1.5">
                                                <h4 className="truncate text-xs font-semibold leading-tight">{list.name}</h4>
                                                {technology && (
                                                    <span
                                                        className="rounded-full border px-1.5 py-[1px] text-[9px] font-semibold"
                                                        style={{
                                                            color: technologyColor,
                                                            backgroundColor: `${technologyColor}1a`,
                                                            borderColor: `${technologyColor}33`
                                                        }}
                                                    >
                                                        {technology}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                                                <span>Req: {stats.totalRequirements}</span>
                                                {list.owner && (
                                                    <>
                                                        <span className="text-muted-foreground/50">&middot;</span>
                                                        <span className="flex items-center gap-0.5 truncate">
                                                            <User className="h-2.5 w-2.5" />
                                                            {list.owner}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onDeleteList(list);
                                            }}
                                            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-red-600"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Divider Liste con requisiti */}
            {nonEmptyLists.length > 0 && (
                <div className="rounded-lg border-2 border-blue-300 bg-blue-50 p-2 dark:border-blue-700 dark:bg-blue-950/30 mt-4">
                    <div className="mb-1.5 flex items-center gap-2">
                        <FolderOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <h3 className="text-xs font-semibold text-blue-900 dark:text-blue-100">Liste con requisiti</h3>
                        <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1.5 bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700">
                            {nonEmptyLists.length}
                        </Badge>
                    </div>
                    <p className="text-[10px] text-blue-700 dark:text-blue-300">
                        Contengono almeno un requisito stimato
                    </p>
                </div>
            )}

            {/* Non Empty Lists Cards */}
            {nonEmptyLists.length > 0 && (
                <div className="flex-1 min-h-0 max-h-[40vh] space-y-1.5 overflow-y-auto pr-1">
                    {nonEmptyLists.map((list) => {
                        const stats = listStats[list.list_id] || { totalRequirements: 0, totalDays: 0, criticalPathDays: 0 };
                        const technology = list.technology?.trim();
                        const technologyColor = technology ? getTechnologyColor(technology) : undefined;

                        // Colore coerente con il treemap
                        const listBaseColor = getListBaseColor(list.list_id);
                        const treemapPastel = '#f8fafc';
                        const pastelWeight = 0.25;
                        const cardColor = mixHexColors(listBaseColor, treemapPastel, pastelWeight);
                        const textColor = getContrastTextColor(cardColor);
                        // Esempio: nome lista sempre bold, owner in accent, req count in info, technology badge già colorato
                        return (
                            <Card
                                key={list.list_id}
                                className="cursor-pointer border transition-all hover:shadow-lg dark:bg-gray-900"
                                style={{
                                    borderColor: listBaseColor,
                                    backgroundColor: cardColor,
                                    color: textColor
                                }}
                                onClick={() => onSelectList(list)}
                            >
                                <CardContent className="px-2 py-1.5">
                                    <div className="flex items-start gap-1.5">
                                        <ListChecks className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: listBaseColor }} />
                                        <div className="min-w-0 flex-1 space-y-0.5">
                                            <div className="flex items-center gap-1.5">
                                                <h4 className="truncate text-xs font-bold leading-tight" style={{ color: textColor }}>{list.name}</h4>
                                                {technology && (
                                                    <span
                                                        className="rounded-full border px-1.5 py-[1px] text-[9px] font-semibold"
                                                        style={{
                                                            color: technologyColor,
                                                            backgroundColor: `${technologyColor}1a`,
                                                            borderColor: `${technologyColor}33`
                                                        }}
                                                    >
                                                        {technology}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                                                <span style={{ color: listBaseColor, fontWeight: 600 }}>Req: {stats.totalRequirements}</span>
                                                {list.owner && (
                                                    <>
                                                        <span style={{ color: textColor, opacity: 0.5 }}>&middot;</span>
                                                        <span className="flex items-center gap-0.5 truncate" style={{ color: textColor }}>
                                                            <User className="h-2.5 w-2.5" style={{ color: listBaseColor }} />
                                                            <span style={{ color: listBaseColor, fontWeight: 500 }}>{list.owner}</span>
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onDeleteList(list);
                                            }}
                                            className="h-6 w-6 shrink-0 hover:text-red-600"
                                            style={{ color: textColor }}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
