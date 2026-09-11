import type { Comment } from '../types.ts';
import { CommentCard } from './CommentCard.tsx';

export function StalePanel({ comments }: { comments: Comment[] }) {
  if (comments.length === 0) return null;

  const byPath = new Map<string, Comment[]>();
  for (const comment of comments) {
    const bucket = byPath.get(comment.path);
    if (bucket) bucket.push(comment);
    else byPath.set(comment.path, [comment]);
  }

  return (
    <section
      className="mb-4 rounded-lg border p-3"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-raised)' }}
    >
      <h2 className="mb-1 font-medium">Comments on files no longer in the diff</h2>
      <p className="mb-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>
        These files were reverted, committed, or renamed since the comment was written.
      </p>

      {[...byPath].map(([path, group]) => (
        <div key={path} className="mb-3 last:mb-0">
          <p className="mono mb-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {path}
          </p>
          <div className="flex max-w-3xl flex-col gap-2">
            {group.map((comment) => (
              <CommentCard key={comment.id} comment={comment} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
