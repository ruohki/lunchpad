import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { create } from "zustand";

export type UpdateStatus = "idle" | "checking" | "upToDate" | "available" | "installing" | "ready" | "error";

interface UpdateStore {
  status: UpdateStatus;
  version: string | null;
  notes: string | null;
  downloaded: number;
  total: number | null;
  error: string | null;
  /** the user closed the notice for this version */
  dismissed: boolean;
  check: (manual?: boolean) => Promise<void>;
  install: () => Promise<void>;
  dismiss: () => void;
}

let pending: Update | null = null;

/** Updates from GitHub releases through the Tauri updater; the About tab and the notices read this. */
export const useUpdateStore = create<UpdateStore>((set, get) => ({
  status: "idle",
  version: null,
  notes: null,
  downloaded: 0,
  total: null,
  error: null,
  dismissed: false,

  check: async (manual = false) => {
    const { status } = get();
    if (status === "checking" || status === "installing" || status === "ready") return;
    set({ status: "checking", error: null });
    try {
      const update = await check({ timeout: 15000 });
      pending = update;
      if (update) {
        set({ status: "available", version: update.version, notes: update.body ?? null, dismissed: false });
      } else {
        set({ status: "upToDate", version: null, notes: null });
      }
    } catch (e) {
      // Development builds and offline machines land here; only a manual check reports it.
      set({ status: manual ? "error" : "idle", error: manual ? String(e) : null });
    }
  },

  install: async () => {
    const update = pending;
    if (!update || get().status === "installing") return;
    set({ status: "installing", downloaded: 0, total: null, error: null });
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") set({ total: event.data.contentLength ?? null });
        else if (event.event === "Progress") set((s) => ({ downloaded: s.downloaded + event.data.chunkLength }));
        else if (event.event === "Finished") set({ status: "ready" });
      });
      set({ status: "ready" });
      await relaunch();
    } catch (e) {
      set({ status: "error", error: String(e) });
    }
  },

  dismiss: () => set({ dismissed: true }),
}));
