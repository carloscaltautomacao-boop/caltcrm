import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn.ts';

type Variant = 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary';
type Size = 'default' | 'sm' | 'lg' | 'icon';

const variants: Record<Variant, string> = {
  default:
    'bg-brand text-primary-foreground shadow-sm hover:shadow-[var(--shadow-glow)] hover:-translate-y-px active:translate-y-0 active:brightness-95',
  outline: 'border border-border bg-card/60 hover:bg-accent hover:text-accent-foreground hover:border-primary/30',
  ghost: 'hover:bg-accent hover:text-accent-foreground',
  destructive: 'bg-destructive text-white shadow-sm hover:brightness-110 hover:-translate-y-px active:translate-y-0',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-accent',
};

const sizes: Record<Size, string> = {
  default: 'h-9 px-4 py-2 text-sm',
  sm: 'h-8 px-3 text-xs',
  lg: 'h-11 px-6 text-sm',
  icon: 'h-9 w-9',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant = 'default', size = 'default', className, ...props }: Props) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
