import type { InputHTMLAttributes, PropsWithChildren } from 'react';
import { classNames } from "../../lib/utils.ts";


export const Input = (props: PropsWithChildren<InputHTMLAttributes<HTMLInputElement>>) => {
  return (
    <input {...props}
      className={classNames(
        "py-1.5 px-3 w-full outline-none",
        "border-2 rounded-lg shadow transition-colors duration-250",
        "bg-dark-800/[.50] hover:bg-dark-800/[.85] border-2 border-dark-500/[.45] focus:border-dark-500/[.85] focus:bg-dark-800/[.85]"
      )}
    />
  )
}

export default Input