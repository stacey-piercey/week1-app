import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import PageTitle from './PageTitle';

/** Wraps PageTitle with real state, so typing actually changes the value. */
function Controlled({
  initial = '',
  onChange = () => {},
  onEnter = () => {},
}: {
  initial?: string;
  onChange?: (t: string) => void;
  onEnter?: () => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <PageTitle
      value={value}
      onChange={(t) => {
        setValue(t);
        onChange(t);
      }}
      onEnter={onEnter}
    />
  );
}

const title = () => screen.getByRole('textbox', { name: 'Page title' });

describe('PageTitle', () => {
  it('shows the Untitled placeholder when empty', () => {
    render(<PageTitle value="" onChange={() => {}} onEnter={() => {}} />);
    expect(title()).toHaveAttribute('placeholder', 'Untitled');
    expect(title()).toHaveValue('');
  });

  it('calls onChange with the typed text', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);

    await user.type(title(), 'Hi');

    expect(onChange).toHaveBeenLastCalledWith('Hi');
    expect(title()).toHaveValue('Hi');
  });

  it('Enter calls onEnter and adds no newline', async () => {
    const user = userEvent.setup();
    const onEnter = vi.fn();
    render(<Controlled initial="Plan" onEnter={onEnter} />);

    await user.click(title());
    await user.keyboard('{Enter}');

    expect(onEnter).toHaveBeenCalledTimes(1);
    expect(title()).toHaveValue('Plan');
  });

  it('turns pasted line breaks into spaces', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);

    await user.click(title());
    await user.paste('one\ntwo');

    expect(onChange).toHaveBeenLastCalledWith('one two');
    expect(title()).toHaveValue('one two');
  });

  it('focuses itself when autoFocus is set', () => {
    render(<PageTitle value="" onChange={() => {}} onEnter={() => {}} autoFocus />);
    expect(title()).toHaveFocus();
  });

  it('does not take focus without autoFocus', () => {
    render(<PageTitle value="" onChange={() => {}} onEnter={() => {}} />);
    expect(title()).not.toHaveFocus();
  });
});
