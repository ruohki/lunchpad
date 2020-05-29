import React, { useRef } from 'react';
import keyboardJs from 'keyboardjs';

import { useFocus } from '@lunchpad/hooks'
import { Split, Child, Input, Button } from '@lunchpad/base';

export default ({ value = [], onChange = (keyCodes: string[]) => [] }) => {
  const ref = useRef();
  
  const [ events, setEvents ] = React.useState<KeyboardEvent[]>([])
  const [ key, setKeys ] = React.useState<string[]>(value);
  const hasFocus = useFocus(ref)
  
  const clear = (e: any) => {
    setEvents([]);
    setKeys([]);
    onChange([]);
  }

  React.useEffect(() => {
    const down = e => {
      if (!hasFocus) return;
      if (!events.find(event => event.keyCode === e.keyCode)) {
        setEvents([...events, e ]);

        if (events.length <= 0) {
          setKeys([ e.key.toString() ]);
          onChange([ e.key.toString() ])
        } else {
          setKeys([...key, e.key.toString() ]);
          onChange([...key, e.key.toString() ])
        }
        
      }
    };

    const up = e => {
      setEvents([])
    };

    keyboardJs.bind("", down, up);

    return () => {
      keyboardJs.unbind("", down, up);
    };
  });

  return (
    <Split direction="row">
      <Child grow padding="0 1rem 0 0">
        <Input ref={ref} value={key.join(" + ")} onChange={() => true} />
      </Child>
      <Child>
        <Button padding="4px 15px 8px 15px" onClick={clear}>Clear</Button>
      </Child>
    </Split>
  )
}

