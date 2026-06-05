import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/utils.ts';

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}

export function Card({ title, description, action, children, className, ...rest }: CardProps): React.JSX.Element {
  return (
    <section className={cn('card', className)} {...rest}>
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title ? <h3 className="text-base font-semibold">{title}</h3> : null}
            {description ? (
              <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
                {description}
              </p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </header>
      )}
      <div>{children}</div>
    </section>
  );
}
