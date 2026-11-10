import { useRef, useState } from 'react';

export interface CarouselSlide {
  id: string;
  /** Short name shown on the step buttons and in the arrows' captions. */
  label: string;
  /** The question the slide answers, shown as its heading. */
  title: string;
  content: React.ReactNode;
}

const SWIPE_DISTANCE = 60;

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false">
      <path d={direction === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * The statistics one slide at a time. Big arrows on both sides (the next one pulses until it is used, so nobody
 * misses that there is more), a named step button per slide, the keyboard's arrows and, on a phone, a swipe.
 * Only the slide on screen is rendered.
 */
export function StatsCarousel({ slides, label }: { slides: CarouselSlide[]; label: string }) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<'next' | 'previous'>('next');
  const [used, setUsed] = useState(false);
  const swipeStart = useRef<number | null>(null);
  const last = slides.length - 1;

  function go(target: number) {
    const next = Math.min(last, Math.max(0, target));
    if (next === index) return;
    setDirection(next > index ? 'next' : 'previous');
    setIndex(next);
    setUsed(true);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    // The arrow keys keep moving the cursor inside a field, such as the month pickers.
    if ((event.target as HTMLElement).closest('input, select, textarea')) return;
    if (event.key === 'ArrowRight') go(index + 1);
    if (event.key === 'ArrowLeft') go(index - 1);
  }

  const current = slides[index];
  const previous = slides[index - 1];
  const next = slides[index + 1];

  return (
    <section className="carousel" aria-roledescription="carousel" aria-label={label} onKeyDown={onKeyDown}>
      <nav className="carousel__steps" aria-label="Secciones de las estadísticas">
        {slides.map((slide, position) => (
          <button key={slide.id} type="button" className="carousel__step" aria-current={position === index ? 'step' : undefined} onClick={() => go(position)}>
            <span className="carousel__step-number">{position + 1}</span>
            {slide.label}
          </button>
        ))}
      </nav>

      <div className="carousel__stage">
        <button
          type="button"
          className="carousel__arrow carousel__arrow--previous"
          disabled={!previous}
          aria-label={previous ? `Anterior: ${previous.label}` : 'Anterior'}
          onClick={() => go(index - 1)}
        >
          <Chevron direction="left" />
          <span className="carousel__arrow-caption">{previous?.label ?? ''}</span>
        </button>

        <div
          key={current.id}
          className="carousel__slide"
          data-direction={direction}
          role="group"
          aria-roledescription="slide"
          aria-label={`${index + 1} de ${slides.length}: ${current.label}`}
          onPointerDown={(event) => { swipeStart.current = event.pointerType === 'touch' ? event.clientX : null; }}
          onPointerUp={(event) => {
            if (swipeStart.current === null) return;
            const distance = event.clientX - swipeStart.current;
            swipeStart.current = null;
            if (Math.abs(distance) >= SWIPE_DISTANCE) go(distance < 0 ? index + 1 : index - 1);
          }}
        >
          <h2 className="carousel__title">{current.title}</h2>
          {current.content}
        </div>

        <button
          type="button"
          className="carousel__arrow carousel__arrow--next"
          data-attention={!used && next ? 'true' : undefined}
          disabled={!next}
          aria-label={next ? `Siguiente: ${next.label}` : 'Siguiente'}
          onClick={() => go(index + 1)}
        >
          <Chevron direction="right" />
          <span className="carousel__arrow-caption">{next?.label ?? ''}</span>
        </button>
      </div>

      <p className="carousel__hint" aria-hidden="true">{index + 1} de {slides.length}{next ? ` · Siguiente: ${next.label}` : ''}</p>
    </section>
  );
}
