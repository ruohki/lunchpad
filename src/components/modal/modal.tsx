import type {PropsWithChildren} from "react";

export type ModalProps = {
  id: string
}
export const Modal = (props: PropsWithChildren<ModalProps>) => {
  return (
    <div
      className="bg-dark-700 rounded-md w-[600px] h-[600px] shadow-md overflow-hidden p-3"
    >
      {props.children}
    </div>
  )
}

export default Modal