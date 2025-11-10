import { AlertCircle, FileText, Trash2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { List } from '../types';
import { getTechnologyColor } from '../lib/technology-colors';

interface EmptyListsSidebarProps {
    emptyLists: List[];
    listStats: Record<string, { totalRequirements: number; totalDays: number; criticalPathDays: number }>;
    onSelectList: (list: List) => void;
    onDeleteList: (list: List) => void;
}

export function EmptyListsSidebar({
    emptyLists,
    listStats,
    onSelectList,
    onDeleteList
}: EmptyListsSidebarProps) {
    if (emptyLists.length === 0) return null;

    return (
        <div className="w-72 shrink-0 space-y-4">
            {/* Header */}
            <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
                <div className="mb-3 flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">Liste Vuote</h3>
                    <Badge variant="secondary" className="ml-auto text-xs">
                        {emptyLists.length}
                    </Badge>
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                    Queste liste non hanno requisiti o stime completate
                </p>
            </div>

            {/* Empty Lists Cards */}
            <div className="max-h-[calc(100vh-300px)] space-y-2 overflow-y-auto pr-1.5">
                {emptyLists.map((list) => {
                    const stats = listStats[list.list_id] || { totalRequirements: 0, totalDays: 0, criticalPathDays: 0 };
                    const technology = list.technology?.trim();
                    const technologyColor = technology ? getTechnologyColor(technology) : undefined;
                    const createdOn = list.created_on ? new Date(list.created_on).toLocaleDateString('it-IT') : null;

                    return (
                        <Card
                            key={list.list_id}
                            className="cursor-pointer border border-amber-100 bg-white transition-all hover:border-amber-400 hover:shadow-lg dark:bg-gray-900"
                            onClick={() => onSelectList(list)}
                        >
                            <CardContent className="px-3 py-2.5">
                                <div className="flex items-start gap-2">
                                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                                    <div className="min-w-0 flex-1 space-y-1">
                                        <div className="flex items-center gap-2">
                                            <h4 className="truncate text-sm font-semibold leading-tight">{list.name}</h4>
                                            {technology && (
                                                <span
                                                    className="rounded-full border px-2 py-[2px] text-[10px] font-semibold"
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
                                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                            <span>Req: {stats.totalRequirements}</span>
                                            {list.owner && (
                                                <>
                                                    <span className="text-muted-foreground/50">&middot;</span>
                                                    <span className="flex items-center gap-1 truncate">
                                                        <User className="h-3 w-3" />
                                                        {list.owner}
                                                    </span>
                                                </>
                                            )}
                                            {createdOn && (
                                                <>
                                                    <span className="text-muted-foreground/50">&middot;</span>
                                                    <span>{createdOn}</span>
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
                                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-600"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
