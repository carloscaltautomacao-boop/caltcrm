import { useEffect, useState } from 'react';
import { Users, UserCheck, TrendingUp, Timer, Banknote, Wallet, Target, Bot, AlertTriangle, CalendarClock, AlarmClock, BellRing, type LucideIcon } from 'lucide-react';
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

function Kpi({ titulo, valor, Icon, destaque }: { titulo: string; valor: string; Icon: LucideIcon; destaque?: boolean }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between pt-5">
        <div>
          <div className="text-xs text-muted-foreground">{titulo}</div>
          <div className={`mt-1 text-2xl font-semibold ${destaque ? 'text-primary' : ''}`}>{valor}</div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
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

  if (!kpis) return <p className="text-muted-foreground">Carregando métricas...</p>;

  const tempo = kpis.tempoMedioPrimeiraRespostaSeg;
  const tempoFmt = tempo == null ? '—' : tempo < 60 ? `${Math.round(tempo)}s` : `${Math.round(tempo / 60)}min`;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">Visão geral do mês atual.</p>

      {alerta && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
          <AlertTriangle className="h-4 w-4" /> Custo de IA acima do teto configurado neste mês.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi titulo="Leads no período" valor={String(kpis.leads)} Icon={Users} />
        <Kpi titulo="Clientes ativos" valor={String(kpis.clientesAtivos)} Icon={UserCheck} />
        <Kpi titulo="Taxa de conversão" valor={`${kpis.taxaConversao}%`} Icon={TrendingUp} destaque />
        <Kpi titulo="Tempo 1ª resposta" valor={tempoFmt} Icon={Timer} />
        <Kpi titulo="Crédito qualificado" valor={brl(kpis.creditoQualificadoTotal)} Icon={Banknote} />
        <Kpi titulo="Crédito fechado" valor={brl(kpis.creditoFechadoTotal)} Icon={Wallet} destaque />
        <Kpi titulo="% com perfil (≥ mín.)" valor={`${kpis.pctComPerfil}%`} Icon={Target} />
        <Kpi titulo="Custo de IA (mês)" valor={`US$ ${kpis.custoIaUsd.toFixed(2)}`} Icon={Bot} />
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Pendências da operação (agora)</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Kpi titulo="Tarefas pendentes" valor={String(kpis.agendaPendentes)} Icon={CalendarClock} />
          <Kpi titulo="Tarefas atrasadas" valor={String(kpis.agendaAtrasados)} Icon={AlarmClock} destaque={kpis.agendaAtrasados > 0} />
          <Kpi titulo="Handoffs em aberto" valor={String(kpis.handoffsAbertos)} Icon={BellRing} destaque={kpis.handoffsAbertos > 0} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Distribuicao titulo="Por etapa do funil" dados={kpis.porEtapa.map((e) => ({ k: FUNIL_LABELS[e.etapa] ?? e.etapa, v: e.total }))} />
        <Distribuicao titulo="Por segmento" dados={kpis.porSegmento.map((s) => ({ k: rotuloSegmento(s.segmento), v: s.total }))} />
        <Distribuicao titulo="Por origem" dados={kpis.porOrigem.map((o) => ({ k: o.origem, v: o.total }))} />
      </div>
    </div>
  );
}

function rotuloSegmento(s: string): string {
  return { auto: 'Automóvel', imovel: 'Imóvel', solar: 'Energia Solar', carro: 'Automóvel', indefinido: 'Indefinido' }[s] ?? s;
}

function Distribuicao({ titulo, dados }: { titulo: string; dados: { k: string; v: number }[] }) {
  const max = Math.max(1, ...dados.map((d) => d.v));
  return (
    <Card>
      <CardHeader><CardTitle>{titulo}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {dados.length === 0 && <div className="text-xs text-muted-foreground">Sem dados no período.</div>}
        {dados.map((d) => (
          <div key={d.k} className="text-xs">
            <div className="mb-1 flex justify-between"><span>{d.k}</span><span className="text-muted-foreground">{d.v}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-2 rounded-full bg-primary" style={{ width: `${(d.v / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
