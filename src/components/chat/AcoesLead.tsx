import { useEffect, useState } from 'react';
import { StickyNote, AlarmClock, CalendarClock, X, Trash2, Plus, Send } from 'lucide-react';
import { api } from '../../lib/api.ts';
import { useAuth } from '../../auth/AuthContext.tsx';
import { pode, PERMISSIONS } from '../../lib/permissions.ts';
import { Button } from '../ui/button.tsx';
import { Input } from '../ui/input.tsx';
import { Overlay } from '../ui/overlay.tsx';
import { cn } from '../../lib/cn.ts';
import type { Anotacao } from '../../lib/anotacoes.ts';
import {
  type TipoEvento, TIPO_LABELS, TIPOS_MANUAIS, dataHoraLocal, isoParaInputLocal, inputLocalParaIso,
} from '../../lib/agenda.ts';

const CLASSE_SELECT =
  'h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const CLASSE_TEXTAREA =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

type Modal = null | 'anotacoes' | 'lembrete' | 'mensagem';

export function AcoesLead({ clienteId, nome }: { clienteId: string; nome: string }) {
  const { user } = useAuth();
  const podeAgenda = pode(user, PERMISSIONS.AGENDA_EDIT);
  const podeNotas = pode(user, PERMISSIONS.CHAT_SEND);
  const [modal, setModal] = useState<Modal>(null);

  return (
    <>
      <div className="flex items-center gap-1">
        <BotaoAcao Icon={StickyNote} label="Anotações" onClick={() => setModal('anotacoes')} />
        {podeAgenda && <BotaoAcao Icon={AlarmClock} label="Lembrete" onClick={() => setModal('lembrete')} />}
        {podeAgenda && <BotaoAcao Icon={CalendarClock} label="Agendar msg" onClick={() => setModal('mensagem')} />}
      </div>

      {modal === 'anotacoes' && (
        <ModalAnotacoes clienteId={clienteId} podeEditar={podeNotas} onFechar={() => setModal(null)} />
      )}
      {modal === 'lembrete' && (
        <ModalLembrete clienteId={clienteId} onFechar={() => setModal(null)} />
      )}
      {modal === 'mensagem' && (
        <ModalMensagem clienteId={clienteId} nome={nome} onFechar={() => setModal(null)} />
      )}
    </>
  );
}

