import { Link } from 'react-router';
import type { MemberCard } from '../utils/control-view';

/** The identified member under the banner. `dni` only feeds the "Cobrar cuota" link; it is shown through `card.facts`. */
export function MemberControlCard({ card, dni }: { card: MemberCard; dni?: string }) {
  return (
    <section className="member-control" aria-label="Socio identificado">
      <div className="member-control__top">
        <div className="member-control__avatar" aria-hidden="true">{card.initials}</div>
        <div className="member-control__body">
          <div className="member-control__head">
            <div className="member-control__who">
              <h3 className="member-control__name">{card.name}</h3>
              <p className="member-control__subtitle">{card.subtitle}</p>
            </div>
            <div className="member-control__number">
              <div className="member-control__number-label">N° DE SOCIO</div>
              <div className="member-control__number-value">{card.number}</div>
            </div>
          </div>
          <dl className="member-control__facts">
            {card.facts.map((fact) => (
              <div key={fact.label} className="member-control__fact">
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {card.disciplines.length > 0 ? (
        <div className="member-control__disciplines">
          <div className="member-control__section-label">DISCIPLINAS</div>
          <ul className="member-control__chips">
            {card.disciplines.map((name) => (
              <li key={name} className="member-control__chip">{name}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="member-control__actions">
        <Link className="member-control__button" to={dni ? `/cobros?dni=${encodeURIComponent(dni)}` : '/cobros'}>Cobrar cuota</Link>
        <Link className="member-control__link" to={`/socios?search=${encodeURIComponent(card.number)}`}>Ver ficha completa</Link>
      </div>
    </section>
  );
}
