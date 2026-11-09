import type { ReactNode } from 'react';

interface DeskCardProps {
  /** Small uppercase caption, as on the Ingreso cards. */
  label: string;
  title?: string;
  /** Accessible name of the region; defaults to the label. */
  ariaLabel?: string;
  children: ReactNode;
}

/** A card of the desk screens (Arqueo, Gastos): the same mono caption and spacing as the Ingreso cards. */
export function DeskCard({ label, title, ariaLabel, children }: DeskCardProps) {
  return (
    <section className="card desk-card" aria-label={ariaLabel ?? label}>
      <header className="desk-card__head">
        <span className="desk-card__label">{label}</span>
        {title ? <h2 className="desk-card__title">{title}</h2> : null}
      </header>
      {children}
    </section>
  );
}
