type Listener = () => void;

const listeners = new Set<Listener>();

export function onLocalDataMutation(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyLocalDataMutation(): void {
  for (const fn of listeners) fn();
}
