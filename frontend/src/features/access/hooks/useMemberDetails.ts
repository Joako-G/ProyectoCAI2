import { useEffect, useState } from 'react';
import { fetchHistory } from '../../payments/services/payments-api';
import { fetchMembers, getMember } from '../../members/services/members-api';
import type { Member } from '../../members/types/member';
import { calculateAge } from '../../members/utils/member-format';
import type { GreetingEvent, GreetingMember } from '../types/greeting';
import type { MemberDetails } from '../utils/control-view';

/**
 * The event carries an id, but one rebuilt from an HTTP answer carries the member number in its place; then the
 * member is found by that number. Any failure ends in `undefined`: the card shows dashes and nothing else waits.
 */
async function findMember(member: GreetingMember, signal: AbortSignal): Promise<Member | undefined> {
  try {
    return await getMember(member.id, signal);
  } catch {
    if (signal.aborted) return undefined;
  }
  try {
    const found = await fetchMembers({ search: member.memberNumber, status: 'all' }, signal);
    return found.find((candidate) => candidate.memberNumber === member.memberNumber);
  } catch {
    return undefined;
  }
}

/** The date of the last payment that was not annulled, as `YYYY-MM-DD`. */
function lastPaymentDate(payments: Array<{ paymentDate: string; annulment?: unknown }>): string | undefined {
  return payments.filter((payment) => !payment.annulment).map((payment) => payment.paymentDate).sort().pop();
}

/**
 * What the member card shows beyond the event: the DNI, age, category and member-since from the members API and the
 * last payment from the payments API. They arrive one after the other and each may fail; a failure leaves that field
 * empty. A new event starts again, so the card never shows the data of the previous person.
 */
export function useMemberDetails(event: GreetingEvent | undefined, today: string): MemberDetails & { memberId?: string } {
  const [loaded, setLoaded] = useState<{ event: GreetingEvent; details: MemberDetails & { memberId?: string } } | undefined>();

  useEffect(() => {
    const member = event?.member;
    if (!event || !member) return;
    const controller = new AbortController();
    const { signal } = controller;
    let details: MemberDetails & { memberId?: string } = {};
    const publish = (patch: MemberDetails & { memberId?: string }) => {
      details = { ...details, ...patch };
      if (!signal.aborted) setLoaded({ event, details });
    };

    void (async () => {
      const found = await findMember(member, signal);
      if (found) {
        publish({ memberId: found.id, dni: found.dni, age: calculateAge(found.birthDate, today), category: found.category, memberSince: found.memberSince });
      }
      try {
        const last = lastPaymentDate(await fetchHistory(found?.id ?? member.id, signal));
        if (last) publish({ lastPayment: last });
      } catch {
        // The last payment stays a dash.
      }
    })();

    return () => controller.abort();
  }, [event, today]);

  return loaded && loaded.event === event ? loaded.details : {};
}
