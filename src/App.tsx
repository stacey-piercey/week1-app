import { useCallback, useState } from 'react';
import PageTitle from './components/PageTitle';
import Sidebar from './components/Sidebar';
import { usePages } from './hooks/usePages';

export default function App() {
  const { pages, selectedId, loading, addPage, selectPage, renamePage } = usePages();
  const selected = pages.find((p) => p.id === selectedId);

  // The page just made with "+ New page". Only its title gets autofocus,
  // so opening an existing page leaves focus where it was.
  const [newPageId, setNewPageId] = useState<string | null>(null);

  const handleAdd = useCallback(async () => {
    setNewPageId(await addPage());
  }, [addPage]);

  const handleSelect = useCallback(
    (id: string) => {
      setNewPageId(null);
      selectPage(id);
    },
    [selectPage],
  );

  return (
    <div className="app">
      <Sidebar
        pages={pages}
        selectedId={selectedId}
        loading={loading}
        onAdd={handleAdd}
        onSelect={handleSelect}
      />
      <main className="content">
        <div className="content-inner">
          {loading ? null : selected ? (
            <PageTitle
              value={selected.title}
              onChange={(title) => renamePage(selected.id, title)}
              // Step 5 makes Enter move focus to the first block.
              onEnter={() => {}}
              autoFocus={selected.id === newPageId}
            />
          ) : (
            <p className="empty-hint">Create a page to get started.</p>
          )}
        </div>
      </main>
    </div>
  );
}
