import { create } from "zustand";
import { faderAt, newFader } from "../lib/fader";
import { useDeviceStore } from "./device";
import {
  api,
  events,
  type Button,
  type Fader,
  type HistoryState,
  type ImportMode,
  type ImportReport,
  type Page,
  type Profile,
} from "../lib/api";

export interface PadRef {
  x: number;
  y: number;
}

interface EditorTarget extends PadRef {
  pageId: string;
}

interface ProfileStore {
  profile: Profile | null;
  clipboard: Button | null;
  editor: EditorTarget | null;
  faderEditor: { pageId: string; fader: Fader; isNew: boolean } | null;
  lastImport: ImportReport | null;
  error: string | null;
  /** Layout to edit while no device is connected (preview mode). */

  init: () => Promise<() => void>;
  activePage: () => Page | null;
  buttonAt: (x: number, y: number) => Button | null;

  setActivePage: (pageId: string) => Promise<void>;
  addPage: (name: string) => Promise<Page | null>;
  renamePage: (pageId: string, name: string) => Promise<void>;
  removePage: (pageId: string) => Promise<void>;
  duplicatePage: (pageId: string) => Promise<void>;
  movePage: (pageId: string, toIndex: number) => Promise<void>;

  openEditor: (x: number, y: number) => void;
  closeEditor: () => void;
  saveButton: (x: number, y: number, button: Button) => Promise<void>;
  openFaderEditor: (x: number, y: number) => void;
  closeFaderEditor: () => void;
  saveFader: (fader: Fader) => Promise<void>;
  removeFader: (faderId: string) => Promise<void>;
  moveFader: (faderId: string, x: number, y: number) => Promise<void>;
  clearButton: (x: number, y: number) => Promise<void>;
  copyButton: (x: number, y: number) => void;
  cutButton: (x: number, y: number) => Promise<void>;
  pasteButton: (x: number, y: number) => Promise<void>;
  moveButton: (from: PadRef, to: PadRef, copy: boolean) => Promise<void>;

  importLegacyFile: (path: string, mode: ImportMode) => Promise<ImportReport | null>;
  importPageFile: (path: string) => Promise<ImportReport | null>;
  exportPageFile: (pageId: string, path: string) => Promise<void>;
  restoreBackup: () => Promise<void>;
  clearError: () => void;
  /** Sound files referenced by actions that are gone from disk. */
  missingFiles: string[];
  missingDismissed: boolean;
  refreshMissing: () => Promise<void>;
  dismissMissing: () => void;
  /** Set right after a destructive edit so a toast can offer undo. */
  undoHint: number | null;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  dismissUndo: () => void;
  history: HistoryState;
}

let missingTimer: number | null = null;

async function guard<T>(set: (partial: Partial<ProfileStore>) => void, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    set({ error: String(e) });
    return null;
  }
}

/** Show the undo toast for a few seconds after a destructive edit. */
function offerUndo(set: (partial: Partial<ProfileStore>) => void, get: () => ProfileStore) {
  const at = Date.now();
  set({ undoHint: at });
  window.setTimeout(() => {
    if (get().undoHint === at) set({ undoHint: null });
  }, 8000);
}

