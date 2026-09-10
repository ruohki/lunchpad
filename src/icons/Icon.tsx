import { clsx } from "clsx";
import { ICONS, type IconName } from "./icons";

interface Props {
  name: IconName;
  className?: string;
  title?: string;
}

/** Inline SVG icon that inherits the text colour and sizes with the font (1em). */
export function Icon({ name, className, title }: Props) {
  const icon = ICONS[name];
  return (
    <svg
      viewBox={icon.viewBox}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={clsx("inline-block h-[1em] w-[1em] shrink-0 fill-current align-[-0.125em]", className)}
      dangerouslySetInnerHTML={{ __html: icon.body }}
    />
  );
}
