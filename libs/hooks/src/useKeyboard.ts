import { useEffect, useState } from 'react';
import keyboardJs from 'keyboardjs';

const useKeyboardJs = (combination: string | string[]) => {
  const [state, set] = useState<[boolean, null | KeyboardEvent]>([false, null]);

  useEffect(() => {

    const down = event => set([true, event]);
    const up = event => set([false, event]);
    keyboardJs.bind(combination, down, up);

    return () => {
      keyboardJs.unbind(combination, down, up);
    };
  }, [combination]);

  return state;
};

export default useKeyboardJs;