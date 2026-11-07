/**
 * What the public entrance display may know about a check: when, how to react and, only for a member who may
 * come in, the first name. Nothing else ever travels on the stream: no id, number, reason, amount or DNI.
 */
export interface GreetingEvent {
  /** ISO instant of the check. */
  at: string;
  /** welcome: green. see_desk: yellow, the member enters but passes by the desk. refused: anything else. */
  tone: 'welcome' | 'see_desk' | 'refused';
  firstName?: string;
}

export type GreetingListener = (event: GreetingEvent) => void;

/** An in-memory fan-out. Nothing is stored, so a display that connects late sees only what happens next. */
export function createGreetingBus() {
  const listeners = new Set<GreetingListener>();
  return {
    /** Returns the function that stops listening. */
    subscribe(listener: GreetingListener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    publish(event: GreetingEvent): void {
      for (const listener of [...listeners]) {
        // One closed socket must not keep the others from the greeting, nor fail the check that published it.
        try {
          listener(event);
        } catch {
          listeners.delete(listener);
        }
      }
    },
    listenerCount: () => listeners.size,
  };
}

export type GreetingBus = ReturnType<typeof createGreetingBus>;
