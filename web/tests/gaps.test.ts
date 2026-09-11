import { describe, expect, it } from 'vitest';
import { gapsFor, renderGap, EXPAND_STEP, type Gap } from '../src/gaps.ts';
import type { FileDiff, Hunk } from '../src/types.ts';

function hunk(oldStart: number, oldLines: number, newStart: number, newLines: number): Hunk {
  return { oldStart, oldLines, newStart, newLines, lines: [] };
}

function file(hunks: Hunk[], newLineCount: number): FileDiff {
  return {
    path: 'a.ts', oldPath: null, status: 'modified', similarity: null, language: 'typescript',
    binary: false, skipped: null, additions: 0, deletions: 0,
    oldLineCount: newLineCount, newLineCount, oldSize: 0, newSize: 0, digest: 'd', hunks,
  };
}

const CONTENT = Array.from({ length: 120 }, (_, i) => `line ${i + 1}`);

describe('gapsFor', () => {
  it('finds nothing when the diff starts at line 1 and runs to the end', () => {
    expect(gapsFor(file([hunk(1, 10, 1, 10)], 10))).toEqual([]);
  });

  it('finds the stretch before the first hunk', () => {
    const [gap] = gapsFor(file([hunk(31, 5, 31, 5)], 35));

    expect(gap).toMatchObject({ kind: 'leading', index: 0, oldStart: 1, newStart: 1, size: 30 });
  });

  it('finds the stretch between two hunks', () => {
    const gaps = gapsFor(file([hunk(1, 5, 1, 5), hunk(40, 5, 42, 5)], 50));
    const middle = gaps.find((g) => g.kind === 'middle');

    expect(middle).toMatchObject({ index: 1, oldStart: 6, newStart: 6, size: 36 });
  });

  it('finds the stretch after the last hunk', () => {
    const gaps = gapsFor(file([hunk(1, 5, 1, 5)], 40));
    const trailing = gaps.find((g) => g.kind === 'trailing');

    expect(trailing).toMatchObject({ index: 1, newStart: 6, size: 35 });
  });

  it('drops zero-length gaps rather than rendering empty expanders', () => {
    const gaps = gapsFor(file([hunk(1, 5, 1, 5), hunk(6, 5, 6, 5)], 10));
    expect(gaps).toEqual([]);
  });

  it('numbers gaps so each hunk boundary has its own', () => {
    const gaps = gapsFor(file([hunk(20, 2, 20, 2), hunk(60, 2, 60, 2)], 100));
    expect(gaps.map((g) => [g.kind, g.index])).toEqual([
      ['leading', 0],
      ['middle', 1],
      ['trailing', 2],
    ]);
  });
});

describe('renderGap', () => {
  const gap: Gap = { index: 1, kind: 'middle', oldStart: 6, newStart: 6, size: 36 };

  it('shows nothing until expanded', () => {
    const r = renderGap(gap, { top: 0, bottom: 0 }, CONTENT);
    expect([r.above.length, r.below.length, r.remaining]).toEqual([0, 0, 36]);
  });

  it('grows downward from the hunk above', () => {
    const r = renderGap(gap, { top: EXPAND_STEP, bottom: 0 }, CONTENT);

    expect(r.above).toHaveLength(20);
    expect(r.above[0]).toMatchObject({ oldLineNo: 6, newLineNo: 6, content: 'line 6' });
    expect(r.above[19]).toMatchObject({ newLineNo: 25, content: 'line 25' });
    expect(r.remaining).toBe(16);
  });

  it('grows upward from the hunk below', () => {
    const r = renderGap(gap, { top: 0, bottom: 10 }, CONTENT);

    expect(r.below).toHaveLength(10);
    expect(r.below[0]).toMatchObject({ newLineNo: 32, content: 'line 32' });
    expect(r.below[9]).toMatchObject({ newLineNo: 41, content: 'line 41' });
  });

  it('collapses into one block once the two ends meet', () => {
    const r = renderGap(gap, { top: 30, bottom: 30 }, CONTENT);

    expect(r.above).toHaveLength(36);
    expect(r.below).toEqual([]);
    expect(r.remaining).toBe(0);
  });

  it('never runs past the end of the gap', () => {
    const r = renderGap(gap, { top: 999, bottom: 0 }, CONTENT);

    expect(r.above).toHaveLength(36);
    expect(r.remaining).toBe(0);
  });

  it('keeps both sides numbered when they are offset', () => {
    const offset: Gap = { index: 1, kind: 'middle', oldStart: 6, newStart: 8, size: 5 };
    const r = renderGap(offset, { top: 2, bottom: 0 }, CONTENT);

    expect(r.above[0]).toMatchObject({ oldLineNo: 6, newLineNo: 8, content: 'line 8' });
    expect(r.above[1]).toMatchObject({ oldLineNo: 7, newLineNo: 9 });
  });

  it('yields empty content rather than undefined past the file end', () => {
    const beyond: Gap = { index: 0, kind: 'trailing', oldStart: 1, newStart: 500, size: 2 };
    expect(renderGap(beyond, { top: 2, bottom: 0 }, CONTENT).above[0]!.content).toBe('');
  });
});
