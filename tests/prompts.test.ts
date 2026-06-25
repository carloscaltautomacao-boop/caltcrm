import { describe, expect, it } from 'vitest';
import {
  EXTRATOR_PROMPT,
  montarSystemAgente,
  TABELA_CREDITOS_PADRAO,
  TABELA_PRAZO_MESES_PADRAO,
  TREINAMENTO_PADRAO,
} from '../api/agents/prompts.ts';

describe('prompt do agente', () => {
  it('não oferece lance para quem prefere aguardar pagando', () => {
    const trechoSemPressa = TREINAMENTO_PADRAO.roteiro_atendimento
      .split('Se NÃO tiver pressa')[1]
      ?.split('6. FECHAMENTO / DOCUMENTOS')[0];

    expect(trechoSemPressa).toContain('participa todo mês do sorteio');
    expect(trechoSemPressa).not.toContain('lance embutido');
  });

  it('mantém as regras de lance e documentos mesmo com treinamento antigo', () => {
    const system = montarSystemAgente({
      treinamento: {
        ...TREINAMENTO_PADRAO,
        regras_atendimento: 'Sempre ofereça lance embutido.',
        roteiro_atendimento: 'Se a pessoa disser sim ao consultor, peça CPF e RG.',
      },
      tabelaCreditos: TABELA_CREDITOS_PADRAO,
      prazoMeses: TABELA_PRAZO_MESES_PADRAO,
      nomeCliente: 'Jonas',
      etapaAtual: 'simulacao_enviada',
      qualificacaoFaltando: [],
    });

    expect(system).toContain('REGRAS DURAS DE DECISÃO');
    expect(system).toContain('Se disser que quer "ficar pagando"');
    expect(system).toContain('CONSULTOR PARA DÚVIDAS NÃO É FECHAMENTO');
    expect(system).toContain('DOCUMENTOS SÓ NO FECHAMENTO');
    expect(system.indexOf('REGRAS DURAS DE DECISÃO')).toBeGreaterThan(system.indexOf('ROTEIRO DE ATENDIMENTO'));
  });

  it('extrai os dados comerciais que alimentam a ficha completa', () => {
    expect(EXTRATOR_PROMPT).toContain('"valor_parcela_ideal"');
    expect(EXTRATOR_PROMPT).toContain('"forma_contemplacao"');
    expect(EXTRATOR_PROMPT).toContain('"interesse_lance"');
    expect(EXTRATOR_PROMPT).toContain('"valor_lance"');
    expect(EXTRATOR_PROMPT).toContain('"observacao"');
    expect(EXTRATOR_PROMPT).toContain('"email"');
  });
});
