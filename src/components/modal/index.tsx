import React, {ReactNode} from 'react';
import type { PropsWithChildren } from 'react';

import { v4 as uuid } from 'uuid';
import Backdrop from "./backdrop.tsx";
import Modal from "./modal.tsx";

export type ModalContextType = {
  showModal<T>(content: ReactNode, onClose?: () => T): string
  closeModal(id: string): void
}
const ModalContext = React.createContext<Partial<ModalContextType>>({});

type ModalWithMetadata = {
  modal: ReactNode,
  id: string
}

export const ModalProvider = (props: PropsWithChildren) => {
    const [ modals, setModals ] = React.useState<ModalWithMetadata[]>([])
    const closeModal = (id: string) => {
        setModals([...modals.filter(m => m.id !== id)])
    }

    const showModal = (content: ReactNode): string => {
        const id = uuid();
        const pusher: ModalWithMetadata = {
          id,

          modal: <Modal id={id} children={content} />
        }
        setModals([...modals, pusher ]);
        return id;
    }

    return (
        <ModalContext.Provider value={{
          showModal,
          closeModal
        }}>
          {modals.map(m => (
            <Backdrop key={m.id}>
              {m.modal}
            </Backdrop>
          ))}
          {props.children}
        </ModalContext.Provider>
    );
}

export const useModal = (): [(content: ReactNode) => void, () => void] => {
  const { showModal, closeModal } = React.useContext(ModalContext);
  const [ id, setId ] = React.useState<string>("")

  const close = () => {
    closeModal!(id)
  }

  const open = (content: ReactNode): void => {
    if (id) close();
    setId(showModal!(content));
  }

  return [ open, close];
}

/*
export function useModal() { return useContext(ModalContext); }*/
