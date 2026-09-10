import type { ObsState, SlobsState, StateLink } from "./api";

/**
 * Whether a button's "active while" link currently holds. Mirrors
 * `StateLink::is_active` in src-tauri/src/live.rs, which drives the LEDs.
 */
export function isLinkActive(link: StateLink | null | undefined, obs: ObsState | null, slobs: SlobsState | null): boolean {
  if (!link) return false;
  const p =
    link.provider === "obs"
      ? obs && {
          connected: obs.connected,
          scene: obs.currentScene,
          visible: obs.visible,
          muted: obs.muted,
          streaming: obs.streaming,
          recording: obs.recording,
          replay: obs.replayBuffer,
        }
      : slobs && {
          connected: slobs.connected,
          scene: slobs.currentScene,
          visible: slobs.visible,
          muted: slobs.muted,
          streaming: slobs.streaming !== "offline",
          recording: slobs.recording !== "offline",
          replay: slobs.replayBuffer !== "offline",
        };
  if (!p || !p.connected) return false;
  switch (link.kind) {
    case "scene":
      return !!link.scene && p.scene === link.scene;
    case "sourceVisible": {
      const scene = link.scene || p.scene;
      return !!scene && p.visible.some(([s, src]) => s === scene && src === link.source);
    }
    case "sourceMuted":
      return p.muted.includes(link.source);
    case "streaming":
      return p.streaming;
    case "recording":
      return p.recording;
    case "replayBuffer":
      return p.replay;
    default:
      return false;
  }
}
