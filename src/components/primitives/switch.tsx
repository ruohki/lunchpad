import { PropsWithChildren } from "react";
import { classNames } from "../../lib/utils";

type CheckboxType = "Default" | "Primary" | "Danger"

interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>,'type'> {
  type?: CheckboxType
  label: string
}

export const Switch = ({ type = "Default", label = "", ...rest}: PropsWithChildren<SwitchProps>) => {
  return (
    <div className="rounded">
      <label className="h-6 relative flex">
        <input type="checkbox" {...rest}
          className={classNames(
            "w-14 h-0 cursor-pointer",
            "focus:outline-0 ",
            "focus:ring-offset-transparent ",
            "focus:ring-transparent ",
            "focus-within:ring-0 ",
            "focus:shadow-none ",
            
            "after:absolute before:absolute",
            "after:top-0 before:top-0",
            "after:block before:inline-block",
            "before:rounded-full after:rounded-full",
        
            "after:content-[''] after:w-3 after:h-3 after:mt-1.5 after:ml-1.5",
            "after:shadow-md after:duration-100",
        
            "before:content-[''] before:w-12 before:h-full",
            /** bg-dark-800/[.50] hover:bg-dark-800/[.85] border-2 border-dark-500/[.45] */
            "before:border-2 before:border-dark-500/[.45]",
            "before:bg-dark-800/[.50] hover:before:bg-dark-800/[.85]",
            "before:shadow-switch",
            "after:shadow-[inset_0_0_10px_rgba(0,0,0,.5)]",
            type == "Default" ? "after:checked:bg-white after:border-white/[.50]" : null,
            type == "Primary" ? "after:checked:bg-blurple-500" : null,
            type == "Danger" ? "after:checked:bg-redish-500" : null,
            "after:bg-dark-400 after:shadow-inner after:-translate-y-[0.5px]",
            "checked:after:translate-x-6",
            "checked:after:w-4 checked:after:h-4 checked:after:mt-[0.275rem] checked:after:ml-[0.225rem]"
          )}
        />
        <span className="-translate-y-[1px]">

        {label}
        </span>
      </label>
    </div>
  );
};

export default Switch;