export type GridSize = 'small' | 'medium' | 'large';

const SIZE_OPTIONS: { value: GridSize; label: string }[] = [
  { value: 'small', label: 'S' },
  { value: 'medium', label: 'M' },
  { value: 'large', label: 'L' },
];

interface SizeSelectorProps {
  value: GridSize;
  onChange: (size: GridSize) => void;
}

export default function SizeSelector({ value, onChange }: SizeSelectorProps) {
  return (
    <div className="size-selector" role="radiogroup" aria-label="Thumbnail size">
      {SIZE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          className={`size-selector__btn${value === opt.value ? ' size-selector__btn--active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
