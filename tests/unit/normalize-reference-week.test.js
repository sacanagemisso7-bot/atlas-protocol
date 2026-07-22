const {
  normalizeReferenceWeek,
} = require('../../src/utils/normalize-reference-week');

describe('normalizeReferenceWeek', () => {
  it('normaliza para segunda-feira à meia-noite em America/Sao_Paulo', () => {
    const normalized = normalizeReferenceWeek('2026-08-05T12:30:00.000Z');

    expect(normalized.toISOString()).toBe('2026-08-03T03:00:00.000Z');
  });

  it('considera o dia local ao redor da virada em UTC', () => {
    const normalized = normalizeReferenceWeek('2026-08-03T01:30:00.000Z');

    expect(normalized.toISOString()).toBe('2026-07-27T03:00:00.000Z');
  });

  it('não altera a semana quando a data já representa a segunda local', () => {
    const normalized = normalizeReferenceWeek(
      new Date('2026-08-03T03:00:00.000Z'),
    );

    expect(normalized.toISOString()).toBe('2026-08-03T03:00:00.000Z');
  });

  it('rejeita valores que não representam datas', () => {
    expect(() => normalizeReferenceWeek('data-inválida')).toThrow(RangeError);
    expect(() => normalizeReferenceWeek(null)).toThrow(RangeError);
  });
});
