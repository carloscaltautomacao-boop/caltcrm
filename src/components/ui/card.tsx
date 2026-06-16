import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn.ts';

type Variant = 'default' | 'soft' | 'brand';

const variants: Record<Variant, string> = {
  // Card padrão: branco quente, borda fina, sombra quente suave
  default: 'border border-border bg-card text-card-foreground shadow-sm',
  // Realce discreto da marca (lavada de coral)
  soft: 'border border-border bg-brand-soft text-card-foreground shadow-sm',
  // Hero: gradiente coral, texto claro — para o número principal (patrimônio)
  brand: 'border border-transparent bg-brand text-primary-foreground shadow-[var(--shadow-glow)]',
};

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  interactive?: boolean;
}

export function Card({ className, variant = 'default', interactive = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl',
        variants[variant],
        interactive && 'transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1 p-5 pb-3', className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-sm font-semibold leading-none tracking-tight', className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 pt-0', className)} {...props} />;
}
