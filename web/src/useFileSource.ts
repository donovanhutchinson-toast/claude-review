import { useEffect, useState } from 'react';
import type { FileDiff } from './types.ts';
import { fetchFile } from './api.ts';
import { highlightFile, isHighlightable } from './highlight.ts';
import { NO_TOKENS, type FileTokens } from './tokens.ts';
import { useDarkMode } from './useDarkMode.ts';

export interface FileSource {
  tokens: FileTokens;
  newLines: string[] | null;
  oldLines: string[] | null;
}

const EMPTY: FileSource = { tokens: NO_TOKENS, newLines: null, oldLines: null };

function splitLines(text: string): string[] {
  const lines = text.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

export function useFileSource(file: FileDiff, enabled: boolean): FileSource {
  const dark = useDarkMode();
  const [source, setSource] = useState<FileSource>(EMPTY);

  const { path, oldPath, language, skipped } = file;
  const needsOld = file.hunks.some((h) => h.lines.some((l) => l.type === 'delete'));
  const needsNew = file.newLineCount > 0;

  useEffect(() => {
    if (!enabled || skipped) {
      setSource(EMPTY);
      return;
    }

    let cancelled = false;

    void (async () => {
      const [oldFile, newFile] = await Promise.all([
        needsOld ? fetchFile(oldPath ?? path, 'old').catch(() => null) : null,
        needsNew ? fetchFile(path, 'new').catch(() => null) : null,
      ]);
      if (cancelled) return;

      const oldText = oldFile?.content ?? null;
      const newText = newFile?.content ?? null;

      const [oldTokens, newTokens] = isHighlightable(language)
        ? await Promise.all([
            oldText ? highlightFile(oldText, language, dark) : null,
            newText ? highlightFile(newText, language, dark) : null,
          ])
        : [null, null];

      if (cancelled) return;
      setSource({
        tokens: { old: oldTokens, new: newTokens },
        oldLines: oldText === null ? null : splitLines(oldText),
        newLines: newText === null ? null : splitLines(newText),
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, skipped, language, path, oldPath, needsOld, needsNew, dark]);

  return source;
}
