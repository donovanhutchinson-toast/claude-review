import { Fragment } from 'react';
import type { DiffLine, FileDiff } from '../types.ts';
import { EXPAND_STEP, NO_EXPANSION, gapKey, renderGap, type Gap } from '../gaps.ts';
import { useReview } from '../store.ts';
import type { FileSource } from '../useFileSource.ts';

interface Props {
  file: FileDiff;
  gap: Gap;
  source: FileSource;
  renderLine: (line: DiffLine, key: string) => React.ReactNode;
}

function Expander({
  gap,
  remaining,
  onExpand,
}: {
  gap: Gap;
  remaining: number;
  onExpand: (edge: 'top' | 'bottom' | 'all') => void;
}) {
  const step = Math.min(EXPAND_STEP, remaining);
  const canGrowDown = gap.kind !== 'leading';
  const canGrowUp = gap.kind !== 'trailing';

  return (
    <div className="row-hunk mono flex items-center gap-2 px-3 py-1">
      {canGrowDown && (
        <button type="button" onClick={() => onExpand('top')} className="cursor-pointer underline-offset-2 hover:underline">
          ↓ {step}
        </button>
      )}
      {canGrowUp && (
        <button type="button" onClick={() => onExpand('bottom')} className="cursor-pointer underline-offset-2 hover:underline">
          ↑ {step}
        </button>
      )}
      <button type="button" onClick={() => onExpand('all')} className="cursor-pointer underline-offset-2 hover:underline">
        Expand all {remaining}
      </button>
      <span className="opacity-60">hidden line{remaining === 1 ? '' : 's'}</span>
    </div>
  );
}

export function GapBlock({ file, gap, source, renderLine }: Props) {
  const expansion = useReview((s) => s.expansions[gapKey(file.path, gap.index)]) ?? NO_EXPANSION;
  const expandGap = useReview((s) => s.expandGap);

  if (source.newLines === null) {
    return (
      <div className="row-hunk mono px-3 py-1 opacity-60">
        {gap.size} hidden line{gap.size === 1 ? '' : 's'}
      </div>
    );
  }

  const { above, below, remaining } = renderGap(gap, expansion, source.newLines);

  return (
    <>
      {above.map((line, i) => (
        <Fragment key={`gap-${gap.index}-a-${i}`}>{renderLine(line, `gap-${gap.index}-a-${i}`)}</Fragment>
      ))}

      {remaining > 0 && (
        <Expander
          gap={gap}
          remaining={remaining}
          onExpand={(edge) => expandGap(file.path, gap.index, edge, gap.size)}
        />
      )}

      {below.map((line, i) => (
        <Fragment key={`gap-${gap.index}-b-${i}`}>{renderLine(line, `gap-${gap.index}-b-${i}`)}</Fragment>
      ))}
    </>
  );
}
