import { useMemo, useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { X, CheckSquare, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
// replaced shadcn Select with native <select> in this modal to match compact card style
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Activity } from '../types';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    activitiesByGroup: Record<string, Activity[]>;
    selectedActivityCodes: string[];
    setSelectedActivityCodes: (codes: string[]) => void;
    customGroups: Array<{ group: string; activities: Activity[] }>;
    setCustomGroups: (g: Array<{ group: string; activities: Activity[] }>) => void;
    saveCatalogOnCreate: boolean;
    setSaveCatalogOnCreate: (v: boolean) => void;
    // optional controlled props: parent can provide these to persist hidden selections
    removedGroups?: string[];
    setRemovedGroups?: (g: string[]) => void;
    removedActivityCodes?: string[];
    setRemovedActivityCodes?: (c: string[]) => void;
}

export function CreateCatalogModal({
    open,
    onOpenChange,
    activitiesByGroup,
    selectedActivityCodes,
    setSelectedActivityCodes,
    customGroups,
    setCustomGroups,
    saveCatalogOnCreate,
    setSaveCatalogOnCreate
    ,
    removedGroups: removedGroupsProp,
    setRemovedGroups: setRemovedGroupsProp,
    removedActivityCodes: removedActivityCodesProp,
    setRemovedActivityCodes: setRemovedActivityCodesProp
}: Props) {
    const { toast } = useToast();
    // Debug flag - enable verbose console output to trace layout/scroll/focus issues
    const DEBUG = true;
    const activitiesScrollRef = useRef<HTMLDivElement | null>(null);
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const [showTopGradient, setShowTopGradient] = useState(false);
    const [showBottomGradient, setShowBottomGradient] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [newGroupName, setNewGroupName] = useState('');
    const [newActivityName, setNewActivityName] = useState('');
    const [newActivityDays, setNewActivityDays] = useState('');
    const [newActivityGroup, setNewActivityGroup] = useState('');
    const [highlightedActivityCode, setHighlightedActivityCode] = useState('');
    // local soft-delete state: hidden groups and activities for this dialog/session
    // parent may opt-in to control these through props; if so we synchronize both ways
    const [removedGroups, setRemovedGroups] = useState<string[]>([]);
    const [removedActivityCodes, setRemovedActivityCodes] = useState<string[]>([]);
    const newActivityNameRef = useRef<HTMLInputElement | null>(null);
    // focus the search input when the dialog opens and ensure scroll is at top
    useEffect(() => {
        if (open) {
            if (DEBUG) console.debug('[CreateCatalogModal] open=true - scheduling focus+resetScroll');
            // give layout a moment to stabilize, then focus top input and reset inner scroll
            const id = setTimeout(() => {
                try {
                    searchInputRef.current?.focus();
                    if (activitiesScrollRef.current) {
                        activitiesScrollRef.current.scrollTop = 0;
                        if (DEBUG) console.debug('[CreateCatalogModal] reset scrollTop -> 0');
                    }
                } catch (err) {
                    if (DEBUG) console.error('[CreateCatalogModal] focus/reset failed', err);
                }
            }, 120);
            return () => clearTimeout(id);
        }
        if (DEBUG) console.debug('[CreateCatalogModal] open=false');
    }, [open]);

    // Scroll indicator logic will be added after `filtered` is declared to avoid use-before-declaration errors.

    // scroll and focus newly added activity when highlightedActivityCode is set
    useEffect(() => {
        if (!highlightedActivityCode) return;
        const el = document.querySelector(`[data-activity="${highlightedActivityCode}"]`) as HTMLElement | null;
        const container = activitiesScrollRef.current;
        if (DEBUG) console.debug('[CreateCatalogModal] highlight changed ->', highlightedActivityCode, { elExists: !!el, containerExists: !!container });
        if (el && container) {
            // calculate relative position and perform smooth scroll only within container
            const elRect = el.getBoundingClientRect();
            const contRect = container.getBoundingClientRect();
            const offset = elRect.top - contRect.top - (contRect.height / 2) + (elRect.height / 2);
            if (DEBUG) console.debug('[CreateCatalogModal] scroll params', { elRect, contRect, offset });
            container.scrollTo({ top: container.scrollTop + offset, behavior: 'smooth' });
        } else if (el) {
            // fallback to global scrollIntoView
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [highlightedActivityCode]);

    // initialize local removed lists from parent props when provided
    useEffect(() => {
        if (Array.isArray(removedGroupsProp)) {
            setRemovedGroups(removedGroupsProp);
        }
    }, [removedGroupsProp]);

    useEffect(() => {
        if (Array.isArray(removedActivityCodesProp)) {
            setRemovedActivityCodes(removedActivityCodesProp);
        }
    }, [removedActivityCodesProp]);

    // propagate local changes back to parent when the parent provided setters
    // Do not propagate updates continuously (avoids update loops).
    // Instead we sync back to parent when the user explicitly closes the modal.

    function handleCloseAndSync() {
        if (typeof setRemovedGroupsProp === 'function') {
            setRemovedGroupsProp(removedGroups);
        }
        if (typeof setRemovedActivityCodesProp === 'function') {
            setRemovedActivityCodesProp(removedActivityCodes);
        }
        onOpenChange(false);
    }

    const allGroupNames = useMemo(() => {
        const names = new Set<string>([...Object.keys(activitiesByGroup || {}), ...customGroups.map(g => g.group)]);
        // exclude removed groups from the selection list
        removedGroups.forEach(r => names.delete(r));
        return Array.from(names);
    }, [activitiesByGroup, customGroups, removedGroups]);

    const filtered = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) {
            // build a shallow copy but exclude removed groups/activities
            const outAll: Record<string, Activity[]> = {};
            Object.entries(activitiesByGroup).forEach(([g, items]) => {
                if (removedGroups.includes(g)) return;
                const filteredItems = (items || []).filter(a => !removedActivityCodes.includes(a.activity_code));
                if (filteredItems.length) outAll[g] = filteredItems;
            });
            // merge custom groups into the existing map (do not overwrite standard activities)
            customGroups.forEach(g => {
                if (removedGroups.includes(g.group)) return;
                const filteredItems = (g.activities || []).filter(a => !removedActivityCodes.includes(a.activity_code));
                if (!filteredItems.length) return;
                const existing = outAll[g.group] || [];
                const combined = [...existing, ...filteredItems].filter((v, i, arr) => arr.findIndex(x => x.activity_code === v.activity_code) === i);
                outAll[g.group] = combined;
            });
            return outAll;
        }

        const out: Record<string, Activity[]> = {};
        Object.entries(activitiesByGroup).forEach(([g, items]) => {
            if (removedGroups.includes(g)) return;
            const f = items.filter(a => (a.display_name.toLowerCase().includes(q) || a.activity_code.toLowerCase().includes(q)) && !removedActivityCodes.includes(a.activity_code));
            if (f.length) out[g] = f;
        });
        // include custom groups matching the search (merge with existing group if present)
        customGroups.forEach(g => {
            if (removedGroups.includes(g.group)) return;
            const f = (g.activities || []).filter(a => (a.display_name.toLowerCase().includes(q) || a.activity_code.toLowerCase().includes(q)) && !removedActivityCodes.includes(a.activity_code));
            if (!f.length) return;
            const existing = out[g.group] || [];
            const combined = [...existing, ...f].filter((v, i, arr) => arr.findIndex(x => x.activity_code === v.activity_code) === i);
            out[g.group] = combined;
        });
        return out;
    }, [activitiesByGroup, searchTerm, customGroups, removedGroups, removedActivityCodes]);

    // Update top/bottom gradient visibility based on scroll position and content size.
    // This effect runs after `filtered` is computed so we can observe the actual content.
    useEffect(() => {
        const el = activitiesScrollRef.current;
        if (!el) {
            setShowTopGradient(false);
            setShowBottomGradient(false);
            return;
        }

        const update = () => {
            const { scrollTop, scrollHeight, clientHeight } = el;
            setShowTopGradient(scrollTop > 4);
            setShowBottomGradient(scrollTop + clientHeight < scrollHeight - 4);
        };

        update();

        const ro = new ResizeObserver(() => update());
        ro.observe(el);
        el.addEventListener('scroll', update, { passive: true });

        return () => {
            el.removeEventListener('scroll', update);
            ro.disconnect();
        };
    }, [filtered]);

    function toggleSelectAllInGroup(group: string, select: boolean) {
        if (removedGroups.includes(group)) return;
        const stdCodes = (activitiesByGroup[group] || []).map(a => a.activity_code).filter(c => !removedActivityCodes.includes(c));
        const customCodes = (customGroups.find(g => g.group === group)?.activities || []).map(a => a.activity_code).filter(c => !removedActivityCodes.includes(c));
        const codes = stdCodes.concat(customCodes);
        if (select) {
            const next = Array.from(new Set([...(selectedActivityCodes || []), ...codes]));
            setSelectedActivityCodes(next);
        } else {
            const next = (selectedActivityCodes || []).filter(c => !codes.includes(c));
            setSelectedActivityCodes(next);
        }
    }

    function handleCreateGroup() {
        const name = newGroupName.trim();
        if (!name) { toast({ title: 'Nome gruppo vuoto', variant: 'destructive' }); return; }
        if (allGroupNames.includes(name)) { toast({ title: 'Group già esistente', variant: 'destructive' }); return; }
        setCustomGroups([...(customGroups || []), { group: name, activities: [] }]);
        setNewGroupName('');
        toast({ title: 'Gruppo creato' });
        setNewActivityGroup(name);
    }

    function handleDeleteGroup(groupName: string) {
        // Soft-hide the group in this dialog only; do NOT permanently delete from catalog or pass deletion to child requirements
        if (!removedGroups.includes(groupName)) setRemovedGroups([...removedGroups, groupName]);
        // gather all codes that were in this group (both std and custom)
        const stdCodes = (activitiesByGroup[groupName] || []).map(a => a.activity_code);
        const customCodes = (customGroups.find(g => g.group === groupName)?.activities || []).map(a => a.activity_code);
        const removedCodes = stdCodes.concat(customCodes);
        const nextSelected = (selectedActivityCodes || []).filter(c => !removedCodes.includes(c));
        setSelectedActivityCodes(nextSelected);
        toast({ title: 'Gruppo nascosto' });
    }

    function handleAddActivity() {
        const name = newActivityName.trim();
        if (!name) { toast({ title: 'Nome attività vuoto', variant: 'destructive' }); return; }
        const days = newActivityDays === '' ? 0 : Number(newActivityDays);
        if (isNaN(days) || days < 0) { toast({ title: 'Giorni non validi', variant: 'destructive' }); return; }
        // Require the user to explicitly select a group when adding an activity
        if (!newActivityGroup) { toast({ title: 'Seleziona un gruppo per l\'attività', variant: 'destructive' }); return; }
        const group = newActivityGroup;
        // If the user selected a standard group (not present in customGroups),
        // create a custom group automatically so the new activity is stored with custom groups
        // and visible immediately in the dialog.

        const code = `CUST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const activity: Activity = { activity_code: code, display_name: name, driver_group: group, base_days: days, helper_short: '', helper_long: '', status: 'Active' };
        {
            const copy = [...(customGroups || [])];
            const idx = copy.findIndex(x => x.group === group);
            if (idx === -1) {
                // If the group isn't already a custom group, create it now so the new activity is visible
                copy.push({ group, activities: [activity] });
                toast({ title: `Gruppo '${group}' creato e attività aggiunta` });
            } else {
                // replace the group object with a new one containing the appended activity
                const old = copy[idx];
                const nextGroup = { ...old, activities: [...(old.activities || []), activity] };
                copy[idx] = nextGroup;
                toast({ title: 'Attività aggiunta' });
            }
            setCustomGroups(copy);
        }
        setSelectedActivityCodes(Array.from(new Set([...(selectedActivityCodes || []), code])));
        setNewActivityName(''); setNewActivityDays('');
        // highlight and scroll to the newly added activity
        setHighlightedActivityCode(code);
        setTimeout(() => setHighlightedActivityCode(''), 2200);
    }

    function handleDeleteActivity(activityCode: string) {
        // Soft-hide the activity in this dialog only; don't remove permanently from the global catalog
        if (!removedActivityCodes.includes(activityCode)) setRemovedActivityCodes([...removedActivityCodes, activityCode]);
        setSelectedActivityCodes((selectedActivityCodes || []).filter(c => c !== activityCode));
        toast({ title: 'Attività nascosta' });
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl w-[95vw] h-[95vh] p-3">
                <DialogHeader>
                    <DialogTitle>Personalizza catalogo attività</DialogTitle>
                </DialogHeader>

                <Card className="flex flex-col h-full overflow-hidden">
                    <CardContent className="px-3 pt-2 pb-3 space-y-3 flex flex-col h-full">
                        {/* Scrollable main area: search, list of groups + add-group/form */}
                        <div ref={activitiesScrollRef} className="relative flex-1 overflow-y-auto space-y-3 pb-4">
                            <div>
                                <Input
                                    ref={searchInputRef}
                                    className="w-full h-9 text-sm"
                                    placeholder="Cerca attività..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            {/* Visual scroll indicators (top/bottom) - subtle gradients to hint scrollability */}
                            <div
                                aria-hidden
                                className={`pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-white/70 to-transparent dark:from-black/70 transition-opacity duration-200 ${showTopGradient ? 'opacity-100' : 'opacity-0'}`}
                            />
                            <div
                                aria-hidden
                                className={`pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-white/70 to-transparent dark:from-black/70 transition-opacity duration-200 ${showBottomGradient ? 'opacity-100' : 'opacity-0'}`}
                            />

                            {/* Group and activity add/create UI: place the new-group + add-activity form right after search for quick access */}
                            <div className="border-t pt-3">
                                <div className="grid sm:grid-cols-4 gap-2 items-end">
                                    <Input
                                        className="w-full h-9 text-sm sm:col-span-3"
                                        placeholder="Nome nuovo gruppo"
                                        value={newGroupName}
                                        onChange={(e) => setNewGroupName(e.target.value)}
                                    />
                                    <Button
                                        type="button"
                                        size="sm"
                                        className="h-8 text-xs w-full sm:w-auto"
                                        onClick={handleCreateGroup}
                                    >
                                        Crea gruppo
                                    </Button>
                                </div>

                                <form onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); handleAddActivity(); }} className="mt-4">
                                    <div className="grid sm:grid-cols-4 gap-2 items-end">
                                        <Input
                                            ref={newActivityNameRef}
                                            id="new-activity-name"
                                            className="w-full h-9 text-sm"
                                            placeholder="Nome attività"
                                            value={newActivityName}
                                            onChange={(e) => setNewActivityName(e.target.value)}
                                            aria-label="Nome attività"
                                        />
                                        <Input
                                            id="new-activity-days"
                                            className="w-full h-9 text-sm"
                                            placeholder="Giorni base"
                                            value={newActivityDays}
                                            onChange={(e) => setNewActivityDays(e.target.value)}
                                            aria-label="Giorni base"
                                            inputMode="numeric"
                                        />
                                        <Select value={newActivityGroup || ''} onValueChange={(v) => setNewActivityGroup(v)}>
                                            <SelectTrigger className="w-full h-9 text-sm" aria-label="Seleziona gruppo attività">
                                                <SelectValue placeholder="Seleziona gruppo..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {allGroupNames.map(g => (
                                                    <SelectItem key={g} value={g}>{g}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Button type="button" size="sm" className="h-8 text-xs w-full sm:w-auto" disabled={!newActivityName.trim() || (newActivityDays !== '' && Number(newActivityDays) < 0)} onClick={(e) => { e.stopPropagation(); handleAddActivity(); }}>
                                            Aggiungi attività
                                        </Button>
                                    </div>
                                    <div className="mt-2">
                                        {newActivityDays !== '' && Number(newActivityDays) < 0 && (
                                            <p className="text-xs text-red-600">Inserisci un valore di giorni valido (&gt;= 0)</p>
                                        )}
                                    </div>
                                </form>
                            </div>

                            {/* subtle separator between the add form and the groups list */}
                            <div aria-hidden className="my-3 border-b border-muted-foreground/10" />

                            {Object.entries(filtered).map(([group, items]) => (
                                <div key={group} className="border rounded-lg p-2 bg-accent/10 relative overflow-visible">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <strong className="text-[11px] font-medium text-foreground">{group}</strong>
                                            <Badge variant="outline" className="text-[9px] px-2 py-0 h-4">{items.length}</Badge>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button type="button" size="sm" variant="ghost" className="p-0 h-7 w-7" onClick={() => toggleSelectAllInGroup(group, true)} title={`Seleziona tutte le attività in ${group}`} aria-label={`Seleziona tutte le attività in ${group}`}>
                                                <CheckSquare className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                            {/* allow hiding the group (soft-delete) for both standard and custom groups */}
                                            <Button type="button" size="sm" variant={customGroups.find(g => g.group === group) ? 'destructive' : 'ghost'} className="p-0 h-7 w-7" onClick={() => handleDeleteGroup(group)} title={`Nascondi gruppo ${group}`} aria-label={`Nascondi gruppo ${group}`}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="mt-2 space-y-1">
                                        {items.map(a => (
                                            <div
                                                key={a.activity_code}
                                                data-activity={a.activity_code}
                                                style={highlightedActivityCode === a.activity_code ? { boxShadow: '0 6px 18px rgba(2,6,23,0.06), 0 0 0 3px rgba(16,185,129,0.16)' } : undefined}
                                                className={`${highlightedActivityCode === a.activity_code ? 'scale-101' : 'bg-accent/10'} transition-all duration-300 ease-in-out transform flex items-center justify-between rounded-lg px-2 py-1`}
                                            >
                                                <div className="flex items-center gap-2 w-full">
                                                    <Checkbox checked={selectedActivityCodes.includes(a.activity_code)} onCheckedChange={(v) => {
                                                        setSelectedActivityCodes(v ? Array.from(new Set([...(selectedActivityCodes || []), a.activity_code])) : (selectedActivityCodes || []).filter(c => c !== a.activity_code));
                                                    }} />
                                                    <Badge variant="secondary" className="text-[9px] px-2 py-0 h-4">{customGroups.find(g => g.activities.some(act => act.activity_code === a.activity_code)) ? 'Custom' : 'Std'}</Badge>
                                                    <div className="text-[11px] font-medium">{a.display_name} <span className="text-xs text-muted-foreground">({a.base_days}d)</span></div>
                                                    <div className="ml-auto flex items-center gap-2">
                                                        {/* allow hiding any activity (soft-delete) for the list; this doesn't permanently remove it from global catalog */}
                                                        <Button type="button" size="sm" variant="ghost" className="text-red-600 p-0 h-7 w-7" onClick={() => handleDeleteActivity(a.activity_code)} aria-label={`Nascondi ${a.display_name}`}>
                                                            <X className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}


                        </div>

                        {/* Footer: outside the scrollable area so it's always visible */}
                        <div className="flex items-center justify-between bg-background/50 pt-2 sticky bottom-0 z-40">
                            <label className="flex items-center gap-2">
                                <Checkbox checked={saveCatalogOnCreate} onCheckedChange={(v) => setSaveCatalogOnCreate(Boolean(v))} />
                                <span className="text-sm text-foreground">Salva come catalogo per questa lista</span>
                            </label>
                            <div className="flex gap-2">
                                <Button type="button" className="h-8 text-xs" onClick={handleCloseAndSync}>Chiudi</Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </DialogContent>
        </Dialog>
    );
}

export default CreateCatalogModal;
