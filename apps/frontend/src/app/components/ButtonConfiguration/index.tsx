import * as React from 'react';

import {
  COLOR_BLACK,
  Outer,
  Split,
  Child,
  Button,
  Input,
  COLOR_REDISH,
  ScrollBox,
  IconButton,
  Switch
} from '@lunchpad/base';

import {
  Button as ControllerButton,
  Color,
  Action,
} from '@lunchpad/types';

import { Tab, Divider, Row } from '../Settings/components';
import { Border } from './components';
import { StyledCircle } from '../Colorpicker/components';
import { Small, Limited } from '../Colorpicker/palettes';
import { FullPillPicker } from '../Colorpicker/full';
import { ActionEditor } from '../ActionEditor';
import { IconLongArrowAltDown, IconLongArrowAltUp } from '@lunchpad/icons';

interface IButtonConfigDialog {
  button: ControllerButton
  onCancel: () => void
  onAccept: (button: ControllerButton) => void
  limitedColor?: boolean
}

const ButtonConfigDialog: React.SFC<IButtonConfigDialog> = props => {
  const { button, onCancel, onAccept, limitedColor } = props;
  const [title, setTitle] = React.useState<string>(props.button.title ?? '');
  
  const [loop, setLoop] = React.useState<boolean>(props.button.loop);

  const [color, setColor] = React.useState<Color>({
    r: button.color.r,
    g: button.color.g,
    b: button.color.b
  });

  const [ activeTab, setTab ] = React.useState<number>(0);

  const [ pressed, setPressed ] = React.useState<Action[]>(button.pressed);
  const [ released, setReleased ] = React.useState<Action[]>(button.released);
  
  const accept = () => {
    const btn = new ControllerButton(title, button.x, button.y, {
      r: color.r,
      g: color.g,
      b: color.b
    });
    btn.pressed = pressed;
    btn.released = released;
    btn.loop = loop;

    onAccept(btn);
  };

  const header = (
    <>
      <IconButton active={activeTab === 0} icon={<IconLongArrowAltDown />} onClick={() => setTab(0)}>Pressed ({pressed.length} action(s))</IconButton>
      <span style={{ marginLeft: '1rem', marginRight: '1rem', color: "hsla(0,0%,5%,1)"}}> </span>
      <IconButton active={activeTab === 1} icon={<IconLongArrowAltUp />} onClick={() => setTab(1)}>Released ({released.length} action(s))</IconButton>
    </>
  )

  return (
    <Outer height="100%">
      <Split height="100%">
        <Child>
          <Split direction="row" width="100%" backgroundColor={COLOR_BLACK}>
            <Child>
              <Tab active title="Settings" />
            </Child>
          </Split>
        </Child>
        <Child grow height="100%" padding="1rem 0.5rem 0 1rem">
          <ScrollBox padding="0 0 0 0">
            <Split direction="column" width="100%">
              <Row title="Title">
                <Input value={title} onChange={e => setTitle(e.target.value)} />
              </Row>
              <Row title="Color">

                  <Split direction="row">
                    {limitedColor ? (
                      <Child grow padding="0 0 0.5rem 0">
                      <StyledCircle
                        color={color}
                        onChange={c => setColor(c.rgb)}
                        width="100%"
                        circleSize={14}
                        colors={Limited}
                      />
                    </Child>
                    ) : (
                      <>
                        <Child basis="40%">
                          <FullPillPicker
                            color={color}
                            onChange={c => setColor(c.rgb)}
                          />
                        </Child>
                        <Child basis="60%" align="center" margin="-3px 0 0 0">
                          <StyledCircle
                            color={color}
                            onChange={c => setColor(c.rgb)}
                            width="100%"
                            circleSize={16}
                            colors={Small}
                          />
                        </Child>
                      </>
                    )}
                  </Split>

              </Row>
              <Row title="">
                <Split direction="row">
                  <Child padding="0 1rem 0 0">
                    <Switch
                      value={loop}
                      onChange={setLoop}
                    />
                  </Child>
                  <Child grow>
                    <span>Loop the pressed actions</span>
                  </Child>
                </Split>
              </Row>
              <Child padding="1rem 0.5rem 0 0">
                <Divider />
              </Child>
              <Child padding="0 1rem 0 0">
                {activeTab === 0 && <ActionEditor
                  header={header}
                  actions={pressed}
                  onChange={setPressed}
                />}
                {activeTab === 1 && <ActionEditor
                  header={header}
                  actions={released}
                  onChange={setReleased}
                />}
              </Child>
            </Split>
          </ScrollBox>
        </Child>
        <Child padding="1rem">
          <Divider />
        </Child>
        <Child>
          <Split direction="row" justify="flex-end">
            <Child margin="0 0 1rem 1rem" basis="0">
              <Button
                padding="4px 25px 8px 25px"
                color={COLOR_REDISH}
                onClick={onCancel}
              >
                Cancel
              </Button>
            </Child>
            <Child margin="0 1rem 1rem 1rem" basis="0">
              <Button padding="4px 25px 8px 25px" onClick={accept}>
                Accept
              </Button>
            </Child>
          </Split>
        </Child>
      </Split>
    </Outer>
  );
};

ButtonConfigDialog.defaultProps = {
  limitedColor: false
}

export default ButtonConfigDialog;
