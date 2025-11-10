import { Network, ArrowUpRight, ArrowDownRight, ExternalLink, AlertTriangle, GitBranch } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Requirement } from '../types';

interface RequirementRelationsProps {
    currentRequirement: Requirement;
    allRequirements: Requirement[];
    onNavigate: (reqId: string) => void;
    compact?: boolean;
}

const MAX_HIERARCHY_DEPTH = 5;

/**
 * Costruisce la catena degli antenati risalendo fino alla radice
 * con limite MAX_HIERARCHY_DEPTH
 */
function buildAncestorChain(
    requirement: Requirement,
    allRequirements: Requirement[]
): Requirement[] {
    const chain: Requirement[] = [];
    let current: Requirement | undefined = requirement;
    let depth = 0;

    while (current?.parent_req_id && depth < MAX_HIERARCHY_DEPTH) {
        const parent = allRequirements.find(r => r.req_id === current!.parent_req_id);
        if (!parent) break;
        chain.push(parent);
        current = parent;
        depth++;
    }

    return chain.reverse(); // Radice → ... → Parent diretto
}

/**
 * Calcola la profondità massima dell'albero dei discendenti
 */
function calculateMaxDescendantDepth(
    requirement: Requirement,
    allRequirements: Requirement[],
    currentDepth = 0
): number {
    if (currentDepth >= MAX_HIERARCHY_DEPTH) return currentDepth;

    const children = allRequirements.filter(r => r.parent_req_id === requirement.req_id);

    if (children.length === 0) return currentDepth;

    const childDepths = children.map(child =>
        calculateMaxDescendantDepth(child, allRequirements, currentDepth + 1)
    );

    return Math.max(...childDepths);
}

/**
 * Verifica se il requisito è alla massima profondità consentita
 */
function isAtMaxDepth(
    requirement: Requirement,
    allRequirements: Requirement[]
): boolean {
    return buildAncestorChain(requirement, allRequirements).length >= MAX_HIERARCHY_DEPTH;
}

