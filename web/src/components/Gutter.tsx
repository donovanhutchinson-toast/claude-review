import type { Side } from '../types.ts';
import { useReview } from '../store.ts';

interface Props {
  path: string;
  side: Side;
  lineNo: number | null;
  selected: boolean;
}

export function Gutter({ path, side, lineNo, selected }: Props) {
  const beginSelection = useReview((s) => s.beginSelection);
  const extendSelection = useReview((s) => s.extendSelection);

  if (lineNo === null) return <div className="diff-gutter" />;

  return (
    <div
      className={`diff-gutter cursor-pointer ${selected ? 'gutter-selected' : ''}`}
      title="Drag to select lines, then comment"
      onMouseDown={(e) => {
        e.preventDefault();
        beginSelection(path, side, lineNo);
      }}
      onMouseEnter={() => extendSelection(path, side, lineNo)}
    >
      {lineNo}
    </div>
  );
}
