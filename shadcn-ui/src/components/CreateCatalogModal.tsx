import { useMemo, useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LayoutGrid } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
}: Props) {
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [newGroupName, setNewGroupName] = useState('');
    const [newActivityName, setNewActivityName] = useState('');
    const [newActivityDays, setNewActivityDays] = useState('');
    const [newActivityGroup, setNewActivityGroup] = useState('');
    const [highlightedActivityCode, setHighlightedActivityCode] = useState('');
    const newActivityNameRef = useRef<HTMLInputElement | null>(null);
    // focus the name input when the dialog opens for faster entry
    useEffect(() => {
        if (open) {
            setTimeout(() => newActivityNameRef.current?.focus(), 80);
        }
    }, [open]);

    // scroll and focus newly added activity when highlightedActivityCode is set
    useEffect(() => {
        if (!highlightedActivityCode) return;
        const el = document.querySelector(`[data-activity="${highlightedActivityCode}"]`) as HTMLElement | null;
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [highlightedActivityCode]);

    const allGroupNames = useMemo(() => {
        const names = new Set<string>([...Object.keys(activitiesByGroup || {}), ...customGroups.map(g => g.group)]);
        return Array.from(names);
    }, [activitiesByGroup, customGroups]);

    const filtered = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return activitiesByGroup;
        const out: Record<string, Activity[]> = {};
        Object.entries(activitiesByGroup).forEach(([g, items]) => {
            const f = items.filter(a => a.display_name.toLowerCase().includes(q) || a.activity_code.toLowerCase().includes(q));
            if (f.length) out[g] = f;
        });
        // include custom groups matching the search
        customGroups.forEach(g => {
            const f = (g.activities || []).filter(a => a.display_name.toLowerCase().includes(q) || a.activity_code.toLowerCase().includes(q));
            if (f.length) out[g.group] = f;
        });
        return out;
    }, [activitiesByGroup, searchTerm, customGroups]);

    function toggleSelectAllInGroup(group: string, select: boolean) {
        const codes = (activitiesByGroup[group] || []).map(a => a.activity_code).concat((customGroups.find(g => g.group === group)?.activities || []).map(a => a.activity_code));
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
        // remove group and any activities within it from customGroups
        const remaining = (customGroups || []).filter(g => g.group !== groupName);
        // also remove any selected activity codes that belonged to the deleted group
        const removedCodes = (customGroups.find(g => g.group === groupName)?.activities || []).map(a => a.activity_code);
        const nextSelected = (selectedActivityCodes || []).filter(c => !removedCodes.includes(c));
        setCustomGroups(remaining);
        setSelectedActivityCodes(nextSelected);
        toast({ title: 'Gruppo rimosso' });
    }

    function handleAddActivity() {
        const name = newActivityName.trim();
        if (!name) { toast({ title: 'Nome attività vuoto', variant: 'destructive' }); return; }
        const days = newActivityDays === '' ? 0 : Number(newActivityDays);
        if (isNaN(days) || days < 0) { toast({ title: 'Giorni non validi', variant: 'destructive' }); return; }
        // Require the user to explicitly select a group when adding an activity
        if (!newActivityGroup) { toast({ title: 'Seleziona un gruppo per l\'attività', variant: 'destructive' }); return; }
        const group = newActivityGroup;
        // Do not implicitly create a new custom group when adding an activity.
        // The user must click 'Crea gruppo' to create a new group first.
        const isCustomGroup = (customGroups || []).some(g => g.group === group);
        if (!isCustomGroup) { toast({ title: 'Crea prima il gruppo usando il bottone "Crea gruppo"', variant: 'destructive' }); return; }
        const code = `CUST-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const activity: Activity = { activity_code: code, display_name: name, driver_group: group, base_days: days, helper_short: '', helper_long: '', status: 'Active' };
        {
            const copy = [...(customGroups || [])];
            const idx = copy.findIndex(x => x.group === group);
            if (idx === -1) copy.push({ group, activities: [activity] });
            else copy[idx].activities.push(activity);
            setCustomGroups(copy);
        }
        setSelectedActivityCodes(Array.from(new Set([...(selectedActivityCodes || []), code])));
        setNewActivityName(''); setNewActivityDays('');
        toast({ title: 'Attività aggiunta' });
        // highlight and scroll to the newly added activity
        setHighlightedActivityCode(code);
        setTimeout(() => setHighlightedActivityCode(''), 2200);
    }

    function handleDeleteActivity(groupName: string, activityCode: string) {
        const copy = [...(customGroups || [])];
        const idx = copy.findIndex(x => x.group === groupName);
        if (idx === -1) return;
        copy[idx].activities = (copy[idx].activities || []).filter(a => a.activity_code !== activityCode);
        // if group's activities are empty and the group wasn't originally present in activitiesByGroup, keep empty group (user may want it)
        setCustomGroups(copy);
        // clean selection
        setSelectedActivityCodes((selectedActivityCodes || []).filter(c => c !== activityCode));
        toast({ title: 'Attività rimossa' });
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Personalizza catalogo attività</DialogTitle>
                </DialogHeader>

                <Card className="flex flex-col overflow-hidden">
                    <CardHeader className="pb-1.5 pt-2 px-3 shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                                <CardTitle className="text-xs font-semibold">Personalizza catalogo attività</CardTitle>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="overflow-y-auto px-2 pb-2">
                        <div>
                            <Input
                                className="w-full text-sm"
                                placeholder="Cerca attività..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {Object.entries(filtered).map(([group, items]) => (
                                <div key={group} className="border rounded px-2 py-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <strong className="text-[11px]">{group}</strong>
                                            <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button type="button" size="sm" className="text-xs" onClick={() => toggleSelectAllInGroup(group, true)}>Seleziona tutto</Button>
                                            {/* show delete group button only for custom groups */}
                                            {customGroups.find(g => g.group === group) && (
                                                <Button type="button" size="sm" variant="destructive" className="text-xs" onClick={() => handleDeleteGroup(group)}>Elimina gruppo</Button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="mt-2 space-y-1">
                                        {items.map(a => (
                                            <div key={a.activity_code} data-activity={a.activity_code} className={`${highlightedActivityCode === a.activity_code ? 'ring-2 ring-emerald-400/60 shadow-md scale-101' : 'bg-accent/10'} transition-all duration-300 ease-in-out transform flex items-center justify-between rounded px-2 py-1`}>
                                                <div className="flex items-center gap-2 w-full">
                                                    <Checkbox checked={selectedActivityCodes.includes(a.activity_code)} onCheckedChange={(v) => {
                                                        setSelectedActivityCodes(v ? Array.from(new Set([...(selectedActivityCodes || []), a.activity_code])) : (selectedActivityCodes || []).filter(c => c !== a.activity_code));
                                                    }} />
                                                    <Badge variant="secondary" className="text-[9px] px-1 py-0 h-5">{customGroups.find(g => g.activities.some(act => act.activity_code === a.activity_code)) ? 'Custom' : 'Std'}</Badge>
                                                    <div className="text-[11px] font-medium">{a.display_name} <span className="text-xs text-muted-foreground">({a.base_days}d)</span></div>
                                                    <div className="ml-auto flex items-center gap-2">
                                                        {customGroups.find(g => g.activities.some(act => act.activity_code === a.activity_code)) && (
                                                            <Button type="button" size="sm" variant="ghost" className="text-red-600 text-xs" onClick={() => handleDeleteActivity(group, a.activity_code)}>✕</Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="border-t pt-3">
                            <div className="grid sm:grid-cols-4 gap-2 items-end">
                                <Input
                                    className="w-full text-sm sm:col-span-3"
                                    placeholder="Nome nuovo gruppo"
                                    value={newGroupName}
                                    onChange={(e) => setNewGroupName(e.target.value)}
                                />
                                <Button
                                    type="button"
                                    size="sm"
                                    className="w-full sm:w-auto text-sm"
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
                                        className="w-full text-sm"
                                        placeholder="Nome attività"
                                        value={newActivityName}
                                        onChange={(e) => setNewActivityName(e.target.value)}
                                        aria-label="Nome attività"
                                    />
                                    <Input
                                        id="new-activity-days"
                                        className="w-full text-sm"
                                        placeholder="Giorni base"
                                        value={newActivityDays}
                                        onChange={(e) => setNewActivityDays(e.target.value)}
                                        aria-label="Giorni base"
                                        inputMode="numeric"
                                    />
                                    <Select value={newActivityGroup || ''} onValueChange={(v) => setNewActivityGroup(v)}>
                                        <SelectTrigger className="w-full text-sm" aria-label="Seleziona gruppo attività">
                                            <SelectValue placeholder="Seleziona gruppo..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {allGroupNames.map(g => (
                                                <SelectItem key={g} value={g}>{g}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button type="button" size="sm" className="w-full sm:w-auto text-sm" disabled={!newActivityName.trim() || (newActivityDays !== '' && Number(newActivityDays) < 0)} onClick={(e) => { e.stopPropagation(); handleAddActivity(); }}>
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

                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2">
                                <Checkbox checked={saveCatalogOnCreate} onCheckedChange={(v) => setSaveCatalogOnCreate(Boolean(v))} />
                                <span className="text-sm">Salva come catalogo per questa lista</span>
                            </label>
                            <div className="flex gap-2">
                                <Button type="button" className="h-8 text-xs" onClick={() => onOpenChange(false)}>Chiudi</Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </DialogContent>
        </Dialog>
    );
}

export default CreateCatalogModal;
