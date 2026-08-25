import { cn } from '@/lib/utils';
import type { ElementType, ReactNode } from 'react';

interface DirectionalTextProps {
  children: ReactNode;
  direction?: 'ltr' | 'rtl' | 'auto';
  className?: string;
  as?: ElementType;
}

/**
 * Component for handling mixed directional content
 * Useful for displaying numbers, English text, or other LTR content within RTL context
 */
export function DirectionalText({
  children,
  direction = 'auto',
  className,
  as: Component = 'span',
}: DirectionalTextProps) {
  const directionClass = {
    ltr: 'ltr-content',
    rtl: 'rtl-content',
    auto: 'text-natural',
  }[direction];

  return (
    <Component
      className={cn(directionClass, className)}
      dir={direction === 'auto' ? undefined : direction}
    >
      {children}
    </Component>
  );
}

/**
 * Specialized component for numbers and Latin text in RTL context
 */
export function NumberText({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('number-ltr', className)}>{children}</span>;
}
