import { useState, useEffect } from 'react';
import { Plus, FileText, Calendar, User, Tag, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ThemeToggle } from '@/components/ThemeToggle';
import { List, Requirement } from '../types';
import {
  getLists,
  getRequirementsByListId,
  generateId,
  saveList,
  deleteList,
} from '../lib/storage';
import { logger } from '@/lib/logger';
import { RequirementsList } from '../components/RequirementsList';
import { EstimateEditor } from '../components/EstimateEditor';

export default function Index() {
  const [lists, setLists] = useState<List[]>([]);
  const [selectedList, setSelectedList] = useState<List | null>(null);
  const [selectedRequirement, setSelectedRequirement] = useState<Requirement | null>(null);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [listPendingDeletion, setListPendingDeletion] = useState<List | null>(null);
  const [deleteMetadataLoading, setDeleteMetadataLoading] = useState(false);
  const [pendingRequirementCount, setPendingRequirementCount] = useState<number | null>(null);
  const [deleteInProgress, setDeleteInProgress] = useState(false);

  useEffect(() => {
    loadLists();
  }, []);

  const loadLists = async (options?: { autoSelectFirst?: boolean }): Promise<List[]> => {
    const { autoSelectFirst = false } = options || {};
    try {
      setLoading(true);
      setError(null);

      const listsData = await getLists();
      setLists(listsData);

      if (autoSelectFirst && listsData.length > 0 && !selectedList) {
        setSelectedList(listsData[0]);
      }

      return listsData;
    } catch (err) {
      logger.error('Error loading lists:', err);
      setError('Errore nel caricamento delle liste. Verifica la connessione a Supabase.');
      return [];
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
      logger.error('Error loading requirements:', err);
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
        preset_key: undefined,
        created_on: new Date().toISOString(),
        created_by: 'current.user@example.com',
        status: 'Active'
      };

      await saveList(newList);
      await loadLists();
      setSelectedList(newList);
    } catch (err) {
      logger.error('Error creating new list:', err);
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

  const openDeleteDialog = async (list: List) => {
    setListPendingDeletion(list);
    setDeleteDialogOpen(true);
    setPendingRequirementCount(null);
    setDeleteMetadataLoading(true);
    try {
      const requirements = await getRequirementsByListId(list.list_id);
      setPendingRequirementCount(requirements.length);
    } catch (err) {
      logger.error('Error counting requirements for list:', err);
      setError('Impossibile recuperare il numero di requisiti associati alla lista selezionata.');
    } finally {
      setDeleteMetadataLoading(false);
    }
  };

  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setListPendingDeletion(null);
    setPendingRequirementCount(null);
    setDeleteMetadataLoading(false);
    setDeleteInProgress(false);
  };

  const handleConfirmDelete = async () => {
    if (!listPendingDeletion) return;
    const deletingSelectedList = selectedList?.list_id === listPendingDeletion.list_id;
    try {
      setDeleteInProgress(true);
      setError(null);
      await deleteList(listPendingDeletion.list_id);
      if (deletingSelectedList) {
        setSelectedRequirement(null);
        setSelectedList(null);
        setRequirements([]);
      }
      await loadLists({ autoSelectFirst: !deletingSelectedList });
      closeDeleteDialog();
    } catch (err) {
      logger.error('Error deleting list:', err);
      setError('Errore durante l\'eliminazione della lista selezionata.');
    } finally {
      setDeleteInProgress(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 dark:from-black dark:via-gray-900 dark:to-gray-950 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-gray-600 dark:text-gray-400" />
          <p className="text-lg text-gray-600 dark:text-gray-400">Caricamento dati da Supabase...</p>
        </div>
      </div>
    );
  }

  if (selectedRequirement && selectedList) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black p-6">
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
      <div className="min-h-screen bg-gray-50 dark:bg-black p-6">
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 dark:from-black dark:via-gray-900 dark:to-gray-950 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-50">Sistema di Stima Requisiti</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Gestisci le tue liste di requisiti e crea stime accurate</p>
            <Badge variant="outline" className="mt-2 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              Connesso a Supabase
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button onClick={handleCreateNewList} size="lg">
              <Plus className="h-5 w-5 mr-2" />
              Nuova Lista
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {lists.length === 0 ? (
          <Card className="text-center py-12 dark:bg-gray-900/50 dark:border-gray-800">
            <CardContent>
              <FileText className="h-16 w-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Nessuna lista trovata</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
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
                className="cursor-pointer hover:shadow-lg dark:hover:shadow-gray-900/50 transition-shadow dark:bg-gray-900/50 dark:border-gray-800"
                onClick={() => handleSelectList(list)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      {list.name}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(event) => {
                        event.stopPropagation();
                        openDeleteDialog(list);
                      }}
                      aria-label={`Elimina ${list.name}`}
                    >
                      <Trash2 className="h-4 w-4 text-red-500 dark:text-red-400" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
                    {list.description}
                  </p>

                  <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-500">
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

        <AlertDialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            if (!open && deleteDialogOpen && !deleteInProgress) {
              closeDeleteDialog();
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Elimina lista</AlertDialogTitle>
              <AlertDialogDescription>
                {listPendingDeletion ? (
                  deleteMetadataLoading ? (
                    'Calcolo del numero di requisiti associati...'
                  ) : (
                    <>
                      La lista{' '}
                      <span className="font-semibold text-foreground">
                        {listPendingDeletion.name}
                      </span>{' '}
                      contiene{' '}
                      <span className="font-semibold text-red-600">
                        {pendingRequirementCount ?? 0}{' '}
                        {pendingRequirementCount === 1 ? 'requisito' : 'requisiti'}
                      </span>
                      . Verranno eliminati anche i dati di stima collegati. L’operazione è irreversibile.
                    </>
                  )
                ) : (
                  'Seleziona una lista da eliminare.'
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteInProgress} onClick={closeDeleteDialog}>
                Annulla
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                disabled={deleteInProgress || deleteMetadataLoading || !listPendingDeletion}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                {deleteInProgress ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Eliminazione...
                  </span>
                ) : (
                  'Elimina definitivamente'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
