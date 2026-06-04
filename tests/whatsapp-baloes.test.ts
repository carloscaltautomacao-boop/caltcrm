import { describe, it, expect } from 'vitest';
import { dividirEmBaloes, calcularDelayDigitacao } from '../api/services/whatsapp.ts';

// A IA passou a mandar a resposta picada em "balões" (mensagens curtas) em vez de um textão. A convenção é
// separar cada balão com uma LINHA EM BRANCO; estes testes blindam essa divisão e o cálculo do "digitando...".
describe('dividirEmBaloes', () => {
  it('texto sem linha em branco vira UM balão só (ex.: a simulação usa quebras simples)', () => {
    const sim = 'Encontrei estas faixas pra você:\n1. Crédito R$ 50.000 em 60x\n2. Crédito R$ 60.000 em 72x';
    expect(dividirEmBaloes(sim)).toEqual([sim]);
  });

  it('linha em branco separa em balões distintos', () => {
    expect(dividirEmBaloes('Oi, tudo bem?\n\nDe qual cidade você é?')).toEqual([
      'Oi, tudo bem?',
      'De qual cidade você é?',
    ]);
  });

  it('apara espaços e descarta balões vazios (linhas em branco extras)', () => {
    expect(dividirEmBaloes('  Beleza!  \n\n\n   \n\n  E qual bem você quer?  ')).toEqual([
      'Beleza!',
      'E qual bem você quer?',
    ]);
  });

  it('limita a 4 balões: junta o excedente no último', () => {
    const baloes = dividirEmBaloes('um\n\ndois\n\ntrês\n\nquatro\n\ncinco');
    expect(baloes).toHaveLength(4);
    expect(baloes[3]).toBe('quatro\n\ncinco');
  });

  it('texto vazio (ou só espaços) não gera balão', () => {
    expect(dividirEmBaloes('   \n\n  ')).toEqual([]);
  });
});

describe('calcularDelayDigitacao', () => {
  it('respeita o piso de 1000ms para textos curtos', () => {
    expect(calcularDelayDigitacao('oi')).toBe(1000);
  });

  it('respeita o teto de 3500ms para textos longos', () => {
    expect(calcularDelayDigitacao('a'.repeat(500))).toBe(3500);
  });

  it('escala com o tamanho entre o piso e o teto', () => {
    const d = calcularDelayDigitacao('a'.repeat(50)); // 50 * 45 = 2250
    expect(d).toBe(2250);
  });
});
