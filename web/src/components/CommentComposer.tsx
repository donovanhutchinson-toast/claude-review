import { useEffect, useRef, useState } from 'react';
import { COMMENT_TAGS, type CommentTag } from '../types.ts';
import { TAG_STYLE } from '../format.ts';

interface Props {
  initialTag?: CommentTag;
  initialBody?: string;
  submitLabel: string;
  onSubmit: (tag: CommentTag, body: string) => void;
  onCancel: () => void;
}

export function CommentComposer({
  initialTag = 'must-fix',
  initialBody = '',
  submitLabel,
  onSubmit,
  onCancel,
}: Props) {
  const [tag, setTag] = useState<CommentTag>(initialTag);
  const [body, setBody] = useState(initialBody);
  const textarea = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textarea.current?.focus();
  }, []);

  const submit = () => {
    if (body.trim()) onSubmit(tag, body.trim());
  };

  return (
    <div
      className="rounded-md border p-2"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-raised)' }}
    >
      <div className="mb-2 flex gap-1">
        {COMMENT_TAGS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setTag(option)}
            className="cursor-pointer rounded px-2 py-0.5 text-[11px]"
            style={
              option === tag
                ? TAG_STYLE[option]
                : { border: '1px solid var(--border)', color: 'var(--text-muted)' }
            }
          >
            {option}
          </button>
        ))}
      </div>

      <textarea
        ref={textarea}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
        rows={3}
        placeholder="What should change, and why?"
        className="w-full resize-y rounded border p-2 outline-none"
        style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
      />

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={!body.trim()}
          className="cursor-pointer rounded px-2.5 py-1 text-[11px] font-medium text-white disabled:opacity-40"
          style={{ background: 'var(--accent)' }}
        >
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="cursor-pointer rounded border px-2.5 py-1 text-[11px]"
          style={{ borderColor: 'var(--border)' }}
        >
          Cancel
        </button>
        <span className="ml-auto text-[10px]" style={{ color: 'var(--text-muted)' }}>
          ⌘↵ to save · esc to cancel
        </span>
      </div>
    </div>
  );
}
