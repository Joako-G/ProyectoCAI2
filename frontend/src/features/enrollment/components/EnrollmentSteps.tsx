export type EnrollmentStep = 'data' | 'disciplines' | 'payment';

const STEPS: ReadonlyArray<{ id: EnrollmentStep; name: string }> = [
  { id: 'data', name: 'Datos' },
  { id: 'disciplines', name: 'Disciplinas' },
  { id: 'payment', name: 'Cobro' },
];

/**
 * Visual indicator of the three enrollment steps: the current one is named and filled, the finished ones are marked.
 * It is hidden from assistive technology on purpose: the screen announces the same thing once, in words ("Paso 1 de 3").
 */
export function EnrollmentSteps({ current }: { current: EnrollmentStep }) {
  const currentIndex = STEPS.findIndex(({ id }) => id === current);
  return (
    <ol className="stepper" aria-hidden="true">
      {STEPS.map(({ id, name }, index) => (
        <li
          key={id}
          className="stepper__item"
          aria-current={id === current ? 'step' : undefined}
          data-done={index < currentIndex ? 'true' : undefined}
        >
          <span className="stepper__marker">
            <span className="stepper__number">{index + 1}</span>
          </span>
          <span className="stepper__name">{name}</span>
        </li>
      ))}
    </ol>
  );
}
