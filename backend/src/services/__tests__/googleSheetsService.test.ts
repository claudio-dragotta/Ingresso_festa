import { describe, it, expect } from 'vitest';
import { parsePersonName } from '../googleSheetsService';

describe('googleSheetsService - parsePersonName', () => {
  it('deve parsare correttamente "Cognome Nome"', () => {
    const result = parsePersonName('Rossi Mario');
    expect(result.lastName).toBe('Rossi');
    expect(result.firstName).toBe('Mario');
  });

  it('deve gestire cognomi composti', () => {
    const result = parsePersonName('De Luca Anna');
    expect(result.lastName).toBe('De Luca');
    expect(result.firstName).toBe('Anna');
  });

  it('deve gestire cognomi con più parole', () => {
    const result = parsePersonName('Van Der Berg Jan');
    expect(result.lastName).toBe('Van Der Berg');
    expect(result.firstName).toBe('Jan');
  });

  it('deve gestire nomi composti (l\'ultima parola è il nome)', () => {
    const result = parsePersonName('Bianchi Maria Luisa');
    expect(result.lastName).toBe('Bianchi Maria');
    expect(result.firstName).toBe('Luisa');
  });

  it('deve gestire una sola parola (solo cognome)', () => {
    const result = parsePersonName('Rossi');
    expect(result.lastName).toBe('Rossi');
    expect(result.firstName).toBe('');
  });

  it('deve rimuovere spazi extra', () => {
    const result = parsePersonName('  Rossi   Mario  ');
    expect(result.lastName).toBe('Rossi');
    expect(result.firstName).toBe('Mario');
  });

  it('deve lanciare errore per stringa vuota', () => {
    expect(() => parsePersonName('')).toThrow('Nome vuoto');
  });

  it('deve salvare il valore originale', () => {
    const result = parsePersonName('Rossi Mario');
    expect(result.originalValue).toBe('Rossi Mario');
  });
});
