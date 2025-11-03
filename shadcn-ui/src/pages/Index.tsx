import React, { useState, useEffect } from 'react';
import { Plus, FileText, Calendar, User, Tag, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { List, Requirement } from '../types';
import { getLists, getRequirementsByListId, generateId, saveList, migrateFromLocalStorage } from '../lib/storage';
import { RequirementsList } from '../components/RequirementsList';
import { EstimateEditor } from '../components/EstimateEditor';

export default function Index() {
  const [lists, setLists] = useState<List[]>([]);
  const [selectedList, setSelectedList] = useState<List | null>(null);
  const [selectedRequirement, setSelectedRequirement] = useState<Requirement | null>(null);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLists();
  }, []);

  const loadLists = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check if this is the first time loading and migrate if needed
      const existingLists = await getLists();
      if (existingLists.length === 0) {
        console.log('No lists found in Supabase, checking for localStorage migration...');
        await migrateFromLocalStorage();
      }
      
      const listsData = await getLists();
      setLists(listsData);
      
      if (listsData.length > 0 && !selectedList) {
        setSelectedList(listsData[0]);
      }
    } catch (err) {
      console.error('Error loading lists:', err);
      setError('Errore nel caricamento delle liste. Verifica la connessione a Supabase.');
    } finally {
      setLoading(false);
    }
  };

  const loadRequirements = async (listId: string) => {
    try {
      setError(null);
      const requirementsData = await getRequirementsByListId(listId);
      setRequirements(requirementsData);
    } catch (err) {
      console.error('Error loading requirements:', err);
      setError('Errore nel caricamento dei requisiti.');
    }
  };

  useEffect(() => {
    if (selectedList) {
      loadRequirements(selectedList.list_id);
    }
  }, [selectedList]);

  const handleCreateNewList = async () => {
    try {
      const newList: List = {
        list_id: generateId('LIST'),
        name: 'Nuova Lista',
        description: 'Descrizione della nuova lista',
        preset_key: null,
        created_on: new Date().toISOString(),
        created_by: 'current.user@example.com',
        status: 'Active'
      };
      
      await saveList(newList);
      await loadLists();
      setSelectedList(newList);
    } catch (err) {
      console.error('Error creating new list:', err);
      setError('Errore nella creazione della nuova lista.');
    }
  };

  const handleSelectList = (list: List) => {
    setSelectedList(list);
    setSelectedRequirement(null);
  };

  const handleSelectRequirement = (requirement: Requirement) => {
    setSelectedRequirement(requirement);
  };

  const handleBackToRequirements = () => {
    setSelectedRequirement(null);
    // Reload requirements to get updated data
    if (selectedList) {
      loadRequirements(selectedList.list_id);
    }
  };

  const handleBackToLists = () => {
    setSelectedList(null);
    setSelectedRequirement(null);
    setRequirements([]);
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

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="flex items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-lg text-gray-600">Caricamento dati da Supabase...</p>
        </div>
      </div>
    );
  }

  if (selectedRequirement && selectedList) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <EstimateEditor
          requirement={selectedRequirement}
          list={selectedList}
          onBack={handleBackToRequirements}
        />
      </div>
    );
  }

  if (selectedList) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <RequirementsList
          list={selectedList}
          requirements={requirements}
          onBack={handleBackToLists}
          onSelectRequirement={handleSelectRequirement}
          onRequirementsChange={() => loadRequirements(selectedList.list_id)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Sistema di Stima Requisiti</h1>
            <p className="text-gray-600 mt-2">Gestisci le tue liste di requisiti e crea stime accurate</p>
            <Badge variant="outline" className="mt-2 bg-green-50 text-green-700 border-green-200">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              Connesso a Supabase
            </Badge>
          </div>
          <Button onClick={handleCreateNewList} size="lg">
            <Plus className="h-5 w-5 mr-2" />
            Nuova Lista
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {lists.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <FileText className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Nessuna lista trovata</h3>
              <p className="text-gray-600 mb-6">
                Crea la tua prima lista di requisiti per iniziare a gestire le stime
              </p>
              <Button onClick={handleCreateNewList}>
                <Plus className="h-4 w-4 mr-2" />
                Crea Prima Lista
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {lists.map((list) => (
              <Card 
                key={list.list_id} 
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => handleSelectList(list)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    {list.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {list.description}
                  </p>
                  
                  <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(list.created_on).toLocaleDateString('it-IT')}
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {list.created_by?.split('@')[0] || 'Unknown'}
                    </div>
                    {list.preset_key && (
                      <div className="flex items-center gap-1">
                        <Tag className="h-3 w-3" />
                        {list.preset_key}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}