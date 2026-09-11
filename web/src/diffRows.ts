import type { DiffLine, FileDiff, Hunk } from './types.ts';

export interface SplitPair {
  left: DiffLine | null;
  right: DiffLine | null;
}

export function pairLines(lines: readonly DiffLine[]): SplitPair[] {
  const pairs: SplitPair[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    if (line.type === 'context') {
      pairs.push({ left: line, right: line });
      i++;
      continue;
    }

    const deletions: DiffLine[] = [];
    while (i < lines.length && lines[i]!.type === 'delete') deletions.push(lines[i++]!);

    const additions: DiffLine[] = [];
    while (i < lines.length && lines[i]!.type === 'add') additions.push(lines[i++]!);

    const rows = Math.max(deletions.length, additions.length);
    for (let k = 0; k < rows; k++) {
      pairs.push({ left: deletions[k] ?? null, right: additions[k] ?? null });
    }
  }

  return pairs;
}

export interface HunkPairs {
  hunk: Hunk;
  pairs: SplitPair[];
}

export function splitHunks(file: FileDiff): HunkPairs[] {
  return file.hunks.map((hunk) => ({ hunk, pairs: pairLines(hunk.lines) }));
}
