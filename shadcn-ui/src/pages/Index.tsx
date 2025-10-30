import React, { useState } from 'react';
import { ListsView } from '../components/ListsView';
import { RequirementsView } from '../components/RequirementsView';

export default function Index() {
  const [currentView, setCurrentView] = useState<'lists' | 'requirements'>('lists');
  const [selectedListId, setSelectedListId] = useState<string | null>(null);

  const handleSelectList = (listId: string) => {
    setSelectedListId(listId);
    setCurrentView('requirements');
  };

  const handleBackToLists = () => {
    setCurrentView('lists');
    setSelectedListId(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        {currentView === 'lists' && (
          <ListsView onSelectList={handleSelectList} />
        )}
        
        {currentView === 'requirements' && selectedListId && (
          <RequirementsView 
            listId={selectedListId} 
            onBack={handleBackToLists} 
          />
        )}
      </div>
    </div>
  );
}