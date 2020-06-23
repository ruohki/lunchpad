import * as React from 'react';
import * as lodash from 'lodash';
import { Split, Child } from './layout';

import Input from './input';
import { Button } from './button';

interface IFile {
  value?: string
  onChange?: (value: string) => void
  accept: string
  editable?: boolean
}

export const File: React.SFC<IFile> = ({ editable, accept, value, onChange, ...rest }) => {
  const inputRef = React.useRef<HTMLInputElement>();
  
  const onSelectFile = () => {
    if (inputRef.current !== undefined) {
      const savedValue = inputRef.current.value
      inputRef.current.value = "";
      inputRef.current.click();
    }
  }

  return (
    <Split direction="row">
      <input
        ref={inputRef}
        type="file"
        style={{ display: 'none'}}
        onChange={e => onChange(lodash.startsWith(e.target.files[0].path, 'file') ? e.target.files[0].path.replace('file://','') : e.target.files[0].path)}
        accept={accept}
      />
      <Child grow padding="0 1rem 0 0"><Input value={value.replace('file://','')} onChange={(e) => editable ? onChange(e.target.value) : {}}/></Child>
      <Child><Button padding="4px 10px 8px 10px" height="33px" onClick={onSelectFile}>Select</Button></Child>
    </Split>
  )
}

File.defaultProps = {
  value: "",
  onChange: () => {},
  accept: "*",
  editable: false,
}