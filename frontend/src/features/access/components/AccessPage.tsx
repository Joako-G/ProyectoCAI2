import { useCallback, useState } from 'react';
import type { CameraTiming } from '../hooks/useCameraEntrance';
import { AccessView } from './AccessView';
import { EntriesToday } from './EntriesToday';

/** The Ingreso screen: the entrance check, and under it the day's entries, which catch up after every answer. */
export function AccessPage({ timing, refreshMs }: { timing?: Partial<CameraTiming>; refreshMs?: number }) {
  const [answers, setAnswers] = useState(0);
  const handleAnswered = useCallback(() => setAnswers((count) => count + 1), []);
  return (
    <div className="access-page">
      <AccessView timing={timing} onAnswered={handleAnswered} />
      <EntriesToday refreshKey={answers} refreshMs={refreshMs} />
    </div>
  );
}
