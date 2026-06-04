// Helper de periodo para os endpoints de BI. Default: mes atual.
export interface Periodo {
  de: string; // ISO date (inclusive)
  ate: string; // ISO date (exclusive)
}

export function resolverPeriodo(deRaw?: string, ateRaw?: string): Periodo {
  const agora = new Date();
  const inicioMes = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));
  const inicioProx = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 1, 1));

  const de = deRaw ? new Date(deRaw) : inicioMes;
  const ate = ateRaw ? new Date(ateRaw) : inicioProx;

  return { de: de.toISOString(), ate: ate.toISOString() };
}
