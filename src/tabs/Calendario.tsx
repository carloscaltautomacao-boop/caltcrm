import { useEffect, useMemo, useState } from 'react';
import {
  Plus, ChevronLeft, ChevronRight, Check, X, Trash2, Clock, RotateCcw, CalendarDays, List, Bot,
} from 'lucide-react';
import { api } from '../lib/api.ts';
import { useAuth } from '../auth/AuthContext.tsx';
import { pode, PERMISSIONS } from '../lib/permissions.ts';
import { cn } from '../lib/cn.ts';
import { Card } from '../components/ui/card.tsx';
import { Button } from '../components/ui/button.tsx';
import { Input } from '../components/ui/input.tsx';
import { Badge } from '../components/ui/badge.tsx';
import type { Cliente } from '../lib/funil.ts';
import {
  type Evento, type Responsavel, type TipoEvento, type StatusEvento,
  TIPO_LABELS, TIPO_COR, TIPOS_MANUAIS, STATUS_LABELS, CANAIS,
  chaveDiaLocal, horaLocal, dataHoraLocal, diaExtenso, isoParaInputLocal, inputLocalParaIso, ehAtrasado,
} from '../lib/agenda.ts';

const DIAS = 86_400_000;

function inicioDoMes(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1); }
function keyData(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function gridDias(ref: Date): Date[] {
  const primeiro = inicioDoMes(ref);
  const start = new Date(primeiro.getFullYear(), primeiro.getMonth(), 1 - primeiro.getDay());
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}
const tituloMes = (d: Date) => new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(d);

type Vista = 'mes' | 'agenda';

export function Calendario() {
  const { user } = useAuth();
  const podeEditar = pode(user, PERMISSIONS.AGENDA_EDIT);

  const [vista, setVista] = useState<Vista>('agenda');
  const [refMes, setRefMes] = useState(() => inicioDoMes(new Date()));
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [responsaveis, setResponsaveis] = useState<Responsavel[]>([]);

  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [meus, setMeus] = useState(false);

  const [selecionado, setSelecionado] = useState<Evento | null>(null);
  const [editando, setEditando] = useState<Evento | null>(null);
  const [criandoEm, setCriandoEm] = useState<string | null>(null); // ISO inicial ao criar, ou null

  function carregar() {
    let de: Date, ate: Date;
    if (vista === 'mes') {
      const g = gridDias(refMes);
      de = g[0]!;
      ate = new Date(g[41]!.getFullYear(), g[41]!.getMonth(), g[41]!.getDate() + 1);
    } else {
      de = new Date(Date.now() - 7 * DIAS);
      ate = new Date(Date.now() + 60 * DIAS);
    }
    const qs = new URLSearchParams({ de: de.toISOString(), ate: ate.toISOString() });
    if (filtroTipo) qs.set('tipo', filtroTipo);
    if (filtroStatus) qs.set('status', filtroStatus);
    if (meus) qs.set('meus', '1');
    api.get<{ eventos: Evento[] }>(`/agenda?${qs}`).then((r) => setEventos(r.eventos)).catch(() => {});
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(carregar, [vista, refMes, filtroTipo, filtroStatus, meus]);
  useEffect(() => {
    api.get<{ responsaveis: Responsavel[] }>('/agenda/responsaveis').then((r) => setResponsaveis(r.responsaveis)).catch(() => {});
  }, []);

  const porDia = useMemo(() => {
    const map = new Map<string, Evento[]>();
    for (const e of eventos) {
      const k = chaveDiaLocal(e.inicio);
      const arr = map.get(k) ?? [];
      arr.push(e);
      map.set(k, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.inicio.localeCompare(b.inicio));
    return map;
  }, [eventos]);

  async function mudarStatus(ev: Evento, status: StatusEvento) {
    await api.post(`/agenda/${ev.id}/status`, { status }).catch(() => {});
    setSelecionado(null);
    carregar();
  }
  async function excluir(ev: Evento) {
    await api.del(`/agenda/${ev.id}`).catch(() => {});
    setSelecionado(null);
    carregar();
  }

  return (
    <div className="space-y-4">
      {/* Barra de controles */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-md border border-border">
          <BotaoVista atual={vista} valor="agenda" onClick={setVista} Icon={List} label="Agenda" />
          <BotaoVista atual={vista} valor="mes" onClick={setVista} Icon={CalendarDays} label="Mês" />
        </div>

        {vista === 'mes' && (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => setRefMes(new Date(refMes.getFullYear(), refMes.getMonth() - 1, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-36 text-center text-sm font-medium capitalize">{tituloMes(refMes)}</span>
            <Button variant="outline" size="icon" onClick={() => setRefMes(new Date(refMes.getFullYear(), refMes.getMonth() + 1, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setRefMes(inicioDoMes(new Date()))}>Hoje</Button>
          </div>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} className={CLASSE_SELECT}>
            <option value="">Todos os tipos</option>
            {(['tarefa', 'lembrete', 'compromisso', 'follow_up'] as TipoEvento[]).map((t) => (
              <option key={t} value={t}>{TIPO_LABELS[t]}</option>
            ))}
          </select>
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} className={CLASSE_SELECT}>
            <option value="">Todos os status</option>
            {(Object.keys(STATUS_LABELS) as StatusEvento[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <input type="checkbox" checked={meus} onChange={(e) => setMeus(e.target.checked)} className="h-4 w-4 rounded border-input accent-primary" />
            Só meus
          </label>
          {podeEditar && (
            <Button size="sm" onClick={() => { setEditando(null); setCriandoEm(new Date().toISOString()); }}>
              <Plus className="h-4 w-4" /> Novo
            </Button>
          )}
        </div>
      </div>

      {vista === 'mes'
        ? <VistaMes refMes={refMes} porDia={porDia} onEvento={setSelecionado}
            onDia={podeEditar ? (d) => { setEditando(null); setCriandoEm(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 0).toISOString()); } : undefined} />
        : <VistaAgenda porDia={porDia} onEvento={setSelecionado} />}

      {selecionado && (
        <DrawerEvento
          ev={selecionado} podeEditar={podeEditar}
          onFechar={() => setSelecionado(null)}
          onConcluir={() => mudarStatus(selecionado, 'concluido')}
          onReabrir={() => mudarStatus(selecionado, 'pendente')}
          onCancelar={() => mudarStatus(selecionado, 'cancelado')}
          onExcluir={() => excluir(selecionado)}
          onEditar={() => { setEditando(selecionado); setCriandoEm(null); setSelecionado(null); }}
        />
      )}

      {(criandoEm !== null || editando) && podeEditar && (
        <FormEvento
          evento={editando} inicialIso={criandoEm} responsaveis={responsaveis}
          onFechar={() => { setEditando(null); setCriandoEm(null); }}
          onSalvo={() => { setEditando(null); setCriandoEm(null); carregar(); }}
        />
      )}
    </div>
  );
}

const CLASSE_SELECT =
  'h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function BotaoVista({ atual, valor, onClick, Icon, label }: {
  atual: Vista; valor: Vista; onClick: (v: Vista) => void; Icon: typeof List; label: string;
}) {
  return (
    <button
      onClick={() => onClick(valor)}
      className={cn('flex items-center gap-1.5 px-3 py-1.5 text-sm', atual === valor ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent')}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

// ---- Visão de mês (grid) ----
function VistaMes({ refMes, porDia, onEvento, onDia }: {
  refMes: Date; porDia: Map<string, Evento[]>; onEvento: (e: Evento) => void; onDia?: (d: Date) => void;
}) {
  const dias = gridDias(refMes);
  const hojeKey = keyData(new Date());
  const mesAtual = refMes.getMonth();
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-xs font-medium text-muted-foreground">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => <div key={d} className="py-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {dias.map((d) => {
          const k = keyData(d);
          const evs = porDia.get(k) ?? [];
          const foraMes = d.getMonth() !== mesAtual;
          return (
            <div
              key={k}
              onClick={() => onDia?.(d)}
              className={cn(
                'min-h-24 border-b border-r border-border p-1 text-left align-top last:border-r-0',
                foraMes && 'bg-muted/30 text-muted-foreground', onDia && 'cursor-pointer hover:bg-accent/40',
              )}
            >
              <div className={cn('mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs', k === hojeKey && 'bg-primary font-semibold text-primary-foreground')}>
                {d.getDate()}
              </div>
              <div className="space-y-0.5">
                {evs.slice(0, 3).map((e) => (
                  <button
                    key={e.id}
                    onClick={(ev) => { ev.stopPropagation(); onEvento(e); }}
                    className={cn('flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px]',
                      e.status === 'concluido' || e.status === 'cancelado' ? 'opacity-50' : '',
                      ehAtrasado(e) ? 'bg-destructive/15 text-destructive' : 'hover:bg-accent')}
                  >
                    <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', TIPO_COR[e.tipo])} />
                    <span className="truncate">{horaLocal(e.inicio)} {e.titulo}</span>
                  </button>
                ))}
                {evs.length > 3 && <div className="px-1 text-[11px] text-muted-foreground">+{evs.length - 3}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ---- Visão agenda (lista por dia) ----
function VistaAgenda({ porDia, onEvento }: { porDia: Map<string, Evento[]>; onEvento: (e: Evento) => void }) {
  const dias = [...porDia.keys()].sort();
  if (dias.length === 0) {
    return <Card className="p-10 text-center text-sm text-muted-foreground">Nenhum evento no período.</Card>;
  }
  return (
    <div className="space-y-4">
      {dias.map((k) => {
        const evs = porDia.get(k)!;
        return (
          <div key={k}>
            <div className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground capitalize">
              {diaExtenso(evs[0]!.inicio)}
            </div>
            <div className="space-y-2">
              {evs.map((e) => <LinhaEvento key={e.id} ev={e} onClick={() => onEvento(e)} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LinhaEvento({ ev, onClick }: { ev: Evento; onClick: () => void }) {
  const atrasado = ehAtrasado(ev);
  const apagado = ev.status === 'concluido' || ev.status === 'cancelado';
  return (
    <Card onClick={onClick} className={cn('flex cursor-pointer items-center gap-3 p-3 transition hover:shadow-md', apagado && 'opacity-60')}>
      <span className={cn('h-9 w-1 shrink-0 rounded-full', TIPO_COR[ev.tipo])} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 font-medium">
          <span className="truncate">{ev.titulo}</span>
          {ev.automatico && <Bot className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
        </div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          {horaLocal(ev.inicio)} · {TIPO_LABELS[ev.tipo]}{ev.cliente_nome ? ` · ${ev.cliente_nome}` : ev.cliente_telefone ? ` · ${ev.cliente_telefone}` : ''}
        </div>
      </div>
      {ev.status === 'concluido'
        ? <Badge variant="success">Concluído</Badge>
        : atrasado
          ? <Badge variant="destructive">Atrasado</Badge>
          : ev.status !== 'pendente'
            ? <Badge variant="secondary">{STATUS_LABELS[ev.status]}</Badge>
            : <Clock className="h-4 w-4 text-muted-foreground" />}
    </Card>
  );
}

// ---- Drawer de detalhes ----
function DrawerEvento({ ev, podeEditar, onFechar, onConcluir, onReabrir, onCancelar, onExcluir, onEditar }: {
  ev: Evento; podeEditar: boolean; onFechar: () => void; onConcluir: () => void; onReabrir: () => void;
  onCancelar: () => void; onExcluir: () => void; onEditar: () => void;
}) {
  return (
    <Overlay onFechar={onFechar}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn('h-3 w-3 rounded-full', TIPO_COR[ev.tipo])} />
          <h3 className="text-base font-semibold">{ev.titulo}</h3>
        </div>
        <button onClick={onFechar} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
      </div>

      <div className="mt-3 space-y-2 text-sm">
        <Linha rotulo="Quando" valor={dataHoraLocal(ev.inicio)} />
        <Linha rotulo="Tipo" valor={TIPO_LABELS[ev.tipo] + (ev.automatico ? ' (automático)' : '')} />
        <Linha rotulo="Status" valor={STATUS_LABELS[ev.status]} />
        {ev.cliente_nome || ev.cliente_telefone ? <Linha rotulo="Lead" valor={`${ev.cliente_nome ?? ''}${ev.cliente_telefone ? ` · ${ev.cliente_telefone}` : ''}`} /> : null}
        {ev.responsavel_nome && <Linha rotulo="Responsável" valor={ev.responsavel_nome} />}
        {ev.canal && <Linha rotulo="Canal" valor={ev.canal} />}
        {ev.descricao && <div className="rounded-md border border-border bg-muted/40 p-2 text-muted-foreground whitespace-pre-wrap">{ev.descricao}</div>}
      </div>

      {podeEditar && (
        <div className="mt-4 flex flex-wrap gap-2">
          {ev.status === 'pendente'
            ? <Button size="sm" onClick={onConcluir}><Check className="h-4 w-4" /> Concluir</Button>
            : <Button size="sm" variant="outline" onClick={onReabrir}><RotateCcw className="h-4 w-4" /> Reabrir</Button>}
          {/* Eventos automáticos (follow-up/handoff) são geridos pelo sistema: sem edição de tipo/agenda. */}
          {!ev.automatico && <Button size="sm" variant="outline" onClick={onEditar}>Editar</Button>}
          {ev.status === 'pendente' && <Button size="sm" variant="outline" onClick={onCancelar}>Cancelar</Button>}
          <Button size="sm" variant="destructive" onClick={onExcluir}><Trash2 className="h-4 w-4" /> Excluir</Button>
        </div>
      )}
    </Overlay>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return <div className="flex gap-2"><span className="w-24 shrink-0 text-muted-foreground">{rotulo}</span><span className="font-medium">{valor}</span></div>;
}

// ---- Formulário criar/editar ----
function FormEvento({ evento, inicialIso, responsaveis, onFechar, onSalvo }: {
  evento: Evento | null; inicialIso: string | null; responsaveis: Responsavel[]; onFechar: () => void; onSalvo: () => void;
}) {
  const [tipo, setTipo] = useState<TipoEvento>(evento && TIPOS_MANUAIS.includes(evento.tipo) ? evento.tipo : 'tarefa');
  const [titulo, setTitulo] = useState(evento?.titulo ?? '');
  const [quando, setQuando] = useState(isoParaInputLocal(evento?.inicio ?? inicialIso ?? undefined));
  const [responsavel, setResponsavel] = useState(evento?.responsavel_id ?? '');
  const [canal, setCanal] = useState(evento?.canal ?? '');
  const [descricao, setDescricao] = useState(evento?.descricao ?? '');
  const [cliente, setCliente] = useState<{ id: string; nome: string } | null>(
    evento?.cliente_id ? { id: evento.cliente_id, nome: evento.cliente_nome || evento.cliente_telefone || 'Lead' } : null,
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function salvar() {
    if (!titulo.trim()) { setErro('Informe um título.'); return; }
    setSalvando(true);
    setErro('');
    const corpo = {
      tipo, titulo: titulo.trim(), inicio: inputLocalParaIso(quando),
      descricao: descricao.trim() || null, canal: canal || null,
      responsavel_id: responsavel || null, cliente_id: cliente?.id ?? null,
    };
    try {
      if (evento) await api.patch(`/agenda/${evento.id}`, corpo);
      else await api.post('/agenda', corpo);
      onSalvo();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar.');
      setSalvando(false);
    }
  }

  return (
    <Overlay onFechar={onFechar}>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">{evento ? 'Editar evento' : 'Novo evento'}</h3>
        <button onClick={onFechar} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
      </div>

      <div className="mt-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <CampoForm label="Tipo">
            <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoEvento)} className={`${CLASSE_SELECT} w-full`}>
              {TIPOS_MANUAIS.map((t) => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
            </select>
          </CampoForm>
          <CampoForm label="Quando">
            <Input type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} />
          </CampoForm>
        </div>

        <CampoForm label="Título">
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Ligar para confirmar pagamento" />
        </CampoForm>

        <CampoForm label="Lead (opcional)">
          <SeletorCliente valor={cliente} onSelecionar={setCliente} />
        </CampoForm>

        <div className="grid grid-cols-2 gap-3">
          <CampoForm label="Responsável (opcional)">
            <select value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={`${CLASSE_SELECT} w-full`}>
              <option value="">—</option>
              {responsaveis.map((r) => <option key={r.id} value={r.id}>{r.nome || r.email}</option>)}
            </select>
          </CampoForm>
          <CampoForm label="Canal (opcional)">
            <select value={canal} onChange={(e) => setCanal(e.target.value)} className={`${CLASSE_SELECT} w-full`}>
              <option value="">—</option>
              {CANAIS.map((c) => <option key={c.valor} value={c.valor}>{c.label}</option>)}
            </select>
          </CampoForm>
        </div>

        <CampoForm label="Descrição (opcional)">
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </CampoForm>

        {erro && <p className="text-sm text-destructive">{erro}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</Button>
        </div>
      </div>
    </Overlay>
  );
}

function CampoForm({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="text-xs font-medium text-muted-foreground">{label}</span>{children}</label>;
}

// Busca incremental de leads para vincular ao evento.
function SeletorCliente({ valor, onSelecionar }: {
  valor: { id: string; nome: string } | null; onSelecionar: (c: { id: string; nome: string } | null) => void;
}) {
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<Cliente[]>([]);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (busca.trim().length < 2) { setResultados([]); return; }
    const t = setTimeout(() => {
      api.get<{ clientes: Cliente[] }>(`/clientes?q=${encodeURIComponent(busca)}`)
        .then((r) => setResultados(r.clientes.slice(0, 8))).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [busca]);

  if (valor) {
    return (
      <div className="flex items-center justify-between rounded-md border border-input px-3 py-2 text-sm">
        <span className="truncate">{valor.nome}</span>
        <button onClick={() => onSelecionar(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
    );
  }
  return (
    <div className="relative">
      <Input value={busca} placeholder="Buscar lead por nome ou telefone..."
        onChange={(e) => { setBusca(e.target.value); setAberto(true); }} onFocus={() => setAberto(true)} />
      {aberto && resultados.length > 0 && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-popover shadow-md">
          {resultados.map((c) => (
            <button key={c.id} onClick={() => { onSelecionar({ id: c.id, nome: c.nome || c.telefone }); setAberto(false); setBusca(''); }}
              className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-accent">
              <span className="font-medium">{c.nome || c.telefone}</span>
              <span className="text-xs text-muted-foreground">{c.telefone}{c.cidade ? ` · ${c.cidade}` : ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Overlay/modal simples (sem dependência externa).
function Overlay({ children, onFechar }: { children: React.ReactNode; onFechar: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onFechar}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-lg overflow-auto rounded-t-2xl border border-border bg-card p-5 shadow-xl sm:rounded-2xl"
      >
        {children}
      </div>
    </div>
  );
}
