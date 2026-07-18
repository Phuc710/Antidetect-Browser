import { describe, it, expect } from 'vitest';
import { SUPPORTED_LANGUAGES } from '../LanguageSelector.js';

describe('LanguageSelector Supported Languages Test', () => {
  it('should support available languages: VI, EN', () => {
    expect(SUPPORTED_LANGUAGES).toHaveLength(2);
    const codes = SUPPORTED_LANGUAGES.map((l) => l.code);
    expect(codes).toEqual(['vi', 'en']);
  });

  it('should have native labels for each language', () => {
    const vi = SUPPORTED_LANGUAGES.find((l) => l.code === 'vi');
    expect(vi?.nativeLabel).toContain('Tiếng Việt');

    const en = SUPPORTED_LANGUAGES.find((l) => l.code === 'en');
    expect(en?.nativeLabel).toContain('English');
  });
});
