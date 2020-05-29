import { useEffect, useState } from 'react';

export const useFocus = (ref, defaultState = false) => {

  const [state, setState] = useState(defaultState);

  useEffect(() => {
    const current = ref.current;

    const onFocus = () => setState(true);
    const onBlur = () => setState(false);

    current.addEventListener('focus', onFocus);
    current.addEventListener('blur', onBlur);

    return () => {
      current.removeEventListener('focus', onFocus);
      current.removeEventListener('blur', onBlur);
    };

  }, [ ref ]);

  return state;
};