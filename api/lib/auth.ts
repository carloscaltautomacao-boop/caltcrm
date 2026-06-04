import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Permission } from './permissions-list.ts';

export interface TokenPayload {
  sub: string; // user id
  email: string;
  role: 'admin' | 'sub';
  permissions: Permission[];
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-troque-em-producao-32chars!!';
const COOKIE_NAME = 'cc_token';
const SETE_DIAS_SEG = 60 * 60 * 24 * 7;

export const AUTH_COOKIE = COOKIE_NAME;

export async function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, 10);
}

export async function conferirSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}

export function assinarToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: SETE_DIAS_SEG });
}

export function verificarToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

// admin tem tudo; sub depende do array de permissoes.
export function temPermissao(payload: TokenPayload, permissao: Permission): boolean {
  return payload.role === 'admin' || payload.permissions.includes(permissao);
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: SETE_DIAS_SEG * 1000,
  path: '/',
};
