import { Icon } from "../icons/Icon";
import type { IconName } from "../icons/icons";

/** Printed labels that are drawn as icons rather than text. */
const CHEVRONS: Record<string, IconName> = { "∧": "ChevronUp", "∨": "ChevronDown", ">": "ChevronRight", "<": "ChevronLeft" };

/** A printed label: chevrons as icons, everything else as text. */
export function PadLabel({ label, size }: { label: string | null; size: number }) {
  if (!label) return null;
  const icon = CHEVRONS[label];
  return icon ? (
    <span className="inline-flex" style={{ fontSize: size * 1.15 }}>
      <Icon name={icon} />
    </span>
  ) : (
    <>{label}</>
  );
}
