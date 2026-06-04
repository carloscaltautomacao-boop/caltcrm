import { describe, it, expect } from 'vitest';
import { formatarSimulacao, type Plano } from '../api/services/planos.ts';
import { resolverPeriodo } from '../api/lib/period.ts';

const plano = (over: Partial<Plano>): Plano => ({
  id: 1, segmento: 'auto', bem: 'Carro', grupo: 'G1',
  credito: 60000, prazo_meses: 96, parcela: 850, taxa_adm: 18, ativo: true, ...over,
});

describe('formatarSimulacao', () => {
  it('usa negrito com UM asterisco e nao usa tabela', () => {
    const txt = formatarSimulacao([plano({})]);
    expect(txt).toContain('*');
    expect(txt).not.toContain('**');
    expect(txt).not.toContain('|');
  });

  it('mensagem amigavel quando nao ha planos', () => {
    expect(formatarSimulacao([])).toMatch(/acionar o time/i);
  });

  it('lista multiplos planos numerados', () => {
    const txt = formatarSimulacao([plano({ id: 1 }), plano({ id: 2, prazo_meses: 116 })]);
    expect(txt).toContain('1.');
    expect(txt).toContain('2.');
  });
});

describe('resolverPeriodo', () => {
  it('default cobre o mes atual (de < ate)', () => {
    const p = resolverPeriodo();
    expect(new Date(p.de).getTime()).toBeLessThan(new Date(p.ate).getTime());
  });

  it('respeita parametros informados', () => {
    const p = resolverPeriodo('2026-01-01', '2026-02-01');
    expect(p.de.startsWith('2026-01-01')).toBe(true);
  });
});
