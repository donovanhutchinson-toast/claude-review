import type { Draft, ReviewModel } from '../types.ts';
import { useReview, type ViewMode } from '../store.ts';

interface Props {
  model: ReviewModel;
  draft: Draft;
  onReload: () => void;
  reloading: boolean;
}

const MODES: ViewMode[] = ['unified', 'split'];

export function Header({ model, draft, onReload, reloading }: Props) {
  const viewMode = useReview((s) => s.viewMode);
  const setViewMode = useReview((s) => s.setViewMode);
  const saving = useReview((s) => s.saving);
  const openPreview = useReview((s) => s.openPreview);
  const sidebarOpen = useReview((s) => s.sidebarOpen);
  const toggleSidebar = useReview((s) => s.toggleSidebar);
  const toggleShortcuts = useReview((s) => s.toggleShortcuts);
  const wrap = useReview((s) => s.wrap);
  const toggleWrap = useReview((s) => s.toggleWrap);
  const saveError = useReview((s) => s.saveError);

  const repoName = model.repoRoot.split('/').filter(Boolean).pop() ?? model.repoRoot;
  const shortSha = model.base.sha ? model.base.sha.slice(0, 7) : 'no commits';

  return (
    <header
      className="flex shrink-0 items-center gap-3 border-b px-4 py-2.5"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-raised)' }}
    >
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label={sidebarOpen ? 'Hide the file list' : 'Show the file list'}
        aria-pressed={sidebarOpen}
        title={`${sidebarOpen ? 'Hide' : 'Show'} the file list (b)`}
        className="cursor-pointer rounded border px-1.5 py-0.5 text-[11px]"
        style={{
          borderColor: 'var(--border)',
          color: sidebarOpen ? 'var(--text)' : 'var(--text-muted)',
        }}
      >
        {sidebarOpen ? '◧' : '▢'}
      </button>

      <h1 className="font-semibold">{repoName}</h1>

      <span className="mono text-[11px]" style={{ color: 'var(--text-muted)' }}>
        working tree vs {model.base.rev} ({shortSha})
      </span>

      {saveError ? (
        <span className="text-[11px] text-rose-600 dark:text-rose-400" title={saveError}>
          Could not save
        </span>
      ) : (
        saving && (
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Saving…
          </span>
        )
      )}

      <div className="ml-auto flex overflow-hidden rounded border" style={{ borderColor: 'var(--border)' }}>
        {MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setViewMode(mode)}
            className="cursor-pointer px-2 py-1 text-[11px] capitalize"
            style={
              mode === viewMode
                ? { background: 'var(--accent)', color: '#fff' }
                : { color: 'var(--text-muted)' }
            }
          >
            {mode}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={toggleWrap}
        aria-pressed={wrap}
        title={`${wrap ? 'Scroll' : 'Wrap'} long lines (w)`}
        className="cursor-pointer rounded border px-2 py-1 text-[11px]"
        style={{
          borderColor: 'var(--border)',
          color: wrap ? 'var(--text)' : 'var(--text-muted)',
        }}
      >
        {wrap ? 'Wrap' : 'No wrap'}
      </button>

      <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
        {draft.comments.length} comment{draft.comments.length === 1 ? '' : 's'}
      </span>

      <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
        {model.totals.files} file{model.totals.files === 1 ? '' : 's'}
        {model.totals.skipped > 0 && `, ${model.totals.skipped} skipped`}
      </span>

      <span className="mono text-[11px]">
        <span className="text-emerald-600 dark:text-emerald-400">+{model.totals.additions}</span>{' '}
        <span className="text-rose-600 dark:text-rose-400">−{model.totals.deletions}</span>
      </span>

      <button
        type="button"
        onClick={() => void openPreview()}
        disabled={draft.comments.length === 0 && !draft.overall.trim()}
        title={
          draft.comments.length === 0 && !draft.overall.trim()
            ? 'Leave a comment or an overall note first'
            : 'Write the review out for Claude'
        }
        className="cursor-pointer rounded px-2.5 py-1 text-[11px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
        style={{ background: 'var(--accent)' }}
      >
        Submit review
      </button>

      <button
        type="button"
        onClick={toggleShortcuts}
        title="Keyboard shortcuts (?)"
        aria-label="Keyboard shortcuts"
        className="cursor-pointer rounded border px-2 py-1 text-[11px]"
        style={{ borderColor: 'var(--border)' }}
      >
        ?
      </button>

      <button
        type="button"
        onClick={onReload}
        disabled={reloading}
        className="cursor-pointer rounded border px-2 py-1 text-[11px] disabled:opacity-50"
        style={{ borderColor: 'var(--border)' }}
      >
        {reloading ? 'Reloading…' : 'Reload diff'}
      </button>
    </header>
  );
}
