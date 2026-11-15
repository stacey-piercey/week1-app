import type { SaveStatus as Status } from '../hooks/useAutosave';

const LABELS: Record<Status, string> = {
  idle: '',
  saving: 'Saving…',
  saved: 'Saved',
  error: "Couldn't save",
};

/**
 * Small autosave indicator above the title. The element is always present
 * (empty when idle) so screen readers reliably announce changes.
 */
export default function SaveStatus({ status }: { status: Status }) {
  return (
    <p className="save-status" role="status">
      {LABELS[status]}
    </p>
  );
}
