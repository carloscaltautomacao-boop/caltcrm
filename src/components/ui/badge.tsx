import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn.ts';

type Variant = 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive' | 'gold';

const variants: Record<Variant, string> = {
  default: 'bg-primary/12 text-primary ring-1 ring-inset ring-primary/20',
  secondary: 'bg-secondary text-secondary-foreground',
  outline: 'border border-border text-foreground',
  success: 'bg-success/15 text-success ring-1 ring-inset ring-success/20',
  warning: 'bg-warning/15 text-warning ring-1 ring-inset ring-warning/25',
  destructive: 'bg-destructive/15 text-destructive ring-1 ring-inset ring-destructive/20',
  gold: 'bg-gold/15 text-gold ring-1 ring-inset ring-gold/25',
};

interface Props extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

export function Badge({ variant = 'default', className, ...props }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
