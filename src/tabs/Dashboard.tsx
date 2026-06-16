import { useEffect, useState, type CSSProperties } from 'react';
import {
  Users, UserCheck, TrendingUp, Timer, Banknote, Wallet, Target, Bot, AlertTriangle,
  CalendarClock, AlarmClock, BellRing, ArrowUpRight, Car, Home, Sun, Package, type LucideIcon,
} from 'lucide-react';
import { api } from '../lib/api.ts';
import { FUNIL_LABELS } from '../lib/funil.ts';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card.tsx';

interface Kpis {
  leads: number;
  clientesAtivos: number;
  taxaConversao: number;
  tempoMedioPrimeiraRespostaSeg: number | null;
  creditoQualificadoTotal: number;
  creditoFechadoTotal: number;
  pctComPerfil: number;
  porEtapa: { etapa: string; total: number }[];
  porSegmento: { segmento: string; total: number }[];
  porOrigem: { origem: string; total: number }[];
  custoIaUsd: number;
  agendaPendentes: number;
  agendaAtrasados: number;
  handoffsAbertos: number;
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const delay = (i: number): CSSProperties => ({ '--d': `${i * 55}ms` } as CSSProperties);

type Tone = 'default' | 'gold' | 'success' | 'warning';
const toneTile: Record<Tone, string> = {
  default: 'bg-primary/10 text-primary',
  gold: 'bg-gold/15 text-gold',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
};

function Kpi({ titulo, valor, Icon, i, tone = 'default', destaque }:
  { titulo: string; valor: string; Icon: LucideIcon; i: number; tone?: Tone; destaque?: boolean }) {
  return (
    <Card interactive className="animate-fade-up" style={delay(i)}>
      <CardContent className="flex items-center justify-between gap-3 pt-5">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted-foreground">{titulo}</div>
          <div className={`mt-1.5 font-display text-2xl font-semibold tabular tracking-tight ${destaque ? 'text-brand' : ''}`}>
            {valor}
          </div>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${toneTile[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export function Dashboard() {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [alerta, setAlerta] = useState(false);

  useEffect(() => {
    api.get<{ kpis: Kpis; alertaCustoIa: boolean }>('/dashboard')
      .then((r) => { setKpis(r.kpis); setAlerta(r.alertaCustoIa); })
      .catch(() => setKpis(null));
  }, []);

  if (!kpis) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  const tempo = kpis.tempoMedioPrimeiraRespostaSeg;
  const tempoFmt = tempo == null ? '—' : tempo < 60 ? `${Math.round(tempo)}s` : `${Math.round(tempo / 60)}min`;

  return (
    <div className="space-y-6">
      {alerta && (
        <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" /> Custo de IA acima do teto configurado neste mês.
        </div>
      )}

      {/* Hero — patrimônio fechado no mês */}
      <Card variant="brand" className="relative animate-fade-up overflow-hidden">
        <div className="grain pointer-events-none absolute inset-0 opacity-[0.15]" />
        <CardContent className="relative flex flex-col gap-5 pt-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-primary-foreground/80">
              <Wallet className="h-4 w-4" /> Crédito fechado · mês atual
            </div>
            <div className="mt-2 font-display text-4xl font-semibold tabular tracking-tight sm:text-5xl">
              {brl(kpis.creditoFechadoTotal)}
            </div>
            <div className="mt-1 text-sm text-primary-foreground/85">
              {brl(kpis.creditoQualificadoTotal)} em crédito qualificado na esteira
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-primary-foreground/75">Conversão</div>
              <div className="font-display text-2xl font-semibold tabular">{kpis.taxaConversao}%</div>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
              <ArrowUpRight className="h-6 w-6" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs principais */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi i={0} titulo="Leads no período" valor={String(kpis.leads)} Icon={Users} />
        <Kpi i={1} titulo="Clientes ativos" valor={String(kpis.clientesAtivos)} Icon={UserCheck} tone="success" />
        <Kpi i={2} titulo="Taxa de conversão" valor={`${kpis.taxaConversao}%`} Icon={TrendingUp} destaque />
        <Kpi i={3} titulo="Tempo 1ª resposta" valor={tempoFmt} Icon={Timer} />
        <Kpi i={4} titulo="Crédito qualificado" valor={brl(kpis.creditoQualificadoTotal)} Icon={Banknote} tone="gold" />
        <Kpi i={5} titulo="Crédito fechado" valor={brl(kpis.creditoFechadoTotal)} Icon={Wallet} tone="gold" destaque />
        <Kpi i={6} titulo="% com perfil (≥ mín.)" valor={`${kpis.pctComPerfil}%`} Icon={Target} />
        <Kpi i={7} titulo="Custo de IA (mês)" valor={`US$ ${kpis.custoIaUsd.toFixed(2)}`} Icon={Bot} />
      </div>

      {/* Pendências */}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Pendências da operação (agora)</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Kpi i={0} titulo="Tarefas pendentes" valor={String(kpis.agendaPendentes)} Icon={CalendarClock} />
          <Kpi i={1} titulo="Tarefas atrasadas" valor={String(kpis.agendaAtrasados)} Icon={AlarmClock} tone="warning" destaque={kpis.agendaAtrasados > 0} />
          <Kpi i={2} titulo="Handoffs em aberto" valor={String(kpis.handoffsAbertos)} Icon={BellRing} tone="warning" destaque={kpis.handoffsAbertos > 0} />
        </div>
      </div>

      {/* Distribuições */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Distribuicao titulo="Por etapa do funil" dados={kpis.porEtapa.map((e) => ({ k: FUNIL_LABELS[e.etapa] ?? e.etapa, v: e.total }))} />
        <Distribuicao
          titulo="Por segmento"
          dados={kpis.porSegmento.map((s) => ({ k: rotuloSegmento(s.segmento), v: s.total, Icon: iconeSegmento(s.segmento) }))}
        />
        <Distribuicao titulo="Por origem" dados={kpis.porOrigem.map((o) => ({ k: o.origem, v: o.total }))} />
      </div>
    </div>
  );
}

function rotuloSegmento(s: string): string {
  return { auto: 'Automóvel', imovel: 'Imóvel', solar: 'Energia Solar', carro: 'Automóvel', indefinido: 'Indefinido' }[s] ?? s;
}
function iconeSegmento(s: string): LucideIcon {
  return ({ auto: Car, carro: Car, imovel: Home, solar: Sun } as Record<string, LucideIcon>)[s] ?? Package;
}

function Distribuicao({ titulo, dados }: { titulo: string; dados: { k: string; v: number; Icon?: LucideIcon }[] }) {
  const max = Math.max(1, ...dados.map((d) => d.v));
  return (
    <Card className="animate-fade-up">
      <CardHeader><CardTitle>{titulo}</CardTitle></CardHeader>
      <CardContent className="space-y-3.5">
        {dados.length === 0 && <div className="text-xs text-muted-foreground">Sem dados no período.</div>}
        {dados.map((d) => (
          <div key={d.k} className="text-xs">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 truncate font-medium">
                {d.Icon && <d.Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                {d.k}
              </span>
              <span className="tabular text-muted-foreground">{d.v}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-brand transition-all duration-700"
                style={{ width: `${(d.v / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
