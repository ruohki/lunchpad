import type { LaunchpadModel } from "./api";

/** The hub's model ids (see the hub's `MODELS`) for the app's models. */
const HUB_MODELS: Record<LaunchpadModel, string> = {
  LaunchpadMiniMk3: "mini-mk3",
  LaunchpadX: "x",
  LaunchpadMk2: "mk2",
  LaunchpadProMk3: "pro-mk3",
  LaunchpadProMk2: "pro-mk2",
  LaunchpadLegacy: "legacy",
  LaunchkeyMiniMk3: "launchkey-mini",
  LaunchkeyMiniMk4: "launchkey-mini",
};

export const hubModelId = (model: LaunchpadModel | null | undefined): string | null => (model ? (HUB_MODELS[model] ?? null) : null);
