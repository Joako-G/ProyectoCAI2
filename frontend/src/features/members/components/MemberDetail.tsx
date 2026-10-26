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

function Fact({ term, children }: { term: string; children: string }) {
  return (
    <div className="detail-fact">
      <dt>{term}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Presentational member sheet with the available actions. */
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
    <article className="card member-detail" aria-label="Ficha del socio">
      <div className="member-detail__toolbar">
        <button type="button" className="button button--secondary" onClick={onBack}>
          Volver al listado
        </button>
        {canWrite ? (
          <div className="member-detail__actions">
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
      </div>

      <header className="member-detail__header">
        <div>
          <h2 ref={headingRef} tabIndex={-1} className="member-detail__name">
            {member.firstName} {member.lastName}
          </h2>
          <p className="member-detail__meta">
            {member.category} · {formatAge(calculateAge(member.birthDate, today))}
          </p>
        </div>
        <span className={`status-chip status-chip--${member.status}`}>{STATUS_LABEL[member.status]}</span>
      </header>

      <dl className="detail-facts">
        <Fact term="N° de socio">{member.memberNumber}</Fact>
        <Fact term="DNI">{member.dni}</Fact>
        <Fact term="Fecha de nacimiento">{formatIsoDate(member.birthDate)}</Fact>
        <Fact term="Socio desde">{formatIsoDate(member.memberSince)}</Fact>
        <Fact term="WhatsApp">{member.whatsapp}</Fact>
        <Fact term="Email">{member.email ?? MISSING}</Fact>
        <Fact term="Disciplinas">{disciplineNames(member.disciplineIds, disciplines).join(', ') || MISSING}</Fact>
        {guardian ? <Fact term="Tutor">{`${guardian.name} · ${guardian.contact}`}</Fact> : null}
      </dl>

      {deactivation ? (
        <section className="member-detail__deactivation" aria-label="Baja">
          <h3 className="member-detail__deactivation-title">Baja registrada</h3>
          <dl className="detail-facts">
            <Fact term="Fecha de baja">{formatIsoDate(deactivation.date)}</Fact>
            <Fact term="Motivo de la baja">{deactivation.reason}</Fact>
          </dl>
        </section>
      ) : null}
    </article>
  );
}
