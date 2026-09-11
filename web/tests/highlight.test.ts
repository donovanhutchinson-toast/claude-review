import { describe, expect, it } from 'vitest';
import { highlightFile, isHighlightable } from '../src/highlight.ts';
import { LANGUAGES, loaderFor } from '../src/languages.ts';

describe('the grammar manifest', () => {
  it('offers a loader for the languages the CLI can report', () => {
    expect(isHighlightable('typescript')).toBe(true);
    expect(isHighlightable('rust')).toBe(true);
  });

  it('treats plain text as needing no grammar', () => {
    expect(LANGUAGES).toHaveProperty('plaintext');
    expect(loaderFor('plaintext')).toBeNull();
    expect(isHighlightable('plaintext')).toBe(false);
  });

  it('declines languages it does not ship', () => {
    expect(isHighlightable(null)).toBe(false);
    expect(isHighlightable('wolfram')).toBe(false);
    expect(isHighlightable('')).toBe(false);
  });
});

describe('highlightFile', () => {
  it('tokenizes a whole file, one entry per line', async () => {
    const tokens = await highlightFile('const a = 1;\nconst b = 2;\n', 'typescript', false);

    expect(tokens).not.toBeNull();
    expect(tokens![0]!.map((t) => t.content).join('')).toBe('const a = 1;');
    expect(tokens![1]!.map((t) => t.content).join('')).toBe('const b = 2;');
    expect(tokens![0]!.every((t) => typeof t.color === 'string')).toBe(true);

    expect(tokens!.slice(2).every((line) => line.length === 0)).toBe(true);
  });

  it('keeps a block comment coloured across the lines it spans', async () => {
    const tokens = await highlightFile('/* one\n   two */\nlive();\n', 'typescript', false);

    expect(tokens).not.toBeNull();
    const [first, second] = tokens!;
    expect(first![0]!.color).toBe(second![0]!.color);
  });

  it('loads more than one grammar in a session', async () => {
    const rust = await highlightFile('fn main() {}\n', 'rust', false);
    const python = await highlightFile('def f(): pass\n', 'python', true);

    expect(rust).not.toBeNull();
    expect(python).not.toBeNull();
  });

  it('returns null rather than throwing for a grammar it does not have', async () => {
    expect(await highlightFile('x', 'wolfram', false)).toBeNull();
  });
});
