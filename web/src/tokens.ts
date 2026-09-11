import type { DiffLine } from './types.ts';
import type { TokenLine } from './highlight.ts';

export interface FileTokens {
  old: TokenLine[] | null;
  new: TokenLine[] | null;
}

export const NO_TOKENS: FileTokens = { old: null, new: null };

export function tokensForLine(line: DiffLine, tokens: FileTokens): TokenLine | null {
  const source = line.type === 'delete' ? tokens.old : tokens.new;
  const lineNo = line.type === 'delete' ? line.oldLineNo : line.newLineNo;
  if (!source || lineNo === null) return null;

  const candidate = source[lineNo - 1];
  if (!candidate) return null;

  const text = candidate.map((t) => t.content).join('');
  return text === line.content ? candidate : null;
}
