import type { DiffLine } from '../types.ts';
import { FONT_BOLD, FONT_ITALIC, FONT_UNDERLINE, type TokenLine } from '../highlight.ts';

function tokenStyle(color?: string, fontStyle?: number): React.CSSProperties {
  return {
    color,
    ...(fontStyle && fontStyle & FONT_ITALIC ? { fontStyle: 'italic' as const } : {}),
    ...(fontStyle && fontStyle & FONT_BOLD ? { fontWeight: 600 } : {}),
    ...(fontStyle && fontStyle & FONT_UNDERLINE ? { textDecoration: 'underline' } : {}),
  };
}

const MARKER: Record<DiffLine['type'], string> = { add: '+', delete: '−', context: ' ' };

export function LineContent({ line, tokens }: { line: DiffLine; tokens: TokenLine | null }) {
  return (
    <>
      <span className="select-none opacity-40">{MARKER[line.type]}</span>
      {tokens
        ? tokens.map((token, i) => (
            <span key={i} style={tokenStyle(token.color, token.fontStyle)}>
              {token.content}
            </span>
          ))
        : line.content}
      {line.noNewlineAtEof && (
        <span className="italic opacity-50"> ⏎ no newline at end of file</span>
      )}
    </>
  );
}
