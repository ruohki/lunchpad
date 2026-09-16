import { create } from "zustand";
import { api, events, type HubApplyTarget, type HubBackup, type HubDelivery, type HubShareRequest, type HubShareResult, type HubState, type HubUpdateRequest, type ImportReport, type ImportReview } from "../lib/api";

interface HubStore {
  state: HubState | null;
  /** The last thing that arrived while the inbox was closed, for a notice. */
  arrival: HubDelivery | null;
  inboxOpen: boolean;
  error: string | null;
  init: () => Promise<() => void>;
  openInbox: () => void;
  closeInbox: () => void;
  dismissArrival: () => void;
  clearError: () => void;
  linkStart: () => Promise<void>;
  linkCancel: () => Promise<void>;
  signOut: () => Promise<void>;
  setUrl: (url: string) => Promise<void>;
  fetchListing: (reference: string) => Promise<boolean>;
  dismiss: (id: string) => Promise<void>;
  review: (id: string, target: HubApplyTarget | null) => Promise<ImportReview | null>;
  apply: (id: string, target: HubApplyTarget) => Promise<ImportReport | null>;
  share: (request: HubShareRequest) => Promise<HubShareResult>;
  update: (request: HubUpdateRequest) => Promise<HubShareResult>;
  /** Whether the shared list was checked against the hub in this session. */
  sharedSynced: boolean;
  syncShared: () => Promise<void>;
  forgetShared: (listingId: string) => Promise<void>;
  backups: HubBackup[] | null;
  loadBackups: () => Promise<void>;
  backupNow: (name: string, model: string | null) => Promise<HubBackup | null>;
  deleteBackup: (id: string) => Promise<void>;
  restoreBackup: (id: string) => Promise<void>;
}

async function guard<T>(set: (partial: Partial<HubStore>) => void, fn: () => Promise<T>): Promise<T | null> {
  try {
    set({ error: null });
    return await fn();
  } catch (e) {
    set({ error: String(e) });
    return null;
  }
}

/** The community hub: sign-in state and the inbox of things sent to this app. */
export const useHubStore = create<HubStore>((set, get) => ({
  state: null,
  arrival: null,
  inboxOpen: false,
  error: null,

  init: async () => {
    const unlisten = await events.onHubState((next) => {
      const known = new Set(get().state?.inbox.map((d) => d.id) ?? []);
      const fresh = next.inbox.filter((d) => !known.has(d.id) && !d.fetched);
      set({ state: next });
      if (fresh.length > 0 && !get().inboxOpen) set({ arrival: fresh[fresh.length - 1] });
    });
    set({ state: await api.hubState() });
    return unlisten;
  },

  openInbox: () => set({ inboxOpen: true, arrival: null }),
  closeInbox: () => set({ inboxOpen: false }),
  dismissArrival: () => set({ arrival: null }),
  clearError: () => set({ error: null }),

  linkStart: async () => {
    const state = await guard(set, () => api.hubLinkStart());
    if (state) set({ state });
  },
  linkCancel: async () => {
    const state = await guard(set, () => api.hubLinkCancel());
    if (state) set({ state });
  },
  signOut: async () => {
    const state = await guard(set, () => api.hubSignOut());
    if (state) set({ state });
  },
  setUrl: async (url) => {
    const state = await guard(set, () => api.hubSetUrl(url));
    if (state) set({ state });
  },
  fetchListing: async (reference) => {
    const state = await guard(set, () => api.hubFetchListing(reference));
    if (state) set({ state, inboxOpen: true });
    return state !== null;
  },
  dismiss: async (id) => {
    const state = await guard(set, () => api.hubDismissDelivery(id));
    if (state) set({ state });
  },
  review: (id, target) => guard(set, () => api.hubReviewDelivery(id, target)),
  apply: (id, target) => guard(set, () => api.hubApplyDelivery(id, target)),
  // The share dialog shows its own errors, so this one throws instead of storing them.
  share: (request) => api.hubShare(request),
  update: (request) => api.hubUpdateListing(request),
  sharedSynced: false,
  syncShared: async () => {
    set({ sharedSynced: true });
    const state = await guard(set, () => api.hubSyncShared());
    if (state) set({ state });
  },
  forgetShared: async (listingId) => {
    const state = await guard(set, () => api.hubForgetShared(listingId));
    if (state) set({ state });
  },
  backups: null,
  loadBackups: async () => {
    const backups = await guard(set, () => api.hubListBackups());
    if (backups) set({ backups });
  },
  backupNow: async (name, model) => {
    const backup = await guard(set, () => api.hubBackupNow(name, model));
    if (backup) await get().loadBackups();
    return backup;
  },
  deleteBackup: async (id) => {
    const backups = await guard(set, () => api.hubDeleteBackup(id));
    if (backups) set({ backups });
  },
  restoreBackup: async (id) => {
    const state = await guard(set, () => api.hubRestoreBackup(id));
    if (state) set({ state, inboxOpen: true });
  },
}));
