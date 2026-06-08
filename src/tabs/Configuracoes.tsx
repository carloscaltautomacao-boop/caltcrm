import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.ts';
import { useAuth } from '../auth/AuthContext.tsx';
import { pode, PERMISSIONS } from '../lib/permissions.ts';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card.tsx';
import { Input } from '../components/ui/input.tsx';
import { Button } from '../components/ui/button.tsx';

interface LinhaCredito {
  credito: number;
  parcela: number;
  lance_minimo: number;
}

interface Config {
  persona: string;
  regras_atendimento: string;
  roteiro_atendimento: string;
  faq: string;
  base_conhecimento: string;
  tabela_creditos: LinhaCredito[];
  tabela_prazo_meses: number;
  buffer_segundos: number;
  dividir_mensagens: boolean;
  digitacao_humanizada: boolean;
  follow_up_horas: number;
  handoff: { carlos: string; rayane: string };
}

function Campo({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {hint && <span className="block text-xs font-normal text-muted-foreground">{hint}</span>}
      {children}
    </label>
  );
}

const CLASSE_TEXTAREA =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';

function CampoToggle({
  label, hint, checked, disabled, onChange,
}: {
  label: string; hint?: string; checked: boolean; disabled: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 sm:col-span-2">
      <input
        type="checkbox" checked={checked} disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-primary disabled:opacity-50"
      />
      <span className="space-y-1">
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs font-normal text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

function CampoTexto({
  label, hint, value, rows, disabled, onChange, placeholder,
}: {
  label: string; hint?: string; value: string; rows: number; disabled: boolean;
  onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <Campo label={label} hint={hint}>
      <textarea
        value={value} disabled={disabled} rows={rows} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} className={CLASSE_TEXTAREA}
      />
    </Campo>
  );
}

interface StatusConexao {
  estado: 'open' | 'connecting' | 'close' | 'desconhecido';
}
interface QrResposta extends StatusConexao {
  base64?: string;
  pairingCode?: string;
}

const ROTULO_ESTADO: Record<StatusConexao['estado'], { texto: string; cor: string; bola: string }> = {
  open: { texto: 'Conectado', cor: 'text-success', bola: 'bg-success' },
  connecting: { texto: 'Aguardando leitura do QR', cor: 'text-amber-600', bola: 'bg-amber-500' },
  close: { texto: 'Desconectado', cor: 'text-destructive', bola: 'bg-destructive' },
  desconhecido: { texto: 'Status indisponível', cor: 'text-muted-foreground', bola: 'bg-muted-foreground' },
};

function ConexaoWhatsApp({ podeEditar }: { podeEditar: boolean }) {
  const [estado, setEstado] = useState<StatusConexao['estado']>('desconhecido');
  const [qr, setQr] = useState<QrResposta | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function carregarStatus() {
    try {
      const r = await api.get<StatusConexao>('/config/whatsapp/status');
      setEstado(r.estado);
      // Conectou: para o polling e some com o QR.
      if (r.estado === 'open') { setQr(null); pararPoll(); }
      return r.estado;
    } catch {
      setEstado('desconhecido');
    }
  }

  function pararPoll() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  async function gerarQr() {
    setCarregando(true);
    setErro('');
    try {
      const r = await api.get<QrResposta>('/config/whatsapp/qrcode');
      setEstado(r.estado);
      if (r.estado === 'open') { setQr(null); setErro(''); return; }
      if (!r.base64 && !r.pairingCode) { setErro('Evolution não devolveu o QR. Tente novamente em alguns segundos.'); return; }
      setQr(r);
      iniciarPoll();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao gerar QR code.');
    } finally {
      setCarregando(false);
    }
  }

  // Enquanto o QR está na tela, checa o status a cada 3s; renova o QR a cada ~20s (expira).
  function iniciarPoll() {
    pararPoll();
    let ticks = 0;
    pollRef.current = setInterval(async () => {
      ticks++;
      const e = await carregarStatus();
      if (e === 'open') return;
      if (ticks % 7 === 0) {
        try {
          const r = await api.get<QrResposta>('/config/whatsapp/qrcode');
          if (r.estado === 'open') { setQr(null); pararPoll(); return; }
          if (r.base64 || r.pairingCode) setQr(r);
        } catch { /* mantém o QR atual */ }
      }
    }, 3000);
  }

  useEffect(() => {
    carregarStatus();
    return () => pararPoll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const r = ROTULO_ESTADO[estado];

  return (
    <Card>
      <CardHeader><CardTitle>Conexão do WhatsApp</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${r.bola}`} />
          <span className={`font-medium ${r.cor}`}>{r.texto}</span>
        </div>

        {estado === 'open' && (
          <p className="text-sm text-muted-foreground">
            O WhatsApp está conectado e recebendo mensagens normalmente.
          </p>
        )}

        {qr?.base64 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Abra o WhatsApp no celular da operação → <span className="font-medium">Aparelhos conectados</span> →{' '}
              <span className="font-medium">Conectar um aparelho</span> e aponte para o código abaixo.
            </p>
            <img src={qr.base64} alt="QR code do WhatsApp" className="h-64 w-64 rounded-lg border bg-white p-2" />
            {qr.pairingCode && (
              <p className="text-sm text-muted-foreground">
                Ou use o código de pareamento: <span className="font-mono font-semibold tracking-wider">{qr.pairingCode}</span>
              </p>
            )}
            <p className="text-xs text-muted-foreground">O código expira em segundos e é renovado automaticamente.</p>
          </div>
        )}

        {erro && <p className="text-sm text-destructive">{erro}</p>}

        {podeEditar && estado !== 'open' && (
          <Button onClick={gerarQr} disabled={carregando} className="w-full sm:w-auto">
            {carregando ? 'Gerando...' : qr ? 'Gerar novo QR Code' : 'Conectar WhatsApp (gerar QR Code)'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function CartaoTabelaCreditos({
  linhas, prazoMeses, disabled, onLinhas, onPrazo,
}: {
  linhas: LinhaCredito[];
  prazoMeses: number;
  disabled: boolean;
  onLinhas: (v: LinhaCredito[]) => void;
  onPrazo: (v: number) => void;
}) {
  const atualizar = (i: number, patch: Partial<LinhaCredito>) =>
    onLinhas(linhas.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const remover = (i: number) => onLinhas(linhas.filter((_, idx) => idx !== i));
  const adicionar = () => onLinhas([...linhas, { credito: 0, parcela: 0, lance_minimo: 0 }]);
  const recalcularLances = () => onLinhas(linhas.map((l) => ({ ...l, lance_minimo: Math.round(l.credito * 0.3) })));

  return (
    <Card>
      <CardHeader><CardTitle>Tabela de créditos</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="rounded-md border border-input bg-muted/40 p-3 text-xs text-muted-foreground">
          Esta é a <span className="font-medium">referência oficial</span> de crédito, parcela e lance mínimo. A IA
          cita SÓ estes valores — nunca inventa nem oferece fora desta tabela. Edite aqui e salve; o atendimento passa
          a usar na hora.
        </p>

        <Campo label="Prazo padrão (meses)" hint="Vale para todas as faixas (a tabela atual é toda em 96 meses).">
          <Input type="number" min={1} value={prazoMeses} disabled={disabled}
            onChange={(e) => onPrazo(Number(e.target.value))} className="sm:max-w-[12rem]" />
        </Campo>

        <div className="space-y-2">
          <div className="hidden gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[1fr_1fr_1fr_auto]">
            <span>Crédito (R$)</span>
            <span>Parcela (R$)</span>
            <span>Lance mín. (R$)</span>
            <span className="w-9" />
          </div>
          {linhas.map((l, i) => (
            <div
              key={i}
              className="grid grid-cols-1 gap-2 rounded-md border border-input p-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-center sm:border-0 sm:p-0"
            >
              <label className="space-y-1 sm:space-y-0">
                <span className="text-xs text-muted-foreground sm:hidden">Crédito (R$)</span>
                <Input type="number" min={0} step={100} value={l.credito} disabled={disabled}
                  onChange={(e) => atualizar(i, { credito: Number(e.target.value) })} />
              </label>
              <label className="space-y-1 sm:space-y-0">
                <span className="text-xs text-muted-foreground sm:hidden">Parcela (R$)</span>
                <Input type="number" min={0} step={0.01} value={l.parcela} disabled={disabled}
                  onChange={(e) => atualizar(i, { parcela: Number(e.target.value) })} />
              </label>
              <label className="space-y-1 sm:space-y-0">
                <span className="text-xs text-muted-foreground sm:hidden">Lance mín. (R$)</span>
                <Input type="number" min={0} step={100} value={l.lance_minimo} disabled={disabled}
                  onChange={(e) => atualizar(i, { lance_minimo: Number(e.target.value) })} />
              </label>
              <Button
                type="button" variant="outline" disabled={disabled} onClick={() => remover(i)}
                className="w-full sm:h-9 sm:w-9 sm:px-0" aria-label="Remover linha"
              >
                ×
              </Button>
            </div>
          ))}
          {linhas.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma faixa cadastrada. Adicione ao menos uma.</p>
          )}
        </div>

        {!disabled && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={adicionar} className="w-full sm:w-auto">Adicionar linha</Button>
            <Button type="button" variant="outline" onClick={recalcularLances} className="w-full sm:w-auto">
              Recalcular lances (30%)
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function Configuracoes() {
  const { user } = useAuth();
  const podeEditar = pode(user, PERMISSIONS.CONFIG_EDIT);
  const [config, setConfig] = useState<Config | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get<{ config: Config }>('/config').then((r) => setConfig(r.config)).catch(() => {});
  }, []);

  async function salvar() {
    if (!config) return;
    await api.put('/config', config);
    setMsg('Configurações salvas.');
    setTimeout(() => setMsg(''), 2500);
  }

  async function reconfigurarWebhook() {
    const r = await api.post<{ ok: boolean; url: string }>('/config/webhook', { appUrl: window.location.origin });
    setMsg(r.ok ? `Webhook configurado: ${r.url}` : 'Falha ao configurar webhook.');
  }

  if (!config) return <p className="text-muted-foreground">Carregando...</p>;
  const set = (p: Partial<Config>) => setConfig({ ...config, ...p });

  return (
    <div className="max-w-2xl space-y-6">
      {msg && <div className="rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success">{msg}</div>}

      <ConexaoWhatsApp podeEditar={podeEditar} />

      <Card>
        <CardHeader><CardTitle>Treinamento da IA</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="rounded-md border border-input bg-muted/40 p-3 text-xs text-muted-foreground">
            O que você escrever aqui é a <span className="font-medium">fonte principal</span> do comportamento da IA —
            ela segue estes textos à risca. Deixe um campo vazio para usar o padrão do sistema. O código só cuida do
            lado técnico (formato do WhatsApp, uso das ferramentas e o acionamento do humano).
          </p>
          <CampoTexto
            label="Persona e tom"
            hint="Quem a IA é e como fala (identidade, tom de voz, tratamento)."
            value={config.persona} rows={4} disabled={!podeEditar}
            onChange={(v) => set({ persona: v })}
          />
          <CampoTexto
            label="Regras de atendimento"
            hint="Limites e o que nunca fazer (não inventar dados, não prometer condições, não fechar venda...)."
            value={config.regras_atendimento} rows={6} disabled={!podeEditar}
            onChange={(v) => set({ regras_atendimento: v })}
          />
          <CampoTexto
            label="Roteiro de atendimento"
            hint="O passo a passo da conversa: o que perguntar, em que ordem e quando acionar o humano."
            value={config.roteiro_atendimento} rows={8} disabled={!podeEditar}
            onChange={(v) => set({ roteiro_atendimento: v })}
          />
          <CampoTexto
            label="FAQ (perguntas frequentes)"
            hint="Respostas-padrão para as dúvidas mais comuns sobre consórcio."
            value={config.faq} rows={8} disabled={!podeEditar}
            onChange={(v) => set({ faq: v })}
          />
          <CampoTexto
            label="Base de conhecimento"
            hint="Material de apoio livre: tabelas, políticas, diferenciais da CALT, scripts extras. Cole o conteúdo aqui."
            value={config.base_conhecimento} rows={8} disabled={!podeEditar}
            placeholder="Cole aqui qualquer material que a IA deva conhecer..."
            onChange={(v) => set({ base_conhecimento: v })}
          />
        </CardContent>
      </Card>

      <CartaoTabelaCreditos
        linhas={config.tabela_creditos ?? []}
        prazoMeses={config.tabela_prazo_meses ?? 96}
        disabled={!podeEditar}
        onLinhas={(v) => set({ tabela_creditos: v })}
        onPrazo={(v) => set({ tabela_prazo_meses: v })}
      />

      <Card>
        <CardHeader><CardTitle>Atendimento</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo
            label="Buffer de mensagens (segundos)"
            hint="Tempo que a IA espera o lead terminar de mandar os balões antes de responder. 0 = responde na hora."
          >
            <Input type="number" min={0} value={config.buffer_segundos} disabled={!podeEditar}
              onChange={(e) => set({ buffer_segundos: Number(e.target.value) })} />
          </Campo>
          <CampoToggle
            label="Dividir resposta em vários balões"
            hint="A IA manda mensagens curtas (vários balões) em vez de um texto grande. Mais natural no WhatsApp."
            checked={config.dividir_mensagens} disabled={!podeEditar}
            onChange={(v) => set({ dividir_mensagens: v })}
          />
          <CampoToggle
            label='Mostrar "digitando..."'
            hint="Exibe o status de digitação com uma pausa natural antes de cada balão, como uma pessoa digitando."
            checked={config.digitacao_humanizada} disabled={!podeEditar}
            onChange={(v) => set({ digitacao_humanizada: v })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Acionamento humano (handoff)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700">
            Preencha o <span className="font-medium">WhatsApp principal</span> com DDI+DDD (ex.: 5586999651602).
            Se ficar vazio, a IA não consegue avisar ninguém quando qualifica um lead.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo label="WhatsApp principal (atendimento)">
              <Input value={config.handoff.carlos} disabled={!podeEditar}
                onChange={(e) => set({ handoff: { ...config.handoff, carlos: e.target.value } })} placeholder="5586999651602" />
            </Campo>
            <Campo label="WhatsApp vendas">
              <Input value={config.handoff.rayane} disabled={!podeEditar}
                onChange={(e) => set({ handoff: { ...config.handoff, rayane: e.target.value } })} placeholder="5586..." />
            </Campo>
          </div>
        </CardContent>
      </Card>

      {podeEditar && (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button onClick={salvar} className="w-full sm:w-auto">Salvar alterações</Button>
          <Button variant="outline" onClick={reconfigurarWebhook} className="w-full sm:w-auto">Reconfigurar webhook do Evolution</Button>
        </div>
      )}
    </div>
  );
}
