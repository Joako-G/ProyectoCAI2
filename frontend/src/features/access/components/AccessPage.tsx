import { useCallback, useEffect, useMemo } from 'react';
import { todayInClub } from '../../members/utils/member-format';
import { useAccessCheck } from '../hooks/useAccessCheck';
import { useControlResult, type ControlResultOptions } from '../hooks/useControlResult';
import { DEFAULT_REFRESH_MS, useEntriesToday } from '../hooks/useEntriesToday';
import { useMemberDetails } from '../hooks/useMemberDetails';
import { KIOSK_TEXT } from '../utils/kiosk-texts';
import { buildControlBanner, buildMemberCard } from '../utils/control-view';
import { ClubToday } from './ClubToday';
import { ControlBanner } from './ControlBanner';
import { DoorCard } from './DoorCard';
import { EntriesToday } from './EntriesToday';
import { MemberControlCard } from './MemberControlCard';

interface AccessPageProps extends ControlResultOptions {
  /** How often the day's list is read again, besides after every control. */
  refreshMs?: number;
  /** Overrides today's club date (`YYYY-MM-DD`); used by tests. */
  today?: string;
}

/**
 * The Ingreso screen, as in the approved "Ventanilla": the door camera recognizes members by itself and the secretary
 * sees each control as it happens, with the member's detail. The DNI field is the way out when the camera does not
 * work. Results come from the greeting stream, whoever made the check; the day's list catches up after every one.
 */
export function AccessPage({ refreshMs = DEFAULT_REFRESH_MS, today = todayInClub(), ...stream }: AccessPageProps) {
  const control = useControlResult(stream);
  const { state: check, check: runCheck } = useAccessCheck();
  const { state: entries, reload } = useEntriesToday(control.version, refreshMs);
  const details = useMemberDetails(control.event, today);

  const { begin, answer } = control;
  useEffect(() => {
    if (check.phase === 'done') answer(check.check, 'dni');
  }, [check, answer]);

  const handleCheck = useCallback((dni: string) => {
    begin();
    return runCheck(dni);
  }, [begin, runCheck]);

  const banner = useMemo(() => buildControlBanner(control.event), [control.event]);
  const card = useMemo(() => (control.event ? buildMemberCard(control.event, details) : undefined), [control.event, details]);

  return (
    <div className="ventanilla">
      {control.sessionExpired ? (
        <p className="members-page__notice members-page__notice--error" role="alert">
          {KIOSK_TEXT.sessionExpired}. <a href="/ingreso">{KIOSK_TEXT.signIn}</a>
        </p>
      ) : null}
      <aside className="ventanilla__side">
        <DoorCard connected={control.connected || control.sessionExpired} check={check} onCheck={handleCheck} />
        <ClubToday counts={entries.day?.counts} />
      </aside>
      <div className="ventanilla__main">
        <ControlBanner banner={banner} />
        {card ? <MemberControlCard card={card} dni={details.dni} /> : null}
        <EntriesToday state={entries} onRetry={() => void reload()} />
      </div>
    </div>
  );
}
