// Junta classes condicionais (versão enxuta de clsx — suficiente para o nosso uso).
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
