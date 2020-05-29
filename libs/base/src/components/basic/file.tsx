import * as React from 'react';
import styled from 'styled-components';
import { Split, Child } from './layout';

import Input from './input';
import { Button } from './button';

interface IFile {
  value?: string
  onChange?: (value: string) => void
}

export const File: React.SFC<IFile> = ({ value, onChange, ...rest }) => {
  //const [ file, setFile ] = React.useState<string>(props.file);
  const inputRef = React.useRef<HTMLInputElement>();
  
  const onSelectFile = () => {
    if (inputRef.current !== undefined) {
      inputRef.current.click();
    }
  }

  return (
    <Split direction="row">
      <input
        ref={inputRef}
        type="file"
        style={{ display: 'none'}}
        onChange={e => onChange(e.target.files[0].path)}
        accept="audio/*"
      />
      <Child grow padding="0 1rem 0 0"><Input value={value} onChange={() => {}}/></Child>
      <Child><Button padding="4px 10px 8px 10px" height="33px" onClick={onSelectFile}>Select</Button></Child>
    </Split>
  )
}

File.defaultProps = {
  value: "",
  onChange: () => {}
}