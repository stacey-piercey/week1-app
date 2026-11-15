import { useCallback, useState } from 'react';
import PageTitle from './components/PageTitle';
import SaveStatus from './components/SaveStatus';
import Sidebar from './components/Sidebar';
import { useAutosave } from './hooks/useAutosave';
import { usePages } from './hooks/usePages';

export default function App() {
  const { pages, selectedId, loading, addPage, selectPage, renamePage } = usePages();
  const selected = pages.find((p) => p.id === selectedId);
  const autosave = useAutosave();
  const { flush, schedule } = autosave;

  // The page just made with "+ New page". Only its title gets autofocus,
  // so opening an existing page leaves focus where it was.
  const [newPageId, setNewPageId] = useState<string | null>(null);

  // Leaving a page saves its unsaved edits straight away.
  const handleAdd = useCallback(async () => {
    void flush();
    setNewPageId(await addPage());
  }, [addPage, flush]);

  const handleSelect = useCallback(
    (id: string) => {
      void flush();
      setNewPageId(null);
      selectPage(id);
    },
    [selectPage, flush],
  );

  const handleTitleChange = useCallback(
    (id: string, title: string) => {
      renamePage(id, title); // updates the sidebar at once
      schedule(id, { title }); // saves 500 ms after typing stops
    },
    [renamePage, schedule],
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
            <>
              <SaveStatus status={autosave.status} />
              <PageTitle
                value={selected.title}
                onChange={(title) => handleTitleChange(selected.id, title)}
                // Step 5 makes Enter move focus to the first block.
                onEnter={() => {}}
                autoFocus={selected.id === newPageId}
              />
            </>
          ) : (
            <p className="empty-hint">Create a page to get started.</p>
          )}
        </div>
      </main>
    </div>
  );
}
