// The club's calendar day; mirrors CLUB_TIME_ZONE in backend/src/config/club.ts.
const CLUB_TIME_ZONE = 'America/Argentina/Tucuman';

const clubDayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: CLUB_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today's date as `YYYY-MM-DD` in the club's time zone. */
export function todayInClub(now: Date = new Date()): string {
  return clubDayFormat.format(now);
}

function parseIsoDate(value: string): [number, number, number] {
  const [year, month, day] = value.split('-').map(Number);
  return [year, month, day];
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Full years between `birthDate` and `today` (both `YYYY-MM-DD`). A Feb 29 birthday counts as Mar 1 in non-leap years. */
export function calculateAge(birthDate: string, today: string): number {
  const [birthYear, birthMonth, birthDay] = parseIsoDate(birthDate);
  const [year, month, day] = parseIsoDate(today);

  const observedBirthday =
    birthMonth === 2 && birthDay === 29 && !isLeapYear(year)
      ? { month: 3, day: 1 }
      : { month: birthMonth, day: birthDay };
  const hadBirthday =
    month > observedBirthday.month ||
    (month === observedBirthday.month && day >= observedBirthday.day);

  return year - birthYear - (hadBirthday ? 0 : 1);
}

/** `2015-02-01` -> `01/02/2015`, without going through `Date` (no time zone shifts). */
export function formatIsoDate(value: string): string {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}