function BotaoAcao({ Icon, label, onClick }: { Icon: typeof StickyNote; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function CabecalhoModal({ titulo, onFechar }: { titulo: string; onFechar: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-base font-semibold">{titulo}</h3>
      <button onClick={onFechar} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="text-xs font-medium text-muted-foreground">{label}</span>{children}</label>;
}

// Data + Hora -> ISO (UTC) no fuso BRT. Reaproveita os helpers da agenda.
function CamposDataHora({ data, hora, setData, setHora }: {
  data: string; hora: string; setData: (v: string) => void; setHora: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Campo label="Data"><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></Campo>
      <Campo label="Hora"><Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></Campo>
    </div>
  );
}

function valoresPadraoDataHora(): [string, string] {
  const [d, h] = isoParaInputLocal(new Date().toISOString()).split('T');
  return [d!, h!];
}

// ---- Modal: Anotações ----
function ModalAnotacoes({ clienteId, podeEditar, onFechar }: {
  clienteId: string; podeEditar: boolean; onFechar: () => void;
}) {
  const [anotacoes, setAnotacoes] = useState<Anotacao[]>([]);
  const [texto, setTexto] = useState('');
  const [salvando, setSalvando] = useState(false);

  function carregar() {
    api.get<{ anotacoes: Anotacao[] }>(`/clientes/${clienteId}/anotacoes`).then((r) => setAnotacoes(r.anotacoes)).catch(() => {});
  }
  useEffect(carregar, [clienteId]);

  async function adicionar() {
    if (!texto.trim()) return;
    setSalvando(true);
    try {
      await api.post(`/clientes/${clienteId}/anotacoes`, { texto: texto.trim() });
      setTexto('');
      carregar();
    } finally {
      setSalvando(false);
    }
  }
  async function excluir(id: string) {
    await api.del(`/clientes/${clienteId}/anotacoes/${id}`).catch(() => {});
    carregar();
  }

  return (
    <Overlay onFechar={onFechar}>
      <CabecalhoModal titulo="Anotações" onFechar={onFechar} />

      {podeEditar && (
        <div className="mt-3 space-y-2">
          <textarea
            value={texto} onChange={(e) => setTexto(e.target.value)} rows={3}
            placeholder="Escreva uma anotação sobre este lead..." className={CLASSE_TEXTAREA}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={adicionar} disabled={salvando || !texto.trim()}>
              <Plus className="h-4 w-4" /> {salvando ? 'Salvando...' : 'Adicionar'}
            </Button>
          </div>
        </div>
      )}

      <div className="mt-3 space-y-2">
        {anotacoes.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma anotação ainda.</p>
        )}
        {anotacoes.map((a) => (
          <div key={a.id} className="rounded-md border border-border bg-muted/40 p-3 text-sm">
            <p className="whitespace-pre-wrap">{a.texto}</p>
            <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
              <span>{a.autor_nome || 'Equipe'} · {dataHoraLocal(a.criado_em)}</span>
              {podeEditar && (
                <button onClick={() => excluir(a.id)} className="hover:text-destructive" aria-label="Excluir anotação">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Overlay>
  );
}

// ---- Modal: Lembrete / evento vinculado ao lead ----
function ModalLembrete({ clienteId, onFechar }: { clienteId: string; onFechar: () => void }) {
  const [padraoData, padraoHora] = valoresPadraoDataHora();
  const [tipo, setTipo] = useState<TipoEvento>('lembrete');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [data, setData] = useState(padraoData);
  const [hora, setHora] = useState(padraoHora);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function salvar() {
    if (!titulo.trim()) { setErro('Informe um título.'); return; }
    if (!data || !hora) { setErro('Informe data e hora.'); return; }
    setSalvando(true);
    setErro('');
    try {
      await api.post('/agenda', {
        tipo, titulo: titulo.trim(), descricao: descricao.trim() || null,
        inicio: inputLocalParaIso(`${data}T${hora}`), cliente_id: clienteId,
      });
      onFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar.');
      setSalvando(false);
    }
  }

  return (
    <Overlay onFechar={onFechar}>
      <CabecalhoModal titulo="Novo lembrete" onFechar={onFechar} />
      <div className="mt-3 space-y-3">
        <Campo label="Tipo">
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoEvento)} className={CLASSE_SELECT}>
            {TIPOS_MANUAIS.map((t) => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
          </select>
        </Campo>
        <Campo label="Título">
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Ligar para confirmar pagamento" />
        </Campo>
        <Campo label="Descrição (opcional)">
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} className={CLASSE_TEXTAREA} />
        </Campo>
        <CamposDataHora data={data} hora={hora} setData={setData} setHora={setHora} />
        {erro && <p className="text-sm text-destructive">{erro}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</Button>
        </div>
      </div>
    </Overlay>
  );
}

// ---- Modal: Mensagem agendada (WhatsApp futuro; enviado pelo n8n) ----
function ModalMensagem({ clienteId, nome, onFechar }: { clienteId: string; nome: string; onFechar: () => void }) {
  const [padraoData, padraoHora] = valoresPadraoDataHora();
  const [mensagem, setMensagem] = useState('');
  const [data, setData] = useState(padraoData);
  const [hora, setHora] = useState(padraoHora);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function salvar() {
    if (!mensagem.trim()) { setErro('Escreva a mensagem.'); return; }
    if (!data || !hora) { setErro('Informe data e hora.'); return; }
    setSalvando(true);
    setErro('');
    try {
      await api.post('/agenda', {
        tipo: 'mensagem', canal: 'whatsapp', cliente_id: clienteId,
        titulo: `Mensagem para ${nome}`, descricao: mensagem.trim(),
        inicio: inputLocalParaIso(`${data}T${hora}`),
      });
      onFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar.');
      setSalvando(false);
    }
  }

  return (
    <Overlay onFechar={onFechar}>
      <CabecalhoModal titulo="Mensagem agendada" onFechar={onFechar} />
      <div className="mt-3 space-y-3">
        <Campo label="Mensagem">
          <textarea
            value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={4}
            placeholder="Texto que será enviado ao lead no WhatsApp..." className={CLASSE_TEXTAREA}
          />
        </Campo>
        <CamposDataHora data={data} hora={hora} setData={setData} setHora={setHora} />
        <p className={cn('flex items-start gap-1.5 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground')}>
          <Send className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          A mensagem fica agendada na Agenda e é enviada automaticamente no horário escolhido.
        </p>
        {erro && <p className="text-sm text-destructive">{erro}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>{salvando ? 'Agendando...' : 'Agendar'}</Button>
        </div>
      </div>
    </Overlay>
  );
}
