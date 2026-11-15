import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SaveStatus from './SaveStatus';

describe('SaveStatus', () => {
  it('is empty when nothing has been edited', () => {
    render(<SaveStatus status="idle" />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it.each([
    ['saving', 'Saving…'],
    ['saved', 'Saved'],
    ['error', "Couldn't save"],
  ] as const)('shows the %s status', (status, text) => {
    render(<SaveStatus status={status} />);
    expect(screen.getByRole('status')).toHaveTextContent(text);
  });
});
