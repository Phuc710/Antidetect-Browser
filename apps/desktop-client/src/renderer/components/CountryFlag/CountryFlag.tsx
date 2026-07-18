// CountryFlag — reusable component using FlagCDN (flagcdn.com)
// CDN tĩnh theo URL convention — không phải API JSON động.
// URL: https://flagcdn.com/{w}x{h}/{code}.webp
import './CountryFlag.css';

interface CountryFlagProps {
  code: string;           // ISO 3166-1 alpha-2 lowercase: "vn", "us", "de"
  name: string;           // Alt text
  size?: 16 | 20 | 24 | 32 | 40 | 48;
  className?: string | undefined;
}

export function CountryFlag({ code, name, size = 20, className }: CountryFlagProps): JSX.Element | null {
  if (!code || code.trim().length !== 2) return null;

  const c = code.trim().toLowerCase();
  const w = size;
  const h = Math.round(size * 0.75); // Tỷ lệ 4:3

  return (
    <picture className={`country-flag ${className ?? ''}`}>
      <source
        type="image/webp"
        srcSet={`https://flagcdn.com/${w}x${h}/${c}.webp, https://flagcdn.com/${w * 2}x${h * 2}/${c}.webp 2x`}
      />
      <img
        src={`https://flagcdn.com/${w}x${h}/${c}.png`}
        width={w}
        height={h}
        alt={name}
        loading="lazy"
        className="country-flag__img"
        onError={(e) => {
          // Graceful fallback: ẩn ảnh nếu code không hợp lệ
          e.currentTarget.style.display = 'none';
          (e.currentTarget.previousElementSibling as HTMLElement | null)?.setAttribute('srcSet', '');
        }}
      />
    </picture>
  );
}
