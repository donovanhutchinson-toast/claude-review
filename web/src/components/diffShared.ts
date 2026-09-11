import type { Comment, DiffLine, Side } from '../types.ts';
import { selectionRange, type Selection } from '../selection.ts';

export type CommentIndex = Map<string, Comment[]>;

export function locationKey(side: Side, lineNo: number): string {
  return `${side}:${lineNo}`;
}

export function indexComments(comments: readonly Comment[]): CommentIndex {
  const index: CommentIndex = new Map();

  for (const comment of comments) {
    if (!comment.anchor || comment.state === 'orphaned') continue;
    if (comment.resolvedEndLine === undefined) continue;

    const key = locationKey(comment.anchor.side, comment.resolvedEndLine);
    const bucket = index.get(key);
    if (bucket) bucket.push(comment);
    else index.set(key, [comment]);
  }

  return index;
}

export function lineNumberFor(line: DiffLine, side: Side): number | null {
  return side === 'old' ? line.oldLineNo : line.newLineNo;
}

export function isSelected(
  selection: Selection | null,
  path: string,
  side: Side,
  lineNo: number | null,
): boolean {
  if (!selection || lineNo === null) return false;
  if (selection.path !== path || selection.side !== side) return false;

  const { start, end } = selectionRange(selection);
  return lineNo >= start && lineNo <= end;
}

export function composerBelongsHere(
  selection: Selection | null,
  path: string,
  side: Side,
  lineNo: number | null,
): boolean {
  if (!selection || selection.dragging || lineNo === null) return false;
  if (selection.path !== path || selection.side !== side) return false;

  return selectionRange(selection).end === lineNo;
}
