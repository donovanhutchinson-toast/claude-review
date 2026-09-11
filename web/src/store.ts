import { create } from 'zustand';
import type { CommentTag, Draft, FileDiff, ReviewModel, Side } from './types.ts';
import { EXPAND_STEP, gapKey, type Expansion } from './gaps.ts';
import * as api from './api.ts';
import type { Selection } from './selection.ts';

export type { Selection } from './selection.ts';
export { selectionRange } from './selection.ts';

function initialViewMode(): ViewMode {
  return new URLSearchParams(window.location.search).get('view') === 'split' ? 'split' : 'unified';
}

const SIDEBAR_KEY = 'claude-review:sidebar';
const WRAP_KEY = 'claude-review:wrap';

function remembered(key: string, fallback: boolean, offValue: string): boolean {
  try {
    const stored = window.localStorage.getItem(key);
    return stored === null ? fallback : stored !== offValue;
  } catch {
    return fallback;
  }
}

function remember(key: string, value: boolean, onValue: string, offValue: string): void {
  try {
    window.localStorage.setItem(key, value ? onValue : offValue);
  } catch {
  }
}

type Status = 'loading' | 'ready' | 'error';
export type ViewMode = 'unified' | 'split';

interface ReviewState {
  model: ReviewModel | null;
  draft: Draft | null;
  status: Status;
  error: string | null;
  saving: boolean;
  saveError: string | null;

  activePath: string | null;
  collapsed: ReadonlySet<string>;
  viewMode: ViewMode;
  selection: Selection | null;

  preview: string | null;
  submitting: boolean;
  submitResult: api.SubmitResult | null;

  sidebarOpen: boolean;
  wrap: boolean;
  shortcutsOpen: boolean;
  stale: boolean;
  expansions: Readonly<Record<string, Expansion>>;
  composingPath: string | null;

  load: () => Promise<void>;
  setActivePath: (path: string | null) => void;
  toggleCollapsed: (path: string) => void;
  setViewMode: (mode: ViewMode) => void;

  beginSelection: (path: string, side: Side, line: number) => void;
  extendSelection: (path: string, side: Side, line: number) => void;
  endSelection: () => void;
  clearSelection: () => void;

  setComposingPath: (path: string | null) => void;
  toggleSidebar: () => void;
  toggleWrap: () => void;
  toggleShortcuts: () => void;
  setStale: (stale: boolean) => void;
  expandGap: (path: string, index: number, edge: 'top' | 'bottom' | 'all', size: number) => void;
  setViewed: (file: FileDiff, viewed: boolean) => Promise<void>;

  openPreview: () => Promise<void>;
  closePreview: () => void;
  submit: () => Promise<void>;
  dismissResult: () => void;

  addComment: (input: api.NewCommentInput) => Promise<void>;
  editComment: (id: string, patch: { tag?: CommentTag; body?: string }) => Promise<void>;
  removeComment: (id: string) => Promise<void>;
  setOverall: (text: string) => Promise<void>;
}

export const useReview = create<ReviewState>((set, get) => {
  const write = async (op: () => Promise<Draft>): Promise<void> => {
    set({ saving: true, saveError: null });
    try {
      set({ draft: await op() });
    } catch (err) {
      set({ saveError: (err as Error).message });
    } finally {
      set({ saving: false });
    }
  };

  return {
    model: null,
    draft: null,
    status: 'loading',
    error: null,
    saving: false,
    saveError: null,

    activePath: null,
    collapsed: new Set<string>(),
    viewMode: initialViewMode(),
    selection: null,

    preview: null,
    submitting: false,
    submitResult: null,

    sidebarOpen: remembered(SIDEBAR_KEY, true, 'closed'),
    wrap: remembered(WRAP_KEY, true, 'off'),
    shortcutsOpen: false,
    stale: false,
    expansions: {},
    composingPath: null,

    load: async () => {
      set({ status: 'loading', error: null });
      try {
        const { model, draft } = await api.fetchReview();
        const previous = get().activePath;

        set({
          model,
          draft,
          status: 'ready',
          stale: false,
          activePath: model.files.some((f) => f.path === previous)
            ? previous
            : (model.files[0]?.path ?? null),
        });
      } catch (err) {
        set({ status: 'error', error: (err as Error).message });
      }
    },

    setActivePath: (activePath) => set({ activePath }),

    toggleCollapsed: (path) =>
      set((state) => {
        const next = new Set(state.collapsed);
        if (!next.delete(path)) next.add(path);
        return { collapsed: next };
      }),

    setViewMode: (viewMode) => set({ viewMode, selection: null }),

    beginSelection: (path, side, line) =>
      set({ selection: { path, side, anchorLine: line, headLine: line, dragging: true } }),

    extendSelection: (path, side, line) =>
      set((state) => {
        const current = state.selection;
        if (!current?.dragging || current.path !== path || current.side !== side) return {};
        return { selection: { ...current, headLine: line } };
      }),

    endSelection: () =>
      set((state) =>
        state.selection ? { selection: { ...state.selection, dragging: false } } : {},
      ),

    clearSelection: () => set({ selection: null }),

    setComposingPath: (composingPath) => set({ composingPath }),

    toggleSidebar: () =>
      set((state) => {
        const sidebarOpen = !state.sidebarOpen;
        remember(SIDEBAR_KEY, sidebarOpen, 'open', 'closed');
        return { sidebarOpen };
      }),

    toggleWrap: () =>
      set((state) => {
        const wrap = !state.wrap;
        remember(WRAP_KEY, wrap, 'on', 'off');
        return { wrap };
      }),

    toggleShortcuts: () => set((state) => ({ shortcutsOpen: !state.shortcutsOpen })),

    setStale: (stale) => set({ stale }),

    expandGap: (path, index, edge, size) =>
      set((state) => {
        const key = gapKey(path, index);
        const current = state.expansions[key] ?? { top: 0, bottom: 0 };

        const next: Expansion =
          edge === 'all'
            ? { top: size, bottom: 0 }
            : edge === 'top'
              ? { ...current, top: current.top + EXPAND_STEP }
              : { ...current, bottom: current.bottom + EXPAND_STEP };

        return { expansions: { ...state.expansions, [key]: next } };
      }),

    setViewed: (file, viewed) =>
      write(() => api.putViewed(file.path, viewed ? file.digest : null)),

    openPreview: async () => {
      set({ saveError: null });
      try {
        set({ preview: (await api.fetchPreview()).markdown });
      } catch (err) {
        set({ saveError: (err as Error).message });
      }
    },

    closePreview: () => set({ preview: null }),

    submit: async () => {
      set({ submitting: true, saveError: null });
      try {
        const submitResult = await api.submitReview();
        set({ submitResult, preview: null });
        await get().load();
      } catch (err) {
        set({ saveError: (err as Error).message });
      } finally {
        set({ submitting: false });
      }
    },

    dismissResult: () => set({ submitResult: null }),

    addComment: async (input) => {
      await write(() => api.createComment(input));
      set({ selection: null });
    },

    editComment: (id, patch) => write(() => api.updateComment(id, patch)),
    removeComment: (id) => write(() => api.deleteComment(id)),
    setOverall: (text) => write(() => api.putOverall(text)),
  };
});
