import { useState, type FormEvent } from 'react';
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
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <img src="/logo-calt.jpeg" alt="CALT" className="h-32 w-auto object-contain" />
          <p className="text-sm text-muted-foreground">CRM Consórcio — painel de atendimento</p>
        </div>

        <Card>
          <CardContent className="pt-5">
            <form onSubmit={onSubmit} className="space-y-3">
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
              {erro && <p className="text-sm text-destructive">{erro}</p>}
              <Button type="submit" disabled={enviando} className="w-full">
                {enviando ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
