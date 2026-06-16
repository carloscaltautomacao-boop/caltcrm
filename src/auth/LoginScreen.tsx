import { useState, type FormEvent } from 'react';
import { Car, Home, Sun, MessageCircle } from 'lucide-react';
import { useAuth } from './AuthContext.tsx';
import { Button } from '../components/ui/button.tsx';
import { Input } from '../components/ui/input.tsx';
import { Card, CardContent } from '../components/ui/card.tsx';

export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await login(email, senha);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha no login');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-[100dvh] lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Painel de marca — desktop */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex">
        <div className="grain pointer-events-none absolute inset-0 opacity-20" />
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full opacity-50 blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--brand-from), transparent 70%)' }}
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full opacity-30 blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--brand-to), transparent 70%)' }}
        />

        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm">
            <img src="/logo-calt.jpeg" alt="CALT" className="h-full w-full object-contain" />
          </div>
          <div>
            <div className="font-display text-xl font-semibold tracking-tight">CALT</div>
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-sidebar-muted">CRM Consórcio</div>
          </div>
        </div>

        <div className="relative max-w-md">
          <h2 className="font-display text-4xl font-semibold leading-[1.1] tracking-tight">
            Onde cada conversa vira <span className="text-brand">conquista</span>.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-sidebar-muted">
            CRM com agente de IA que qualifica seus leads de consórcio no WhatsApp —
            entende o sonho do cliente, monta a simulação e aciona o Carlos na hora certa.
          </p>
          <div className="mt-7 flex flex-wrap gap-2">
            {[
              { Icon: Car, t: 'Automóveis' },
              { Icon: Home, t: 'Imóveis' },
              { Icon: Sun, t: 'Energia Solar' },
            ].map(({ Icon, t }) => (
              <span key={t} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium ring-1 ring-white/10">
                <Icon className="h-3.5 w-3.5 text-primary" /> {t}
              </span>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-2 text-xs text-sidebar-muted">
          <MessageCircle className="h-4 w-4 text-success" /> WhatsApp 86 99965-1602 · atendimento da operação
        </div>
      </div>

      {/* Formulário */}
      <div className="flex min-h-[100dvh] items-center justify-center p-6 lg:min-h-0">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="mb-7 flex flex-col items-center gap-3 text-center lg:hidden">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-black/5">
              <img src="/logo-calt.jpeg" alt="CALT" className="h-full w-full object-contain" />
            </div>
            <div>
              <div className="font-display text-2xl font-semibold tracking-tight">CALT</div>
              <p className="text-sm text-muted-foreground">CRM Consórcio — painel de atendimento</p>
            </div>
          </div>

          <div className="mb-6 hidden lg:block">
            <h1 className="font-display text-2xl font-semibold tracking-tight">Bem-vindo de volta</h1>
            <p className="mt-1 text-sm text-muted-foreground">Acesse o painel de atendimento.</p>
          </div>

          <Card>
            <CardContent className="pt-5">
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="email">E-mail</label>
                  <Input id="email" type="email" placeholder="voce@empresa.com" value={email}
                    onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="senha">Senha</label>
                  <Input id="senha" type="password" placeholder="••••••••" value={senha}
                    onChange={(e) => setSenha(e.target.value)} required />
                </div>
                {erro && (
                  <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>
                )}
                <Button type="submit" size="lg" disabled={enviando} className="w-full">
                  {enviando ? 'Entrando...' : 'Entrar'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Carlos Alberto · Consórcios · Teresina/PI
          </p>
        </div>
      </div>
    </div>
  );
}