export function RequirementRelations({
    currentRequirement,
    allRequirements,
    onNavigate,
    compact = false
}: RequirementRelationsProps) {
    // Build ancestor chain (A > B > C where C is current)
    const ancestorChain = buildAncestorChain(currentRequirement, allRequirements);

    // Find direct parent
    const parentRequirement = currentRequirement.parent_req_id
        ? allRequirements.find(r => r.req_id === currentRequirement.parent_req_id)
        : null;

    // Find children requirements
    const childRequirements = allRequirements.filter(
        r => r.parent_req_id === currentRequirement.req_id
    );

    // Calculate hierarchy metrics
    const currentDepth = ancestorChain.length;
    const maxDescendantDepth = calculateMaxDescendantDepth(currentRequirement, allRequirements);
    const isAtLimit = isAtMaxDepth(currentRequirement, allRequirements);

    const hasRelations = ancestorChain.length > 0 || childRequirements.length > 0;

    if (!hasRelations) {
        return null;
    }

    if (compact) {
        // Compact badge version for EstimateEditor
        return (
            <div className="flex items-center gap-2 text-xs">
                <Network className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-muted-foreground">
                    {ancestorChain.length > 0 && (
                        <span>Catena: {ancestorChain.length + 1} livelli</span>
                    )}
                    {ancestorChain.length > 0 && childRequirements.length > 0 && <span> • </span>}
                    {childRequirements.length > 0 && <span>{childRequirements.length} req dipendenti</span>}
                </span>
                {isAtLimit && (
                    <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4">
                        Max profondità
                    </Badge>
                )}
            </div>
        );
    }

    return (
        <Card className="border rounded-lg bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20">
            <CardHeader className="pb-1.5 pt-2 px-3 shrink-0">
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                    <Network className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    Relazioni
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 ml-auto">
                        Livello {currentDepth + 1}/{MAX_HIERARCHY_DEPTH}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-2">
                {/* Ancestor Chain - Visualizzazione a cascata */}
                {ancestorChain.length > 0 && (
                    <div className="bg-white/80 dark:bg-gray-900/80 p-2 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-1.5 mb-2">
                            <ArrowUpRight className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                            <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">
                                Catena di dipendenze ({ancestorChain.length + 1} livelli)
                            </span>
                        </div>

                        {/* Breadcrumb-style chain visualization */}
                        <div className="space-y-1">
                            {ancestorChain.map((ancestor, index) => {
                                const isRoot = index === 0;
                                const indentLevel = index;

                                return (
                                    <div
                                        key={ancestor.req_id}
                                        className="flex items-center gap-2"
                                        style={{ paddingLeft: `${indentLevel * 12}px` }}
                                    >
                                        {!isRoot && (
                                            <div className="text-blue-400 dark:text-blue-500 text-[10px]">└─</div>
                                        )}
                                        {isRoot && (
                                            <GitBranch className="h-3 w-3 text-blue-500 dark:text-blue-400" />
                                        )}
                                        <div className="flex-1 flex items-center justify-between gap-2 p-1 bg-blue-50/50 dark:bg-blue-950/30 rounded hover:bg-blue-100/50 dark:hover:bg-blue-900/40 transition-colors">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] font-medium truncate">{ancestor.title}</p>
                                                <p className="text-[9px] text-muted-foreground font-mono">
                                                    {ancestor.req_id.split('-')[1]}
                                                </p>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-5 w-5 p-0 shrink-0"
                                                onClick={() => onNavigate(ancestor.req_id)}
                                            >
                                                <ExternalLink className="h-2.5 w-2.5" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Current requirement in chain */}
                            <div
                                className="flex items-center gap-2"
                                style={{ paddingLeft: `${ancestorChain.length * 12}px` }}
                            >
                                <div className="text-blue-400 dark:text-blue-500 text-[10px]">└─</div>
                                <div className="flex-1 p-1 bg-primary/10 border border-primary/30 rounded">
                                    <div className="flex items-center gap-1.5">
                                        <Badge variant="default" className="text-[9px] px-1 py-0 h-4">Tu sei qui</Badge>
                                        <p className="text-[10px] font-semibold truncate flex-1">{currentRequirement.title}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Direct parent (fallback if no chain, shouldn't happen) */}
                {ancestorChain.length === 0 && parentRequirement && (
                    <div className="bg-white/80 dark:bg-gray-900/80 p-2 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-1.5 mb-1">
                            <ArrowUpRight className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                            <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">
                                Dipende da
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate">{parentRequirement.title}</p>
                                <p className="text-[9px] text-muted-foreground font-mono">
                                    {parentRequirement.req_id.split('-')[1]}
                                </p>
                            </div>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0 shrink-0"
                                onClick={() => onNavigate(parentRequirement.req_id)}
                            >
                                <ExternalLink className="h-3 w-3" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* Children Requirements */}
                {childRequirements.length > 0 && (
                    <div className="bg-white/80 dark:bg-gray-900/80 p-2 rounded-lg border border-purple-200 dark:border-purple-800">
                        <div className="flex items-center gap-1.5 mb-1.5">
                            <ArrowDownRight className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                            <span className="text-[10px] font-medium text-purple-600 dark:text-purple-400">
                                Requisiti dipendenti
                            </span>
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 ml-auto">
                                {childRequirements.length}
                            </Badge>
                        </div>
                        <div className="space-y-1.5">
                            {childRequirements.map((child) => {
                                const childDepth = calculateMaxDescendantDepth(child, allRequirements, 1);

                                return (
                                    <div
                                        key={child.req_id}
                                        className="flex items-center justify-between gap-2 p-1.5 bg-purple-50/50 dark:bg-purple-950/20 rounded hover:bg-purple-100/50 dark:hover:bg-purple-900/30 transition-colors"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <p className="text-xs truncate flex-1">{child.title}</p>
                                                {childDepth > 0 && (
                                                    <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5">
                                                        +{childDepth}
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-[9px] text-muted-foreground font-mono">
                                                {child.req_id.split('-')[1]}
                                            </p>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-5 w-5 p-0 shrink-0"
                                            onClick={() => onNavigate(child.req_id)}
                                        >
                                            <ExternalLink className="h-2.5 w-2.5" />
                                        </Button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Warning if at max depth */}
                {isAtLimit && (
                    <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800 py-1.5">
                        <AlertDescription className="text-[10px] flex items-center gap-1.5">
                            <AlertTriangle className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                            <span>Limite profondità raggiunto: non puoi aggiungere requisiti parent</span>
                        </AlertDescription>
                    </Alert>
                )}

                {/* Info message about hierarchy */}
                <div className="text-[10px] text-muted-foreground bg-accent/20 p-1.5 rounded flex items-center gap-1.5">
                    <span>💡</span>
                    <div>
                        <div>Le relazioni gerarchiche influenzano il calcolo del percorso critico</div>
                        {currentDepth + maxDescendantDepth > 0 && (
                            <div className="text-[9px] mt-0.5">
                                Profondità totale: {currentDepth + maxDescendantDepth + 1} livelli
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
