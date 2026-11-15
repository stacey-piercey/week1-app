import Sidebar from './components/Sidebar';
import { usePages } from './hooks/usePages';

export default function App() {
  const { pages, selectedId, loading, addPage, selectPage } = usePages();
  const selected = pages.find((p) => p.id === selectedId);

  return (
    <div className="app">
      <Sidebar
        pages={pages}
        selectedId={selectedId}
        loading={loading}
        onAdd={addPage}
        onSelect={selectPage}
      />
      <main className="content">
        <div className="content-inner">
          {loading ? null : selected ? (
            // Step 3 replaces this heading with the editable title.
            <h1>{selected.title.trim() || 'Untitled'}</h1>
          ) : (
            <p className="empty-hint">Create a page to get started.</p>
          )}
        </div>
      </main>
    </div>
  );
}
