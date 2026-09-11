import type { FileDiff } from '../types.ts';
import { STATUS_COLOR, STATUS_LABEL, displayPath, skipMessage } from '../format.ts';
import { useReview } from '../store.ts';
import { useFileSource } from '../useFileSource.ts';
import { CommentCard } from './CommentCard.tsx';
import { CommentComposer } from './CommentComposer.tsx';
import { SplitDiff } from './SplitDiff.tsx';
import { UnifiedDiff } from './UnifiedDiff.tsx';

export function fileAnchorId(path: string): string {
  let hash = 0;
  for (let i = 0; i < path.length; i++) hash = (hash * 31 + path.charCodeAt(i)) | 0;
  return `file-${(hash >>> 0).toString(36)}`;
}

export function FileCard({ file }: { file: FileDiff }) {
  const collapsed = useReview((s) => s.collapsed.has(file.path));
  const toggle = useReview((s) => s.toggleCollapsed);
  const viewMode = useReview((s) => s.viewMode);
  const draft = useReview((s) => s.draft);
  const addComment = useReview((s) => s.addComment);

  const composing = useReview((s) => s.composingPath === file.path);
  const setComposingPath = useReview((s) => s.setComposingPath);
  const setViewed = useReview((s) => s.setViewed);
  const viewed = draft?.viewed[file.path] === file.digest;

  const empty = !file.skipped && file.hunks.length === 0;
  const showDiff = !collapsed && !file.skipped && !empty;
  const source = useFileSource(file, showDiff);

  const fileComments = draft?.comments.filter((c) => c.path === file.path) ?? [];
  const loose = fileComments.filter((c) => !c.anchor || c.state === 'orphaned');

  return (
    <section
      id={fileAnchorId(file.path)}
      data-path={file.path}
      className="mb-4 overflow-hidden rounded-lg border"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-raised)' }}
    >
      <header
        className="sticky top-0 z-10 flex items-center gap-3 border-b px-3 py-2"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-raised)' }}
      >
        <button
          type="button"
          onClick={() => toggle(file.path)}
          className="w-4 shrink-0 cursor-pointer opacity-60 hover:opacity-100"
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Expand ${file.path}` : `Collapse ${file.path}`}
        >
          {collapsed ? '▸' : '▾'}
        </button>

        <span className="mono truncate font-medium">{displayPath(file)}</span>

        <span className={`shrink-0 text-[11px] uppercase tracking-wide ${STATUS_COLOR[file.status]}`}>
          {STATUS_LABEL[file.status]}
        </span>

        {file.similarity !== null && file.status === 'renamed' && (
          <span className="shrink-0 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {file.similarity}% similar
          </span>
        )}

        {fileComments.length > 0 && (
          <span className="shrink-0 rounded-full px-1.5 text-[10px]" style={{ background: 'var(--accent)', color: '#fff' }}>
            {fileComments.length}
          </span>
        )}

        <span className="mono ml-auto shrink-0 text-[11px]">
          {file.skipped ? (
            <span style={{ color: 'var(--text-muted)' }}>—</span>
          ) : (
            <>
              <span className="text-emerald-600 dark:text-emerald-400">+{file.additions}</span>{' '}
              <span className="text-rose-600 dark:text-rose-400">−{file.deletions}</span>
            </>
          )}
        </span>

        <button
          type="button"
          onClick={() => setComposingPath(file.path)}
          className="shrink-0 cursor-pointer rounded border px-2 py-0.5 text-[11px]"
          style={{ borderColor: 'var(--border)' }}
        >
          Comment on file
        </button>

        <label
          className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px]"
          style={{ color: 'var(--text-muted)' }}
          title="Mark as reviewed; clears itself if the file changes"
        >
          <input
            type="checkbox"
            checked={viewed}
            onChange={(e) => void setViewed(file, e.target.checked)}
            className="cursor-pointer"
          />
          Viewed
        </label>
      </header>

      {!collapsed && (
        <>
          {file.skipped && (
            <p className="px-4 py-6 text-center" style={{ color: 'var(--text-muted)' }}>
              {skipMessage(file.skipped)}
            </p>
          )}
          {empty && (
            <p className="px-4 py-6 text-center" style={{ color: 'var(--text-muted)' }}>
              No textual changes — likely a mode or rename-only change.
            </p>
          )}

          {showDiff &&
            (viewMode === 'split' ? (
              <SplitDiff file={file} source={source} />
            ) : (
              <UnifiedDiff file={file} source={source} />
            ))}

          {(loose.length > 0 || composing) && (
            <div
              className="flex flex-col gap-2 border-t px-3 py-2"
              style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-sunken)' }}
            >
              {loose.map((comment) => (
                <CommentCard key={comment.id} comment={comment} />
              ))}

              {composing && (
                <CommentComposer
                  submitLabel="Add comment"
                  onCancel={() => setComposingPath(null)}
                  onSubmit={(tag, body) => {
                    void addComment({
                      path: file.path,
                      side: null,
                      startLine: null,
                      endLine: null,
                      tag,
                      body,
                    });
                    setComposingPath(null);
                  }}
                />
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
