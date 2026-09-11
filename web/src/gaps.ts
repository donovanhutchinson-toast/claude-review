import type { DiffLine, FileDiff } from './types.ts';

export const EXPAND_STEP = 20;

export type GapKind = 'leading' | 'middle' | 'trailing';

export interface Gap {
  index: number;
  kind: GapKind;
  oldStart: number;
  newStart: number;
  size: number;
}

export function gapsFor(file: FileDiff): Gap[] {
  const gaps: Gap[] = [];
  const hunks = file.hunks;
  if (hunks.length === 0) return gaps;

  const first = hunks[0]!;
  if (first.newStart > 1 || first.oldStart > 1) {
    gaps.push({
      index: 0,
      kind: 'leading',
      oldStart: 1,
      newStart: 1,
      size: Math.max(0, Math.min(first.oldStart, first.newStart) - 1),
    });
  }

  for (let i = 0; i < hunks.length - 1; i++) {
    const hunk = hunks[i]!;
    const next = hunks[i + 1]!;
    const newStart = hunk.newStart + hunk.newLines;
    const oldStart = hunk.oldStart + hunk.oldLines;

    gaps.push({
      index: i + 1,
      kind: 'middle',
      oldStart,
      newStart,
      size: Math.max(0, next.newStart - newStart),
    });
  }

  const last = hunks[hunks.length - 1]!;
  const tailNewStart = last.newStart + last.newLines;
  const tailOldStart = last.oldStart + last.oldLines;
  const tailSize = Math.max(0, file.newLineCount - tailNewStart + 1);

  if (tailSize > 0) {
    gaps.push({
      index: hunks.length,
      kind: 'trailing',
      oldStart: tailOldStart,
      newStart: tailNewStart,
      size: tailSize,
    });
  }

  return gaps.filter((gap) => gap.size > 0);
}

export interface Expansion {
  top: number;
  bottom: number;
}

export const NO_EXPANSION: Expansion = { top: 0, bottom: 0 };

export interface GapRender {
  above: DiffLine[];
  below: DiffLine[];
  remaining: number;
}

function contextLine(gap: Gap, offset: number, newLines: readonly string[]): DiffLine {
  const newLineNo = gap.newStart + offset;
  return {
    type: 'context',
    oldLineNo: gap.oldStart + offset,
    newLineNo,
    content: newLines[newLineNo - 1] ?? '',
  };
}

export function renderGap(
  gap: Gap,
  expansion: Expansion,
  newLines: readonly string[],
): GapRender {
  const top = Math.max(0, Math.min(expansion.top, gap.size));
  const bottom = Math.max(0, Math.min(expansion.bottom, gap.size));

  if (top + bottom >= gap.size) {
    return {
      above: Array.from({ length: gap.size }, (_, k) => contextLine(gap, k, newLines)),
      below: [],
      remaining: 0,
    };
  }

  return {
    above: Array.from({ length: top }, (_, k) => contextLine(gap, k, newLines)),
    below: Array.from({ length: bottom }, (_, k) =>
      contextLine(gap, gap.size - bottom + k, newLines),
    ),
    remaining: gap.size - top - bottom,
  };
}

export function gapKey(path: string, index: number): string {
  return `${path}:${index}`;
}
