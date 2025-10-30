import React, { useState, useEffect } from 'react';
import { FileDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Requirement, ExportRow } from '../types';
import { getRequirementsByListId, getLists, generateExportData, exportToCSV, downloadCSV, getLatestEstimate } from '../lib/storage';

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
    const list = getLists().find(l => l.list_id === listId);
    setListName(list?.name || 'Lista');
    
    const reqs = getRequirementsByListId(listId);
    setRequirements(reqs);
    setSelectedReqIds(reqs.map(r => r.req_id));
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

  const handleExport = () => {
    const exportData = generateExportData(listId, selectedReqIds);
    const csvContent = exportToCSV(exportData);
    const filename = `${listName.replace(/[^a-zA-Z0-9]/g, '_')}_export_${new Date().toISOString().split('T')[0]}.csv`;
    
    downloadCSV(filename, csvContent);
    onClose();
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-800';
      case 'Med': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'Proposed': return 'bg-blue-100 text-blue-800';
      case 'Selected': return 'bg-purple-100 text-purple-800';
      case 'Scheduled': return 'bg-orange-100 text-orange-800';
      case 'Done': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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
              const latestEstimate = getLatestEstimate(requirement.req_id);
              
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
                              {requirement.req_id} • {requirement.estimator}
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
                  
                  {latestEstimate && (
                    <CardContent className="pt-0">
                      <div className="bg-muted p-3 rounded-lg">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-muted-foreground">Scenario</p>
                            <p className="font-medium">{latestEstimate.scenario}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Driver</p>
                            <p className="font-medium text-xs">
                              {latestEstimate.complexity}/{latestEstimate.environments}/{latestEstimate.reuse}/{latestEstimate.stakeholders}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Subtotal</p>
                            <p className="font-medium">{latestEstimate.subtotal_days}gg</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Totale</p>
                            <p className="font-semibold text-primary">{latestEstimate.total_days}gg</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  )}
                  
                  {!latestEstimate && (
                    <CardContent className="pt-0">
                      <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
                        <p className="text-sm text-yellow-800">Nessuna stima disponibile</p>
                      </div>
                    </CardContent>
                  )}
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