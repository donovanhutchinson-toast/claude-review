import { useReview } from '../store.ts';

export function StaleBanner() {
  const stale = useReview((s) => s.stale);
  const load = useReview((s) => s.load);

  if (!stale) return null;

  return (
    <div
      className="flex items-center gap-3 border-b px-4 py-2"
      style={{ borderColor: 'var(--border)', background: 'var(--hunk-bg)' }}
    >
      <span>The files changed while you were writing.</span>
      <button
        type="button"
        onClick={() => void load()}
        className="cursor-pointer rounded px-2 py-1 text-[11px] font-medium text-white"
        style={{ background: 'var(--accent)' }}
      >
        Reload and re-anchor
      </button>
    </div>
  );
}
