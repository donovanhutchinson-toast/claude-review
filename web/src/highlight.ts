import { createHighlighterCore, type HighlighterCore, type ThemedToken } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import githubDark from '@shikijs/themes/github-dark';
import githubLight from '@shikijs/themes/github-light';
import { loaderFor } from './languages.ts';

export type TokenLine = ThemedToken[];

const LIGHT = 'github-light';
const DARK = 'github-dark';

let corePromise: Promise<HighlighterCore> | null = null;
const languageLoads = new Map<string, Promise<void>>();

function core(): Promise<HighlighterCore> {
  corePromise ??= createHighlighterCore({
    themes: [githubLight, githubDark],
    langs: [],
    engine: createJavaScriptRegexEngine(),
  });
  return corePromise;
}

export function isHighlightable(language: string | null): language is string {
  return loaderFor(language) !== null;
}

function loadLanguage(highlighter: HighlighterCore, language: string): Promise<void> {
  let pending = languageLoads.get(language);
  if (!pending) {
    const load = loaderFor(language);
    if (!load) return Promise.reject(new Error(`no grammar for ${language}`));

    pending = highlighter.loadLanguage(load().then((m) => m.default)).then(() => undefined);
    languageLoads.set(language, pending);
  }
  return pending;
}

export async function highlightFile(
  text: string,
  language: string,
  dark: boolean,
): Promise<TokenLine[] | null> {
  try {
    const highlighter = await core();
    await loadLanguage(highlighter, language);

    return highlighter.codeToTokens(text, { lang: language, theme: dark ? DARK : LIGHT }).tokens;
  } catch {
    return null;
  }
}

export const FONT_ITALIC = 1;
export const FONT_BOLD = 2;
export const FONT_UNDERLINE = 4;
