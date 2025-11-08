import React, { useState } from 'react';
import { ArrowLeft, Plus, Edit, Calendar, User, Tag, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { List, Requirement } from '../types';
import { saveRequirement, generateId } from '../lib/storage';
import { getPriorityColor, getStateColor } from '@/lib/utils';
import { logger } from '@/lib/logger';

interface RequirementsListProps {
  list: List;
  requirements: Requirement[];
  onBack: () => void;
  onSelectRequirement: (requirement: Requirement) => void;
  onRequirementsChange: () => void;
}

type RequirementFormState = {
  title: string;
  description: string;
  business_owner: string;
  priority: Requirement['priority'];
  state: Requirement['state'];
  labels: string;
};

export function RequirementsList({
  list,
  requirements,
  onBack,
  onSelectRequirement,
  onRequirementsChange
}: RequirementsListProps) {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newRequirement, setNewRequirement] = useState<RequirementFormState>({
    title: '',
    description: '',
    business_owner: '',
    priority: 'Med' as const,
    state: 'Proposed' as const,
    labels: ''
  });

  const handleAddRequirement = async () => {
    try {
      const requirement: Requirement = {
        req_id: generateId('REQ'),
        list_id: list.list_id,
        title: newRequirement.title,
        description: newRequirement.description,
        business_owner: newRequirement.business_owner,
        priority: newRequirement.priority,
        state: newRequirement.state,
        labels: newRequirement.labels,
        created_on: new Date().toISOString(),
        last_estimated_on: undefined
      };

      await saveRequirement(requirement);

      // Reset form
      setNewRequirement({
        title: '',
        description: '',
        business_owner: '',
        priority: 'Med',
        state: 'Proposed',
        labels: ''
      });

      setIsAddDialogOpen(false);
      onRequirementsChange();

      toast({
        title: 'Requisito salvato',
        description: 'Il requisito è stato aggiunto con successo',
      });
    } catch (error) {
      logger.error('Error adding requirement:', error);
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: 'Impossibile salvare il requisito. Riprova.',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Torna alle Liste
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{list.name}</h1>
          <p className="text-muted-foreground">{list.description}</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nuovo Requisito
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Aggiungi Nuovo Requisito</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Titolo</Label>
                <Input
                  id="title"
                  value={newRequirement.title}
                  onChange={(e) => setNewRequirement({ ...newRequirement, title: e.target.value })}
                  placeholder="Titolo del requisito"
                />
              </div>

              <div>
                <Label htmlFor="description">Descrizione</Label>
                <Textarea
                  id="description"
                  value={newRequirement.description}
                  onChange={(e) => setNewRequirement({ ...newRequirement, description: e.target.value })}
                  placeholder="Descrizione dettagliata del requisito"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="business_owner">Business Owner</Label>
                  <Input
                    id="business_owner"
                    value={newRequirement.business_owner}
                    onChange={(e) => setNewRequirement({ ...newRequirement, business_owner: e.target.value })}
                    placeholder="email@company.com"
                  />
                </div>

                <div>
                  <Label htmlFor="labels">Etichette</Label>
                  <Input
                    id="labels"
                    value={newRequirement.labels}
                    onChange={(e) => setNewRequirement({ ...newRequirement, labels: e.target.value })}
                    placeholder="tag1,tag2,tag3"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="priority">Priorità</Label>
                  <Select
                    value={newRequirement.priority}
                    onValueChange={(value: Requirement['priority']) =>
                      setNewRequirement({ ...newRequirement, priority: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="High">Alta</SelectItem>
                      <SelectItem value="Med">Media</SelectItem>
                      <SelectItem value="Low">Bassa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="state">Stato</Label>
                  <Select
                    value={newRequirement.state}
                    onValueChange={(value: Requirement['state']) =>
                      setNewRequirement({ ...newRequirement, state: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Proposed">Proposto</SelectItem>
                      <SelectItem value="Selected">Selezionato</SelectItem>
                      <SelectItem value="Scheduled">Pianificato</SelectItem>
                      <SelectItem value="Done">Completato</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Annulla
                </Button>
                <Button onClick={handleAddRequirement} disabled={!newRequirement.title.trim()}>
                  Salva Requisito
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {requirements.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <BarChart3 className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Nessun requisito trovato</h3>
            <p className="text-gray-600 mb-6">
              Aggiungi il primo requisito per iniziare a creare stime
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Aggiungi Primo Requisito
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {requirements.map((requirement) => (
            <Card
              key={requirement.req_id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onSelectRequirement(requirement)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2">{requirement.title}</CardTitle>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {requirement.description}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Badge className={`${getPriorityColor(requirement.priority)} text-xs`}>
                      {requirement.priority}
                    </Badge>
                    <Badge className={`${getStateColor(requirement.state)} text-xs`}>
                      {requirement.state}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {requirement.business_owner}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(requirement.created_on).toLocaleDateString('it-IT')}
                  </div>
                  {requirement.last_estimated_on && (
                    <div className="flex items-center gap-1">
                      <BarChart3 className="h-3 w-3" />
                      Ultima stima: {new Date(requirement.last_estimated_on).toLocaleDateString('it-IT')}
                    </div>
                  )}
                  {requirement.labels && (
                    <div className="flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      {requirement.labels.split(',').slice(0, 3).map((label, index) => (
                        <Badge key={index} variant="outline" className="text-xs px-1 py-0">
                          {label.trim()}
                        </Badge>
                      ))}
                      {requirement.labels.split(',').length > 3 && (
                        <span className="text-xs">+{requirement.labels.split(',').length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
