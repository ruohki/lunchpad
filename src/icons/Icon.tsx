import { clsx } from "clsx";
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleStop,
  Code,
  Copy,
  File,
  FileOutput,
  Globe,
  GripVertical,
  House,
  Keyboard,
  LayoutGrid,
  Maximize2,
  Mic,
  MicOff,
  MousePointerClick,
  Palette,
  Pencil,
  Radio,
  RefreshCw,
  RotateCcw,
  Settings,
  SlidersHorizontal,
  Speech,
  Split,
  SquareTerminal,
  Timer,
  Trash,
  Variable,
  Video,
  Volume2,
  Workflow,
  X,
} from "lucide-react";

/** Every icon the app draws, by its Lucide name; add one here to use it by name. */
const ICONS = {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleStop,
  Code,
  Copy,
  File,
  FileOutput,
  Globe,
  GripVertical,
  House,
  Keyboard,
  LayoutGrid,
  Maximize2,
  Mic,
  MicOff,
  MousePointerClick,
  Palette,
  Pencil,
  Radio,
  RefreshCw,
  RotateCcw,
  Settings,
  SlidersHorizontal,
  Speech,
  Split,
  SquareTerminal,
  Timer,
  Trash,
  Variable,
  Video,
  Volume2,
  Workflow,
  X,
};

export type IconName = keyof typeof ICONS;

interface Props {
  name: IconName;
  className?: string;
  title?: string;
}

/** A Lucide icon that inherits the text colour and sizes with the font (1em). */
export function Icon({ name, className, title }: Props) {
  const Glyph = ICONS[name];
  return (
    <Glyph
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      strokeWidth={2}
      className={clsx("inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]", className)}
    />
  );
}
