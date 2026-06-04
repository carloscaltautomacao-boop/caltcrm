type Nivel = 'info' | 'warn' | 'error' | 'debug';

function log(nivel: Nivel, msg: string, meta?: unknown): void {
  const linha = {
    t: new Date().toISOString(),
    nivel,
    msg,
    ...(meta !== undefined ? { meta } : {}),
  };
  const saida = JSON.stringify(linha);
  if (nivel === 'error') console.error(saida);
  else if (nivel === 'warn') console.warn(saida);
  else console.log(saida);
}

export const logger = {
  info: (msg: string, meta?: unknown) => log('info', msg, meta),
  warn: (msg: string, meta?: unknown) => log('warn', msg, meta),
  error: (msg: string, meta?: unknown) => log('error', msg, meta),
  debug: (msg: string, meta?: unknown) => {
    if (process.env.DEBUG) log('debug', msg, meta);
  },
};
