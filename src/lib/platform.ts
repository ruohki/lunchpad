import { useSettingsStore } from "../store/settings";
import type { ActionType, PlatformInfo, PlatformMissing } from "./api";

/** The parts of Lunchpad that depend on the system (see `platform.rs`). */
export type PlatformFeature = "input" | "windows" | "stayOnTop";

/** Actions that do nothing without a platform feature. */
const ACTION_FEATURES: Partial<Record<ActionType, PlatformFeature>> = {
  hotkey: "input",
  mouse: "input",
  mousePosition: "input",
  pushToTalkStart: "input",
  pushToTalkEnd: "input",
  getWindow: "windows",
  setWindow: "windows",
  getScreen: "windows",
};

/** Why `feature` is missing here, `null` when it works (or the system is not known yet). */
export function featureMissing(platform: PlatformInfo | null, feature: PlatformFeature): PlatformMissing | null {
  return platform?.[feature] ?? null;
}

/** The feature an action lacks on this system and why, `null` when it can run. */
export function actionMissing(platform: PlatformInfo | null, type: ActionType): { feature: PlatformFeature; why: PlatformMissing } | null {
  const feature = ACTION_FEATURES[type];
  const why = feature ? featureMissing(platform, feature) : null;
  return feature && why ? { feature, why } : null;
}

/** The translation key that explains a missing feature. */
export const missingKey = (feature: PlatformFeature, why: PlatformMissing) => `platform.missing.${feature}.${why}`;

export function useFeatureMissing(feature: PlatformFeature): PlatformMissing | null {
  return useSettingsStore((s) => featureMissing(s.platform, feature));
}
