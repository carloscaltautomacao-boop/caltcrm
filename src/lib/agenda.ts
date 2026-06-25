// Tipos + helpers da aba Calendario. Espelha api/services/agenda.ts.
// Datas vem em UTC (ISO) do backend; aqui renderizamos em America/Sao_Paulo (BRT).

export type TipoEvento = 'tarefa' | 'lembrete' | 'compromisso' | 'follow_up' | 'mensagem';
export type StatusEvento = 'pendente' | 'concluido' | 'cancelado' | 'enviado' | 'falhou';

export interface Evento {
  id: string;
  cliente_id: string | null;
  tipo: TipoEvento;
  titulo: string;
  descricao: string | null;
  inicio: string;
  fim: string | null;
  dia_inteiro: boolean;
  status: StatusEvento;
  canal: string | null;
  automatico: boolean;
  toque: number | null;
  responsavel_id: string | null;
  handoff_id: string | null;
  concluido_em: string | null;
  criado_em: string;
  cliente_nome: string | null;
  cliente_telefone: string | null;
  responsavel_nome: string | null;
  google_event_id: string | null;
  google_calendar_id: string | null;
  google_html_link: string | null;
  google_updated_at: string | null;
  sync_error: string | null;
}

export interface Responsavel {
  id: string;
  nome: string | null;
  email: string;
}

export const TIPO_LABELS: Record<TipoEvento, string> = {
  tarefa: 'Tarefa',
  lembrete: 'Lembrete',
  compromisso: 'Compromisso',
  follow_up: 'Follow-up',
  mensagem: 'Msg. agendada',
};

// Tipos que o humano pode criar pela UI (follow_up é gerado só pelo motor de reativação).
export const TIPOS_MANUAIS: TipoEvento[] = ['tarefa', 'lembrete', 'compromisso'];

export const STATUS_LABELS: Record<StatusEvento, string> = {
  pendente: 'Pendente',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
  enviado: 'Enviado',
  falhou: 'Falhou',
};

// Cor da bolinha/borda por tipo (classe de background tailwind).
export const TIPO_COR: Record<TipoEvento, string> = {
  tarefa: 'bg-primary',
  lembrete: 'bg-amber-500',
  compromisso: 'bg-violet-500',
  follow_up: 'bg-sky-500',
  mensagem: 'bg-emerald-500',
};

export const CANAIS: { valor: string; label: string }[] = [
  { valor: 'whatsapp', label: 'WhatsApp' },
  { valor: 'ligacao', label: 'Ligação' },
  { valor: 'presencial', label: 'Presencial' },
  { valor: 'interno', label: 'Interno' },
];

const TZ = 'America/Sao_Paulo';

const fmtDia = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const fmtHora = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const fmtDataHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const fmtDiaExtenso = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'short', day: '2-digit', month: 'long' });

// 'YYYY-MM-DD' do evento no fuso BRT (chave de agrupamento por dia).
export function chaveDiaLocal(iso: string): string {
  return fmtDia.format(new Date(iso));
}
export function horaLocal(iso: string): string {
  return fmtHora.format(new Date(iso));
}
export function dataHoraLocal(iso: string): string {
  return fmtDataHora.format(new Date(iso));
}
export function diaExtenso(iso: string): string {
  return fmtDiaExtenso.format(new Date(iso));
}

// ISO (UTC) -> valor de <input type="datetime-local"> ('YYYY-MM-DDTHH:mm') já no fuso BRT.
export function isoParaInputLocal(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(d).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

// Valor do <input datetime-local> (interpretado como BRT) -> ISO UTC para o backend.
// Piauí/Brasil é UTC-3 o ano todo (sem horário de verão desde 2019), por isso o offset fixo -03:00.
export function inputLocalParaIso(local: string): string {
  return new Date(`${local}:00-03:00`).toISOString();
}

export function ehAtrasado(ev: Evento): boolean {
  return ev.status === 'pendente' && new Date(ev.inicio).getTime() < Date.now();
}
