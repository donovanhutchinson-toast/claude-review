import { useEffect, useRef, useState } from 'react';
import { COMMENT_TAGS, type Draft } from '../types.ts';
import { TAG_STYLE } from '../format.ts';
import { useReview } from '../store.ts';

const SAVE_DELAY_MS = 600;

export function OverallPanel({ draft }: { draft: Draft }) {
  const setOverall = useReview((s) => s.setOverall);
  const [text, setText] = useState(draft.overall);
  const synced = useRef(draft.overall);

  useEffect(() => {
    if (draft.overall !== synced.current) {
      synced.current = draft.overall;
      setText(draft.overall);
    }
  }, [draft.overall]);

  useEffect(() => {
    if (text === synced.current) return;

    const timer = setTimeout(() => {
      synced.current = text;
      void setOverall(text);
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text, setOverall]);

  const counts = COMMENT_TAGS.map((tag) => ({
    tag,
    count: draft.comments.filter((c) => c.tag === tag).length,
  })).filter(({ count }) => count > 0);

  return (
    <section
      className="mb-4 rounded-lg border p-3"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-raised)' }}
    >
      <div className="mb-2 flex items-center gap-2">
        <h2 className="font-medium">Overall note</h2>

        {counts.length > 0 && (
          <span className="ml-auto flex gap-1">
            {counts.map(({ tag, count }) => (
              <span key={tag} className="rounded px-1.5 py-0.5 text-[10px]" style={TAG_STYLE[tag]}>
                {count} {tag}
              </span>
            ))}
          </span>
        )}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Anything that applies to the change as a whole."
        className="w-full resize-y rounded border p-2 outline-none"
        style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
      />
    </section>
  );
}
