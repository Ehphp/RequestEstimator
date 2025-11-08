import React, { useState, useEffect } from 'react';
import { FileDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Requirement } from '../types';
import { getRequirementsByListId, getLists, generateExportData, exportToCSV, downloadCSV } from '../lib/storage';
import { getPriorityColor, getStateColor } from '@/lib/utils';

interface ExportDialogProps {
  listId: string;
  onClose: () => void;
}

export function ExportDialog({ listId, onClose }: ExportDialogProps) {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [selectedReqIds, setSelectedReqIds] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(true);
  const [listName, setListName] = useState('');

  useEffect(() => {
    const loadData = async () => {
      const lists = await getLists();
      const list = lists.find(l => l.list_id === listId);
      setListName(list?.name || 'Lista');

      const reqs = await getRequirementsByListId(listId);
      setRequirements(reqs);
      setSelectedReqIds(reqs.map(r => r.req_id));
    };
    loadData();
  }, [listId]);

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedReqIds(requirements.map(r => r.req_id));
    } else {
      setSelectedReqIds([]);
    }
  };

  const handleSelectRequirement = (reqId: string, checked: boolean) => {
    if (checked) {
      setSelectedReqIds([...selectedReqIds, reqId]);
    } else {
      setSelectedReqIds(selectedReqIds.filter(id => id !== reqId));
    }
  };

  const handleExport = async () => {
    const exportData = await generateExportData(listId, selectedReqIds);
    const csvContent = exportToCSV(exportData);
    const filename = `${listName.replace(/[^a-zA-Z0-9]/g, '_')}_export_${new Date().toISOString().split('T')[0]}.csv`;

    downloadCSV(filename, csvContent);
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Export Semplice - {listName}
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="select-all"
                checked={selectAll}
                onCheckedChange={handleSelectAll}
              />
              <label htmlFor="select-all" className="font-medium">
                Seleziona tutti ({requirements.length} requisiti)
              </label>
            </div>
            <p className="text-sm text-muted-foreground">
              {selectedReqIds.length} requisiti selezionati
            </p>
          </div>

          <div className="space-y-3">
            {requirements.map((requirement) => {
              const isSelected = selectedReqIds.includes(requirement.req_id);

              return (
                <Card key={requirement.req_id} className={`transition-all ${isSelected ? 'ring-2 ring-primary' : ''}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        id={requirement.req_id}
                        checked={isSelected}
                        onCheckedChange={(checked) => handleSelectRequirement(requirement.req_id, !!checked)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-base">{requirement.title}</CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {requirement.req_id} • {requirement.business_owner}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Badge className={getPriorityColor(requirement.priority)}>
                              {requirement.priority}
                            </Badge>
                            <Badge className={getStateColor(requirement.state)}>
                              {requirement.state}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="border-t pt-4 flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            <p>Campi export: List, Req ID, Title, Priority, Scenario, Driver (4), Subtotal, Contingency %, Total, Estimator, Last Estimated On, State</p>
            <p className="mt-1">Formato: CSV con encoding UTF-8</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button onClick={handleExport} disabled={selectedReqIds.length === 0}>
              <FileDown className="h-4 w-4 mr-2" />
              Esporta CSV ({selectedReqIds.length})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}