export const useProfileStore = create<ProfileStore>((set, get) => ({
  profile: null,
  clipboard: null,
  editor: null,
  faderEditor: null,
  lastImport: null,
  error: null,
  missingFiles: [],
  missingDismissed: false,
  undoHint: null,
  history: { undo: 0, redo: 0 },

  init: async () => {
    const unlisten = await Promise.all([
      events.onProfile((profile) => {
        set({ profile });
        void get().refreshMissing();
      }),
      events.onHistory((history) => set({ history })),
    ]);
    const profile = await api.getProfile();
    set({ profile });
    void get().refreshMissing();
    api
      .historyState()
      .then((history) => set({ history }))
      .catch(() => undefined);
    return () => unlisten.forEach((fn) => fn());
  },

  activePage: () => {
    const p = get().profile;
    if (!p) return null;
    return p.pages.find((pg) => pg.id === p.activePage) ?? p.pages[0] ?? null;
  },

  buttonAt: (x, y) => {
    const page = get().activePage();
    return page?.buttons.find((b) => b.x === x && b.y === y) ?? null;
  },

  setActivePage: async (pageId) => {
    await guard(set, () => api.setActivePage(pageId));
  },
  addPage: async (name) => guard(set, () => api.addPage(name)),
  renamePage: async (pageId, name) => {
    await guard(set, () => api.renamePage(pageId, name));
  },
  removePage: async (pageId) => {
    await guard(set, () => api.removePage(pageId));
    offerUndo(set, get);
  },
  duplicatePage: async (pageId) => {
    await guard(set, () => api.duplicatePage(pageId));
  },
  movePage: async (pageId, toIndex) => {
    await guard(set, () => api.movePage(pageId, toIndex));
  },

  openEditor: (x, y) => {
    const page = get().activePage();
    if (page) set({ editor: { pageId: page.id, x, y } });
  },
  closeEditor: () => set({ editor: null }),

  openFaderEditor: (x, y) => {
    const page = get().activePage();
    if (!page) return;
    const hit = faderAt(page, x, y);
    const layout = useDeviceStore.getState().layout;
    set({ faderEditor: hit ? { pageId: page.id, fader: hit.fader, isNew: false } : { pageId: page.id, fader: newFader(x, y, layout), isNew: true } });
  },
  closeFaderEditor: () => set({ faderEditor: null }),
  saveFader: async (fader) => {
    const target = get().faderEditor;
    if (!target) return;
    await guard(set, () => api.setFader(target.pageId, fader));
    set({ faderEditor: null });
  },
  removeFader: async (faderId) => {
    const page = get().activePage();
    if (!page) return;
    await guard(set, () => api.removeFader(page.id, faderId));
    set({ faderEditor: null });
    offerUndo(set, get);
  },
  moveFader: async (faderId, x, y) => {
    const page = get().activePage();
    if (!page) return;
    await guard(set, () => api.moveFader(page.id, faderId, x, y));
  },

  saveButton: async (x, y, button) => {
    const page = get().activePage();
    if (!page) return;
    await guard(set, () => api.setButton(page.id, x, y, button));
  },
  clearButton: async (x, y) => {
    const page = get().activePage();
    if (!page) return;
    await guard(set, () => api.clearButton(page.id, x, y));
    offerUndo(set, get);
  },
  copyButton: (x, y) => {
    const button = get().buttonAt(x, y);
    if (button) {
      const { x: _x, y: _y, ...rest } = button as Button & PadRef;
      set({ clipboard: structuredClone(rest) });
    }
  },
  cutButton: async (x, y) => {
    get().copyButton(x, y);
    await get().clearButton(x, y);
  },
  pasteButton: async (x, y) => {
    const clip = get().clipboard;
    if (!clip) return;
    await get().saveButton(x, y, structuredClone(clip));
  },
  moveButton: async (from, to, copy) => {
    const page = get().activePage();
    if (!page) return;
    await guard(set, () => api.moveButton(page.id, from, to, copy));
  },

  importLegacyFile: async (path, mode) => {
    const report = await guard(set, () => api.importLegacyFile(path, mode));
    if (report) set({ lastImport: report });
    return report;
  },
  importPageFile: async (path) => {
    const report = await guard(set, () => api.importPageFile(path));
    if (report) set({ lastImport: report });
    return report;
  },
  exportPageFile: async (pageId, path) => {
    await guard(set, () => api.exportPageFile(pageId, path));
  },
  restoreBackup: async () => {
    await guard(set, () => api.restoreProfileBackup());
  },
  clearError: () => set({ error: null, lastImport: null }),

  refreshMissing: async () => {
    if (missingTimer !== null) window.clearTimeout(missingTimer);
    missingTimer = window.setTimeout(() => {
      missingTimer = null;
      api
        .missingSoundFiles()
        .then((missingFiles) => set({ missingFiles }))
        .catch(() => undefined);
    }, 400);
  },
  dismissMissing: () => set({ missingDismissed: true }),

  undo: async () => {
    const done = await guard(set, () => api.undoProfile());
    set({ undoHint: null });
    if (done === false) set({ error: null });
  },
  redo: async () => {
    await guard(set, () => api.redoProfile());
  },
  dismissUndo: () => set({ undoHint: null }),
}));
