import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ThemeToggle from './ThemeToggle';

describe('ThemeToggle', () => {
  it.each([
    ['system', 'Theme: System'],
    ['light', 'Theme: Light'],
    ['dark', 'Theme: Dark'],
  ] as const)('in %s mode, its name is "%s"', (mode, name) => {
    render(<ThemeToggle mode={mode} onCycle={() => {}} />);
    expect(screen.getByRole('button', { name })).toBeInTheDocument();
  });

  it('calls onCycle when clicked', async () => {
    const user = userEvent.setup();
    const onCycle = vi.fn();
    render(<ThemeToggle mode="system" onCycle={onCycle} />);
    await user.click(screen.getByRole('button', { name: 'Theme: System' }));
    expect(onCycle).toHaveBeenCalledTimes(1);
  });
});
