import type { Ref } from 'react';

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  inputRef?: Ref<HTMLInputElement>;
}

/** The sidebar's page filter. Escape clears it. */
export default function SearchBox({ value, onChange, inputRef }: SearchBoxProps) {
  return (
    <input
      ref={inputRef}
      type="search"
      className="search-box"
      aria-label="Search pages"
      placeholder="Search pages…"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && value !== '') {
          e.preventDefault();
          onChange('');
        }
      }}
    />
  );
}
