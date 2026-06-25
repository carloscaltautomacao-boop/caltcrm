import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { google, type calendar_v3 } from 'googleapis';
import { query } from '../db/pool.ts';

const SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.events',
];
const STATE_SECRET = process.env.JWT_SECRET || 'dev-secret-troque-em-producao-32chars!!';

interface ConexaoRow {
  refresh_token_cifrado: string;
  conta_email: string | null;
  calendar_id: string;
  calendar_nome: string | null;
  scopes: string[];
  conectado_em: string;
}

export interface GoogleCalendarStatus {
  configurado: boolean;
  conectado: boolean;
  sincronizacao_ok: boolean | null;
  conta_email: string | null;
  calendar_id: string | null;
  calendar_nome: string | null;
  conectado_em: string | null;
  erro_sincronizacao?: string;
  erro_configuracao?: string;
}

function credenciaisConfiguradas(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.VITE_APP_URL);
}

function redirectUri(): string {
  return `${(process.env.VITE_APP_URL || '').replace(/\/$/, '')}/api/agenda/google/callback`;
}

function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri(),
  );
}

function chaveCriptografia(): Buffer {
  return crypto.scryptSync(STATE_SECRET, 'calt-google-calendar-v1', 32);
}

function cifrar(valor: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', chaveCriptografia(), iv);
  const encrypted = Buffer.concat([cipher.update(valor, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((b) => b.toString('base64url')).join('.');
}

function decifrar(valor: string): string {
  const [iv, tag, encrypted] = valor.split('.').map((v) => Buffer.from(v!, 'base64url'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', chaveCriptografia(), iv!);
  decipher.setAuthTag(tag!);
  return Buffer.concat([decipher.update(encrypted!), decipher.final()]).toString('utf8');
}

async function conexao(): Promise<ConexaoRow | null> {
  const { rows } = await query<ConexaoRow>('SELECT * FROM google_calendar_conexoes WHERE id = 1');
  return rows[0] ?? null;
}

export async function statusGoogleCalendar(): Promise<GoogleCalendarStatus> {
  const c = await conexao();
  let sincronizacaoOk: boolean | null = null;
  let erroSincronizacao: string | undefined;
  if (c) {
    try {
      const client = oauthClient();
      client.setCredentials({ refresh_token: decifrar(c.refresh_token_cifrado) });
      await google.calendar({ version: 'v3', auth: client }).events.list({
        calendarId: c.calendar_id,
        maxResults: 1,
        singleEvents: true,
        timeMin: new Date().toISOString(),
      });
      sincronizacaoOk = true;
    } catch (e) {
      sincronizacaoOk = false;
      erroSincronizacao = e instanceof Error ? e.message : 'Falha ao consultar o Google Calendar.';
    }
  }
  return {
    configurado: credenciaisConfiguradas(),
    conectado: Boolean(c),
    sincronizacao_ok: sincronizacaoOk,
    conta_email: c?.conta_email ?? null,
    calendar_id: c?.calendar_id ?? null,
    calendar_nome: c?.calendar_nome ?? null,
    conectado_em: c?.conectado_em ?? null,
    ...(erroSincronizacao ? { erro_sincronizacao: erroSincronizacao } : {}),
    ...(!credenciaisConfiguradas() ? { erro_configuracao: 'Defina GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e VITE_APP_URL.' } : {}),
  };
}

export function urlAutorizacaoGoogle(userId: string): string {
  if (!credenciaisConfiguradas()) throw new Error('Credenciais do Google Calendar nao configuradas.');
  const state = jwt.sign({ sub: userId, uso: 'google-calendar' }, STATE_SECRET, { expiresIn: '10m' });
  return oauthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: true,
    scope: SCOPES,
    state,
  });
}

export function validarStateGoogle(state: string, userId: string): void {
  const payload = jwt.verify(state, STATE_SECRET) as { sub?: string; uso?: string };
  if (payload.sub !== userId || payload.uso !== 'google-calendar') throw new Error('State OAuth invalido.');
}

export async function concluirConexaoGoogle(code: string, userId: string): Promise<void> {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) throw new Error('Google nao retornou refresh token. Revogue o acesso e conecte novamente.');
  client.setCredentials(tokens);

  let email: string | null = null;
  if (tokens.access_token) {
    const info = await client.getTokenInfo(tokens.access_token);
    email = info.email ?? null;
  }

  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';

  await query(
    `INSERT INTO google_calendar_conexoes
       (id, refresh_token_cifrado, conta_email, calendar_id, calendar_nome, scopes, conectado_por)
     VALUES (1, $1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO UPDATE SET
       refresh_token_cifrado = EXCLUDED.refresh_token_cifrado,
       conta_email = EXCLUDED.conta_email,
       calendar_id = EXCLUDED.calendar_id,
       calendar_nome = EXCLUDED.calendar_nome,
       scopes = EXCLUDED.scopes,
       conectado_por = EXCLUDED.conectado_por,
       conectado_em = now(),
       atualizado_em = now()`,
    [cifrar(tokens.refresh_token), email, calendarId, calendarId === 'primary' ? 'Agenda principal' : calendarId, SCOPES, userId],
  );
}

export async function desconectarGoogleCalendar(): Promise<void> {
  const c = await conexao();
  if (c) {
    try { await oauthClient().revokeToken(decifrar(c.refresh_token_cifrado)); } catch { /* revogacao best-effort */ }
  }
  await query('DELETE FROM google_calendar_conexoes WHERE id = 1');
}

export async function clienteGoogleCalendar(): Promise<{
  calendar: calendar_v3.Calendar;
  calendarId: string;
} | null> {
  const c = await conexao();
  if (!c) return null;
  const client = oauthClient();
  client.setCredentials({ refresh_token: decifrar(c.refresh_token_cifrado) });
  return { calendar: google.calendar({ version: 'v3', auth: client }), calendarId: c.calendar_id };
}

export function dataGoogle(inicio: string, fim: string | null, diaInteiro: boolean): {
  start: calendar_v3.Schema$EventDateTime;
  end: calendar_v3.Schema$EventDateTime;
} {
  if (diaInteiro) {
    const inicioData = inicio.slice(0, 10);
    const fimData = fim?.slice(0, 10) || new Date(new Date(`${inicioData}T12:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10);
    return { start: { date: inicioData }, end: { date: fimData } };
  }
  const inicioDate = new Date(inicio);
  const fimDate = fim ? new Date(fim) : new Date(inicioDate.getTime() + 30 * 60_000);
  return {
    start: { dateTime: inicioDate.toISOString(), timeZone: 'America/Sao_Paulo' },
    end: { dateTime: fimDate.toISOString(), timeZone: 'America/Sao_Paulo' },
  };
}

export function isoEventoGoogle(valor: calendar_v3.Schema$EventDateTime | undefined): string | null {
  if (valor?.dateTime) return new Date(valor.dateTime).toISOString();
  if (valor?.date) return new Date(`${valor.date}T00:00:00-03:00`).toISOString();
  return null;
}
