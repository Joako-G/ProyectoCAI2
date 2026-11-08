import { useEffect, useState } from 'react';

// The club's time zone, so the screen shows the same time whatever the PC is set to.
const CLUB_TIME_ZONE = 'America/Argentina/Tucuman';
const withSeconds = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZone: CLUB_TIME_ZONE });

/** `HH:MM:SS` in the club's time zone. */
export function clockText(date: Date): string {
  return withSeconds.format(date);
}

/** The live clock of the camera pane; ticks once a second. */
export function useClock(): string {
  const [text, setText] = useState(() => clockText(new Date()));
  useEffect(() => {
    const timer = setInterval(() => setText(clockText(new Date())), 1000);
    return () => clearInterval(timer);
  }, []);
  return text;
}
