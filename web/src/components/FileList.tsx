import type { Draft, ReviewModel } from '../types.ts';
import { STATUS_COLOR, STATUS_LABEL, splitPath } from '../format.ts';
import { useReview } from '../store.ts';
import { fileAnchorId } from './FileCard.tsx';

export function FileList({ model, draft }: { model: ReviewModel; draft: Draft }) {
  const activePath = useReview((s) => s.activePath);
  const setActivePath = useReview((s) => s.setActivePath);

  if (model.files.length === 0) {
    return (
      <p className="px-3 py-4" style={{ color: 'var(--text-muted)' }}>
        Nothing changed.
      </p>
    );
  }

  return (
    <nav className="py-2">
      {model.files.map((file) => {
        const { dir, name } = splitPath(file.path);
        const active = file.path === activePath;
        const commentCount = draft.comments.filter((c) => c.path === file.path).length;
        const viewed = draft.viewed[file.path] === file.digest;

        return (
          <button
            key={file.path}
            type="button"
            onClick={() => {
              setActivePath(file.path);
              document
                .getElementById(fileAnchorId(file.path))
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="flex w-full cursor-pointer items-baseline gap-2 px-3 py-1.5 text-left"
            style={{ background: active ? 'var(--bg-sunken)' : 'transparent' }}
          >
            <span
              className={`shrink-0 text-[10px] uppercase ${STATUS_COLOR[file.status]}`}
              title={STATUS_LABEL[file.status]}
            >
              {STATUS_LABEL[file.status].charAt(0)}
            </span>

            <span
              className="mono min-w-0 flex-1 truncate"
              title={file.path}
              style={viewed ? { opacity: 0.5 } : undefined}
            >
              <span style={{ color: 'var(--text-muted)' }}>{dir}</span>
              <span style={{ color: 'var(--text)' }}>{name}</span>
            </span>

            {viewed && (
              <span className="shrink-0 text-[10px]" style={{ color: 'var(--text-muted)' }} title="Viewed">
                ✓
              </span>
            )}

            {commentCount > 0 && (
              <span
                className="shrink-0 rounded-full px-1.5 text-[10px]"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                {commentCount}
              </span>
            )}

            <span className="mono shrink-0 text-[10px]">
              {file.skipped ? (
                <span style={{ color: 'var(--text-muted)' }}>—</span>
              ) : (
                <>
                  <span className="text-emerald-600 dark:text-emerald-400">+{file.additions}</span>{' '}
                  <span className="text-rose-600 dark:text-rose-400">−{file.deletions}</span>
                </>
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
