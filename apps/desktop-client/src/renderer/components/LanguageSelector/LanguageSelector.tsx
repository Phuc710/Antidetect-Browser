import { useState, useRef, useEffect, useId } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import './LanguageSelector.css';

export interface LanguageOption {
  code: string;
  label: string;
  nativeLabel: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'vi', label: 'Tiếng Việt', nativeLabel: 'Tiếng Việt (VI)' },
  { code: 'en', label: 'English', nativeLabel: 'English (EN)' },
];

interface LanguageSelectorProps {
  currentLanguage?: string;
  onLanguageChange?: (code: string) => void;
  className?: string;
}

export function LanguageSelector({
  currentLanguage = 'vi',
  onLanguageChange,
  className = '',
}: LanguageSelectorProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState(currentLanguage);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const baseId = useId();

  const selectedLang = SUPPORTED_LANGUAGES.find((l) => l.code === selectedCode) || SUPPORTED_LANGUAGES[0];

  useEffect(() => {
    setSelectedCode(currentLanguage);
  }, [currentLanguage]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  function handleSelect(code: string) {
    setSelectedCode(code);
    onLanguageChange?.(code);
    setIsOpen(false);
    setFocusedIndex(-1);
    triggerRef.current?.focus();
  }

  function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setIsOpen(true);
      const initialIndex = SUPPORTED_LANGUAGES.findIndex((l) => l.code === selectedCode);
      setFocusedIndex(initialIndex >= 0 ? initialIndex : 0);
    }
  }

  function handleMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!isOpen) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setFocusedIndex((prev) => (prev < SUPPORTED_LANGUAGES.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setFocusedIndex((prev) => (prev > 0 ? prev - 1 : SUPPORTED_LANGUAGES.length - 1));
        break;
      case 'Home':
        event.preventDefault();
        setFocusedIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setFocusedIndex(SUPPORTED_LANGUAGES.length - 1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        {
          const target = SUPPORTED_LANGUAGES[focusedIndex];
          if (target) {
            handleSelect(target.code);
          }
        }
        break;
      case 'Escape':
      case 'Tab':
        event.preventDefault();
        setIsOpen(false);
        setFocusedIndex(-1);
        triggerRef.current?.focus();
        break;
    }
  }

  return (
    <div className={`language-selector ${className}`} ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`language-selector__trigger ${isOpen ? 'language-selector__trigger--open' : ''}`}
        onClick={() => {
          setIsOpen((prev) => !prev);
          if (!isOpen) {
            const idx = SUPPORTED_LANGUAGES.findIndex((l) => l.code === selectedCode);
            setFocusedIndex(idx >= 0 ? idx : 0);
          }
        }}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Chọn ngôn ngữ giao diện / Language selector UI"
      >
        <Globe className="language-selector__icon" aria-hidden="true" />
        <span className="language-selector__label">{selectedLang?.nativeLabel ?? 'Tiếng Việt (VI)'}</span>
        <ChevronDown className="language-selector__chevron" aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className="language-selector__menu"
          role="listbox"
          tabIndex={-1}
          aria-activedescendant={focusedIndex >= 0 ? `${baseId}-opt-${focusedIndex}` : undefined}
          onKeyDown={handleMenuKeyDown}
        >
          {SUPPORTED_LANGUAGES.map((lang, idx) => {
            const isSelected = lang.code === selectedCode;
            const isFocused = idx === focusedIndex;
            return (
              <button
                key={lang.code}
                id={`${baseId}-opt-${idx}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`language-selector__option ${isSelected ? 'language-selector__option--selected' : ''} ${isFocused ? 'language-selector__option--focused' : ''}`}
                onClick={() => handleSelect(lang.code)}
                onMouseEnter={() => setFocusedIndex(idx)}
              >
                <span>{lang.nativeLabel}</span>
                {isSelected && <Check className="language-selector__check" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
