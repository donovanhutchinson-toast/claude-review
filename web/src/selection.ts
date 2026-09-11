import type { Side } from './types.ts';

export interface Selection {
  path: string;
  side: Side;
  anchorLine: number;
  headLine: number;
  dragging: boolean;
}

export function selectionRange(s: Selection): { start: number; end: number } {
  return s.anchorLine <= s.headLine
    ? { start: s.anchorLine, end: s.headLine }
    : { start: s.headLine, end: s.anchorLine };
}
