import { useEffect } from 'react';
import { useReview } from './store.ts';

export function useLiveReload(): void {
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token') ?? '';
    const source = new EventSource(`/api/events?token=${encodeURIComponent(token)}`);

    source.addEventListener('changed', () => {
      const store = useReview.getState();
      const busy =
        store.selection !== null ||
        store.preview !== null ||
        store.composingPath !== null ||
        store.submitting;

      if (busy) store.setStale(true);
      else void store.load();
    });

    source.onerror = () => {};

    return () => source.close();
  }, []);
}
