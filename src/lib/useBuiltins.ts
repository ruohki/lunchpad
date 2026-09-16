import { useMemo } from "react";
import { useDeviceStore } from "../store/device";
import { useMediaStore } from "../store/media";
import { useVariablesStore } from "../store/variables";
import type { BuiltinEnv } from "./placeholders";

/** The surroundings the provided variables describe, read from the stores. */
export function useBuiltinEnv(): BuiltinEnv {
  const obs = useMediaStore((s) => s.obs);
  const slobs = useMediaStore((s) => s.slobs);
  const device = useDeviceStore((s) => s.device);
  const info = useVariablesStore((s) => s.info);
  return useMemo(() => ({ obs, slobs, device, info }), [obs, slobs, device, info]);
}
