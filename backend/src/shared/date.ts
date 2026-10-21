import { CLUB_TIME_ZONE } from '../config/club.js';

const clubDateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: CLUB_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// Calendar date (YYYY-MM-DD) of an instant in the club's time zone.
export function toIsoDate(instant: Date): string {
  return clubDateFormat.format(instant);
}
