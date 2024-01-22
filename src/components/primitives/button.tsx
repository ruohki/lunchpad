import type { PropsWithChildren } from 'react';
import { classNames } from "../../lib/utils.ts";
import React from 'react';

type ButtonType = "Default" | "Primary" | "Danger" | "Light"

interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>,'type'> {
  type: ButtonType
  label: string
}

export const Button = ({ type = "Default", label = "", ...rest }: PropsWithChildren<Partial<ButtonProps>>) => {
  return (
    <button {...rest}
      className={classNames(
        "px-[50px] pt-[4px] pb-[8px]",
        "border-2 rounded-lg shadow", 
        type == 'Default' ? "bg-dark-800/[.50] hover:bg-dark-800/[.85] border-2 border-dark-500/[.45]" : null,
        type == 'Primary' ? "bg-gradient-to-br from-blurple-500 to-blurple-600 hover:from-blurple-500/[.85] hover:to-blurple-600/[.85] border-blurple-700" : null,
        type == 'Danger' ? "bg-gradient-to-br from-redish-500 to-redish-600 hover:from-redish-500/[.85] hover:to-redish-600/[.85] border-redish-700" : null,
        type == 'Light' ? "bg-transparent hover:underline border-transparent shadow-none" : null,
      )}
    >{label}</button>
  )
}

export default Button