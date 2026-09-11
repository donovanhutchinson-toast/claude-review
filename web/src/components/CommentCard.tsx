import { useState } from 'react';
import type { Comment } from '../types.ts';
import { STATE_NOTE, TAG_STYLE } from '../format.ts';
import { useReview } from '../store.ts';
import { CommentComposer } from './CommentComposer.tsx';

export function CommentCard({ comment }: { comment: Comment }) {
  const [editing, setEditing] = useState(false);
  const editComment = useReview((s) => s.editComment);
  const removeComment = useReview((s) => s.removeComment);

  if (editing) {
    return (
      <CommentComposer
        initialTag={comment.tag}
        initialBody={comment.body}
        submitLabel="Save"
        onCancel={() => setEditing(false)}
        onSubmit={(tag, body) => {
          void editComment(comment.id, { tag, body });
          setEditing(false);
        }}
      />
    );
  }

  const note = comment.state ? STATE_NOTE[comment.state] : null;

  return (
    <div
      className="rounded-md border p-2"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-raised)' }}
    >
      <div className="mb-1 flex items-center gap-2">
        <span className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={TAG_STYLE[comment.tag]}>
          {comment.tag}
        </span>

        {comment.anchor && comment.resolvedStartLine !== undefined && (
          <span className="mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {comment.anchor.side} L{comment.resolvedStartLine}
            {comment.resolvedEndLine !== comment.resolvedStartLine && `–${comment.resolvedEndLine}`}
          </span>
        )}

        {!comment.anchor && (
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            whole file
          </span>
        )}

        <button
          type="button"
          onClick={() => setEditing(true)}
          className="ml-auto cursor-pointer text-[11px] opacity-60 hover:opacity-100"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => void removeComment(comment.id)}
          className="cursor-pointer text-[11px] opacity-60 hover:opacity-100"
        >
          Delete
        </button>
      </div>

      {note && (
        <p className="mb-1 text-[10px] italic" style={{ color: 'var(--text-muted)' }}>
          {note}
        </p>
      )}

      <p className="whitespace-pre-wrap" style={{ overflowWrap: 'anywhere' }}>
        {comment.body}
      </p>
    </div>
  );
}
