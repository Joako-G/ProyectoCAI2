import { useEffect, useRef } from 'react';
import type { Discipline } from '../../disciplines/types/discipline';
import { disciplineNames } from '../../disciplines/utils/discipline-labels';
import type { Member } from '../types/member';
import { calculateAge, formatAge, formatIsoDate } from '../utils/member-format';

interface MemberDetailProps {
  member: Member;
  /** Today's club date (`YYYY-MM-DD`), used to derive the age. */
  today: string;
  /** Discipline catalog used to resolve the member's discipline ids to names. */
  disciplines?: Discipline[];
  /** Whether to offer edit, deactivate and reactivate. */
  canWrite: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
}

const STATUS_LABEL = { active: 'Activo', inactive: 'Inactivo' } as const;
const MISSING = '—';

interface FactProps {
  term: string;
  children: string;
  /** A figure that is read or copied (DNI, date, phone): IBM Plex Mono. */
  figure?: boolean;
  /** Takes the whole row of the grid. */
  wide?: boolean;
}

function Fact({ term, children, figure = false, wide = false }: FactProps) {
  return (
    <div className={`member-fact${figure ? ' member-fact--figure' : ''}${wide ? ' member-fact--wide' : ''}`}>
      <dt>{term}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function initialsOf(member: Member): string {
  return `${member.firstName.trim().charAt(0)}${member.lastName.trim().charAt(0)}`.toUpperCase();
}

/**
 * Presentational member sheet with the available actions. It renders the back button and the sheet as two siblings
 * so the screen can place them on its grid: back on top, the sheet on the left next to the cards.
 */
export function MemberDetail({
  member,
  today,
  disciplines = [],
  canWrite,
  onBack,
  onEdit,
  onDeactivate,
  onReactivate,
}: MemberDetailProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  const { guardian, deactivation } = member;

  return (
    <>
      <div className="member-record__back">
        <button type="button" className="member-record__back-button" onClick={onBack}>
          Volver al listado
        </button>
      </div>

      <article className="card member-sheet" aria-label="Ficha del socio">
        <header className="member-sheet__header">
          <span className="member-sheet__monogram" aria-hidden="true">
            {initialsOf(member)}
          </span>
          <div className="member-sheet__identity">
            <h2 ref={headingRef} tabIndex={-1} className="member-sheet__name">
              {member.firstName} {member.lastName}
            </h2>
            <p className="member-sheet__line">
              <span className="member-sheet__number">N° {member.memberNumber}</span>
              <span>
                {member.category} · {formatAge(calculateAge(member.birthDate, today))}
              </span>
            </p>
            <span className={`status-chip status-chip--${member.status}`}>{STATUS_LABEL[member.status]}</span>
          </div>
          {canWrite ? (
            <div className="member-sheet__actions">
              <button type="button" className="button button--secondary" onClick={onEdit}>
                Editar
              </button>
              {member.status === 'active' ? (
                <button type="button" className="button button--danger" onClick={onDeactivate}>
                  Dar de baja
                </button>
              ) : (
                <button type="button" className="button button--primary" onClick={onReactivate}>
                  Reactivar
                </button>
              )}
            </div>
          ) : null}
        </header>

        <dl className="member-facts">
          <Fact term="DNI" figure>{member.dni}</Fact>
          <Fact term="Fecha de nacimiento" figure>{formatIsoDate(member.birthDate)}</Fact>
          <Fact term="Socio desde" figure>{formatIsoDate(member.memberSince)}</Fact>
          <Fact term="WhatsApp" figure>{member.whatsapp}</Fact>
          <Fact term="Email">{member.email ?? MISSING}</Fact>
          <Fact term="Disciplinas">{disciplineNames(member.disciplineIds, disciplines).join(', ') || MISSING}</Fact>
          {guardian ? <Fact term="Tutor" wide>{`${guardian.name} · ${guardian.contact}`}</Fact> : null}
        </dl>

        {deactivation ? (
          <section className="member-sheet__deactivation" aria-label="Baja">
            <h3 className="member-sheet__deactivation-title">Baja registrada</h3>
            <dl className="member-facts member-facts--plain">
              <Fact term="Fecha de baja" figure>{formatIsoDate(deactivation.date)}</Fact>
              <Fact term="Motivo de la baja" wide>{deactivation.reason}</Fact>
            </dl>
          </section>
        ) : null}
      </article>
    </>
  );
}
