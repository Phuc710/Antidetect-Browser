// CountryFlag — 100% offline local SVG flag component
// Loads 254 country flag SVGs directly from local assets/flags/*.svg via Vite eager globbing
import './CountryFlag.css';

const flagMap = import.meta.glob<string>('../../assets/flags/*.svg', {
  eager: true,
  import: 'default',
});

interface CountryFlagProps {
  code: string; // ISO 3166-1 alpha-2: "vn", "us", "de"
  name?: string; // Alt text or label
  size?: 16 | 20 | 24 | 32 | 40 | 48;
  className?: string | undefined;
}

export function CountryFlag({ code, name, size = 20, className }: CountryFlagProps): JSX.Element | null {
  if (!code || code.trim().length === 0) return null;

  const c = code.trim().toLowerCase();
  const path = `../../assets/flags/${c}.svg`;
  const fallbackPath = '../../assets/flags/xx.svg';

  const src = flagMap[path] || flagMap[fallbackPath];
  if (!src) return null;

  const w = size;
  const h = Math.round(size * 0.75); // 4:3 ratio

  return (
    <span className={`country-flag ${className ?? ''}`} style={{ width: w, height: h }}>
      <img
        src={src}
        width={w}
        height={h}
        alt={name || c.toUpperCase()}
        loading="lazy"
        className="country-flag__img"
      />
    </span>
  );
}
