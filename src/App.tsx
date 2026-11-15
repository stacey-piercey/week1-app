import { useCallback, useRef, useState } from 'react';
import Editor, { type EditorHandle } from './components/Editor';
import PageTitle from './components/PageTitle';
import SaveStatus from './components/SaveStatus';
import Sidebar from './components/Sidebar';
import { useAutosave } from './hooks/useAutosave';
import { usePages } from './hooks/usePages';
import type { Block } from './types';

export default function App() {
  const { pages, selectedId, loading, addPage, selectPage, renamePage, setBlocks, removePage } =
    usePages();
  const selected = pages.find((p) => p.id === selectedId);
  const autosave = useAutosave();
  const { flush, schedule, clearStatus, discard } = autosave;

  // The page just made with "+ New page". Only its title gets autofocus,
  // so opening an existing page leaves focus where it was.
  const [newPageId, setNewPageId] = useState<string | null>(null);

  // Leaving a page saves its unsaved edits straight away, and clears the
  // status so the next page doesn't show "Saved" for the old page's edits.
  const handleAdd = useCallback(async () => {
    void flush();
    clearStatus();
    setNewPageId(await addPage());
  }, [addPage, flush, clearStatus]);

  const handleSelect = useCallback(
    (id: string) => {
      void flush();
      clearStatus();
      setNewPageId(null);
      selectPage(id);
    },
    [selectPage, flush, clearStatus],
  );

  // Drop the page's unsaved edits and wait for any save already running,
  // so autosave never tries to save a page that's gone.
  const handleDelete = useCallback(
    async (id: string, nextId: string | null) => {
      const wasOpen = id === selectedId;
      discard(id);
      await flush();
      const deleted = await removePage(id, nextId);
      discard(id); // anything typed while the delete ran
      if (deleted && wasOpen) {
        clearStatus();
        setNewPageId(null);
      }
    },
    [selectedId, discard, flush, removePage, clearStatus],
  );

  const handleTitleChange = useCallback(
    (id: string, title: string) => {
      renamePage(id, title); // updates the sidebar at once
      schedule(id, { title }); // saves 500 ms after typing stops
    },
    [renamePage, schedule],
  );

  // Blocks share the title's save path: one debounced save per page.
  const handleBlocksChange = useCallback(
    (id: string, blocks: Block[]) => {
      setBlocks(id, blocks);
      schedule(id, { blocks });
    },
    [setBlocks, schedule],
  );

  const editorRef = useRef<EditorHandle>(null);

  return (
    <div className="app">
      <Sidebar
        pages={pages}
        selectedId={selectedId}
        loading={loading}
        onAdd={handleAdd}
        onSelect={handleSelect}
        onDelete={handleDelete}
      />
      <main className="content">
        <div className="content-inner">
          {loading ? null : selected ? (
            <>
              <SaveStatus status={autosave.status} />
              <PageTitle
                value={selected.title}
                onChange={(title) => handleTitleChange(selected.id, title)}
                onEnter={() => editorRef.current?.focusStart()}
                autoFocus={selected.id === newPageId}
              />
              <Editor
                // A fresh editor per page, so no cursor state carries over.
                key={selected.id}
                ref={editorRef}
                blocks={selected.blocks}
                onChange={(blocks) => handleBlocksChange(selected.id, blocks)}
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
