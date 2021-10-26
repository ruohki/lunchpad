import * as React from 'react';

import { AnimatePresence } from 'framer-motion';
import { v4 as uuid } from 'uuid';

import { Backdrop, Container } from './components';

interface ModalContextInterface {
  showModal(content: JSX.Element): string;
  closeModal(id: string): void;
}

interface ModalProps {
  id: string;
}

const modalContext = React.createContext<ModalContextInterface>({
  showModal: () => "",
  closeModal: () => null
});

const { Provider } = modalContext;

const Modal: React.FC<ModalProps> = ({ id, children }) => {
  return (
    <Container
      key={`modal-${id}`}
      positionTransition
      initial={{ opacity: 0, scale:  0 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0 }}
    >
      {children}
    </Container>
  )
}

const ModalProvider: React.FC = ({ children }) => {
  const [ modals, setModals ] = React.useState<JSX.Element[]>([])

  const closeModal = (id: string) => {
    setModals([...modals.filter(m => m.props.id !== id)])
  }

  const showModal = (content: JSX.Element): string => {
    const id = uuid();
    setModals([...modals, <Modal id={id} key={id} children={content} />]);
    return id;
  }

  return (
    <Provider value={{
      showModal,
      closeModal
    }}>
      <AnimatePresence initial={true}>
        {modals.length > 0 && (
          <Backdrop
            key="backdrop"
            initial={{ opacity: 0}}
            animate={{ opacity: 1}}
            exit={{ opacity: 0 }}
          >
            {modals.map( modal => modal)}
          </Backdrop>
        )}
      </AnimatePresence>
      {children}
    </Provider>
  )
}

export const useModal = (): [(content: JSX.Element) => void, () => void] => {
  const { showModal, closeModal } = React.useContext(modalContext);
  const [ id, setId ] = React.useState("");

  const close = () => {
    closeModal(id)
  }

  const open = (content: JSX.Element): void => {
    if (id) close();
    setId(showModal(content));
  }

  return [ open, close];
}

export const ModalContext = {
  Provider: ModalProvider,
  Context: modalContext,
  useModal
}