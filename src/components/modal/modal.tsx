import type {PropsWithChildren} from "react";

export type ModalProps = {
  id: string
}
export const Modal = (props: PropsWithChildren<ModalProps>) => {
  return (
    <div
      className="bg-dark-700  w-[600px] h-[600px] shadow-xl overflow-hidden border-2 border-dark-500/[.45] rounded-lg outline-0"
    >
      {props.children}
    </div>
  )
}

export default Modal