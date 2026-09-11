import { describe, expect, it } from 'vitest';
import { pairLines } from '../src/diffRows.ts';
import { selectionRange, type Selection } from '../src/selection.ts';
import { tokensForLine, type FileTokens } from '../src/tokens.ts';
import {
  composerBelongsHere,
  indexComments,
  isSelected,
  locationKey,
} from '../src/components/diffShared.ts';
import type { Comment, DiffLine } from '../src/types.ts';

function line(type: DiffLine['type'], oldNo: number | null, newNo: number | null, content = 'x'): DiffLine {
  return { type, oldLineNo: oldNo, newLineNo: newNo, content };
}

function selection(over: Partial<Selection> = {}): Selection {
  return { path: 'a.ts', side: 'new', anchorLine: 3, headLine: 5, dragging: false, ...over };
}

function comment(over: Partial<Comment> = {}): Comment {
  return {
    id: 'c1',
    path: 'a.ts',
    anchor: {
      side: 'new',
      startLine: 4,
      endLine: 4,
      lineHashes: ['h'],
      lineTexts: ['x'],
      beforeHashes: [],
      afterHashes: [],
    },
    tag: 'nit',
    body: 'b',
    createdAt: '',
    updatedAt: '',
    state: 'anchored',
    resolvedStartLine: 4,
    resolvedEndLine: 4,
    ...over,
  };
}

describe('pairLines', () => {
  it('puts a context line on both sides', () => {
    const ctx = line('context', 1, 1);
    expect(pairLines([ctx])).toEqual([{ left: ctx, right: ctx }]);
  });

  it('zips a rewritten line so before and after share a row', () => {
    const del = line('delete', 2, null, 'before');
    const add = line('add', null, 2, 'after');

    expect(pairLines([del, add])).toEqual([{ left: del, right: add }]);
  });

  it('leaves blanks opposite the longer run', () => {
    const dels = [line('delete', 2, null), line('delete', 3, null)];
    const add = line('add', null, 2);
    const pairs = pairLines([...dels, add]);

    expect(pairs).toHaveLength(2);
    expect(pairs[1]).toEqual({ left: dels[1], right: null });
  });

  it('handles additions with no deletions before them', () => {
    const add = line('add', null, 5);
    expect(pairLines([add])).toEqual([{ left: null, right: add }]);
  });

  it('keeps runs separated by context apart', () => {
    const rows = pairLines([
      line('delete', 1, null),
      line('context', 2, 1),
      line('add', null, 2),
    ]);

    expect(rows.map((r) => [r.left?.type ?? null, r.right?.type ?? null])).toEqual([
      ['delete', null],
      ['context', 'context'],
      [null, 'add'],
    ]);
  });
});

describe('selectionRange', () => {
  it('orders a downward drag', () => {
    expect(selectionRange(selection({ anchorLine: 3, headLine: 5 }))).toEqual({ start: 3, end: 5 });
  });

  it('orders an upward drag', () => {
    expect(selectionRange(selection({ anchorLine: 5, headLine: 3 }))).toEqual({ start: 3, end: 5 });
  });
});

describe('isSelected', () => {
  it('covers the whole dragged range', () => {
    const s = selection();
    expect([2, 3, 4, 5, 6].map((n) => isSelected(s, 'a.ts', 'new', n))).toEqual([
      false, true, true, true, false,
    ]);
  });

  it('ignores the other side and other files', () => {
    const s = selection();
    expect(isSelected(s, 'a.ts', 'old', 4)).toBe(false);
    expect(isSelected(s, 'other.ts', 'new', 4)).toBe(false);
    expect(isSelected(null, 'a.ts', 'new', 4)).toBe(false);
    expect(isSelected(s, 'a.ts', 'new', null)).toBe(false);
  });
});

describe('composerBelongsHere', () => {
  it('sits under the last line of the range', () => {
    const s = selection();
    expect(composerBelongsHere(s, 'a.ts', 'new', 5)).toBe(true);
    expect(composerBelongsHere(s, 'a.ts', 'new', 3)).toBe(false);
  });

  it('stays hidden while the drag is still in progress', () => {
    expect(composerBelongsHere(selection({ dragging: true }), 'a.ts', 'new', 5)).toBe(false);
  });
});

describe('indexComments', () => {
  it('indexes by the resolved line, not the stored one', () => {
    const moved = comment({ state: 'moved', resolvedStartLine: 9, resolvedEndLine: 9 });
    const index = indexComments([moved]);

    expect(index.get(locationKey('new', 9))).toHaveLength(1);
    expect(index.get(locationKey('new', 4))).toBeUndefined();
  });

  it('leaves orphaned and file-level comments unplaced', () => {
    const index = indexComments([
      comment({ id: 'a', state: 'orphaned' }),
      comment({ id: 'b', anchor: null, resolvedEndLine: undefined }),
    ]);

    expect(index.size).toBe(0);
  });

  it('groups several comments on one line', () => {
    const index = indexComments([comment({ id: 'a' }), comment({ id: 'b' })]);
    expect(index.get(locationKey('new', 4))).toHaveLength(2);
  });
});

describe('tokensForLine', () => {
  const tokens: FileTokens = {
    old: [[{ content: 'old text', offset: 0 }]],
    new: [[{ content: 'new ', offset: 0 }, { content: 'text', offset: 4 }]],
  } as FileTokens;

  it('reads added lines from the new side', () => {
    expect(tokensForLine(line('add', null, 1, 'new text'), tokens)).toHaveLength(2);
  });

  it('reads deleted lines from the old side', () => {
    expect(tokensForLine(line('delete', 1, null, 'old text'), tokens)).toHaveLength(1);
  });

  it('refuses tokens that no longer match the diff line', () => {
    expect(tokensForLine(line('add', null, 1, 'something else'), tokens)).toBeNull();
  });

  it('returns null past the end of the token array', () => {
    expect(tokensForLine(line('add', null, 99, 'x'), tokens)).toBeNull();
  });

  it('returns null when nothing was highlighted', () => {
    expect(tokensForLine(line('add', null, 1, 'new text'), { old: null, new: null })).toBeNull();
  });
});
