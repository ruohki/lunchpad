import * as React from 'react';
import * as lodash from 'lodash';


import { AnimatePresence, motion } from 'framer-motion';
import { Split, Child, Tooltip, IconButton, PillList, } from '@lunchpad/base'
import { Icon, Plus } from '@lunchpad/icons';
import { AudioContext, MenuContext } from '@lunchpad/contexts';

import AddActionMenu from '../ContextMenu/addAction';
import { useSettings  } from '@lunchpad/hooks';
import { OBSStudioContext } from '../../contexts/obs-studio';
import { ActionType, Action, PairedAction } from '../../actions';
import { PlaySound, PlaySoundPill } from '../../actions/playsound';
import { Delay, DelayPill } from '../../actions/delay';
import { SwitchPage, SwitchPagePill } from '../../actions/switchpage';
import { StopAllMacros, StopAllMacrosPill } from '../../actions/stopallmacros';
import { RestartThisMacro, RestartThisMacroPill } from '../../actions/restartthismacro';
import { TextToSpeech, TextToSpeechPill } from '../../actions/tts';
import { LaunchApp, LaunchAppPill } from '../../actions/launchapp';
import { Hotkey } from '../../actions/hotkey/classes';
import { StopThisMacro, StopThisMacroPill } from '../../actions/stopthismacro';
import { PushToTalkStart, PushToTalkEnd, PushToTalkStartPill, PushToTalkEndPill } from '../../actions/pushtotalk';
import { FlipFlopStart, FlipFlopMiddle, FlipFlopEnd, FlipFlopStartPill, FlipFlopMiddlePill, FlipFlopEndPill } from '../../actions/flipflop';
import { SetColor, SetColorPill } from '../../actions/setcolor';
import { OBSToggleSource, OBSToggleSourcePill } from '../../actions/obs-studio/togglesource';
import { OBSSwitchScene, OBSSwitchScenePill, OBSSaveReplayPill, OBSSaveReplay } from '../../actions/obs-studio';
import { HotkeyPill } from '../../actions/hotkey/components';
import { settingsLabels } from '@lunchpad/types';
import { LayoutContext } from '../../contexts/layout';
import { OBSToggleStreaming, OBSToggleStreamingPill } from '../../actions/obs-studio/togglestreaming';
import { OBSToggleFilter, OBSToggleFilterPill } from '../../actions/obs-studio/togglefilter';
import { OBSToggleMixer, OBSToggleMixerPill } from '../../actions/obs-studio/setaudio';

interface IActionEditor {
  header: JSX.Element
  actions: Action[]
  onChange: (actions: Action[]) => void
  limitedColors: boolean
}

export const ActionEditor: React.SFC<IActionEditor> = (props) => {
  const { showContextMenu, closeMenu } = React.useContext(MenuContext.Context);
  const { outputDevices } = React.useContext(AudioContext.Context);
  const { pages } = React.useContext(LayoutContext.Context);
  const { currentScene, currentCollection, scenes, collections, sceneItems, sources, getSourceFilters } = React.useContext(OBSStudioContext.Context);
  
  const [ outputDevice ] = useSettings(settingsLabels.soundOutput, "default");

  const addAction = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    showContextMenu(
      e.clientX,
      e.clientY,
      <AddActionMenu
        onSelect={key => {
          if (key === ActionType.PlaySound) {
            props.onChange([...props.actions, new PlaySound('', outputDevice)]);
          } else if (key === ActionType.Delay) {
            props.onChange([...props.actions, new Delay(1000)]);
          } else if (key === ActionType.SwitchPage) {
            props.onChange([...props.actions, new SwitchPage('default')]);
          } else if (key === ActionType.StopAllMacros) {
            props.onChange([...props.actions, new StopAllMacros()]);
          } else if (key === ActionType.RestartThisMacro) {
            props.onChange([...props.actions, new RestartThisMacro()]);
          } else if (key === ActionType.TextToSpeech) {
            props.onChange([...props.actions, new TextToSpeech('1, 2, 3!')]);
          } else if (key === ActionType.LaunchApplication) {
            props.onChange([...props.actions, new LaunchApp()]);
          } else if (key === ActionType.PressAHotkey) {
            props.onChange([...props.actions, new Hotkey() ]);
          } else if (key === ActionType.StopThisMacro) {
            props.onChange([...props.actions, new StopThisMacro() ]);
          } else if (key === ActionType.PushToTalkStart) {
            const start = new PushToTalkStart();
            const end = new PushToTalkEnd(start.id);
            start.endId = end.id;
            props.onChange([start, ...props.actions, end ]);
          } else if (key === ActionType.FlipFlopStart) {
            if (lodash.some(props.actions, a => a.type === ActionType.FlipFlopStart)) return;
            const start = new FlipFlopStart();
            const middle = new FlipFlopMiddle(start.id)
            const end = new FlipFlopEnd(start.id, middle.id);
            start.endId = end.id;
            start.middleId = middle.id;
            middle.endId = end.id;
            props.onChange([...props.actions, start, middle, end ]);
          } else if (key === ActionType.SetColor) {
            props.onChange([...props.actions, new SetColor() ]);
          } else if (key === ActionType.OBSSwitchScene) {
            props.onChange([...props.actions, new OBSSwitchScene(currentScene, currentCollection)]);
          } else if (key === ActionType.OBSToggleSource) {
            props.onChange([...props.actions, new OBSToggleSource(currentScene, currentCollection, sceneItems[0].name ?? "")]);
          } else if (key === ActionType.OBSStartStopStream) {
            props.onChange([...props.actions, new OBSToggleStreaming()]);
          } else if (key === ActionType.OBSSaveReplayBuffer) {
            props.onChange([...props.actions, new OBSSaveReplay()]);
          } else if (key === ActionType.OBSToggleFilter) {
            props.onChange([...props.actions, new OBSToggleFilter()]);
          } else if (key === ActionType.OBSToggleMixer) {
            props.onChange([...props.actions, new OBSToggleMixer(currentScene, currentCollection, sceneItems[0].name ?? "")]);
          }
        }}
        onClose={closeMenu}
      />,
      300, 600
    );
  };

  const moveActionUp = (id: string) => {
    const idx = lodash.findIndex(props.actions, a => a.id === id);
    const temp = props.actions[idx];
    props.actions[idx] = props.actions[idx - 1];
    props.actions[idx - 1] = temp;
    props.onChange([...props.actions]);
  };

  const moveActionDown = (id: string) => {
    const idx = lodash.findIndex(props.actions, a => a.id === id);
    const temp = props.actions[idx];
    props.actions[idx] = props.actions[idx + 1];
    props.actions[idx + 1] = temp;
    props.onChange([...props.actions]);
  };

  const removeAction = (id: string) => {
    props.onChange([...props.actions.filter(a => a.id !== id)]);
  };

  const multiRemoveAction = (ids: string[]) => {
    props.onChange([...props.actions.filter(a => !lodash.includes(ids, a.id))]);
  }

  const updateAction = (action: Action) => {
    props.onChange([...props.actions.map(a => (a.id === action.id ? action : a))]);
  };

  const canMoveUp = (id: string): boolean => {
    const idx = lodash.findIndex(props.actions, a => a.id === id);
    if (idx <= 0) return false;
    if (!(props.actions[idx] instanceof PairedAction)) return true;
    const el1 = props.actions[idx] as PairedAction;
    return !el1.isOther(props.actions[idx - 1])
  }

  const canMoveDown = (id: string): boolean => {
    const idx = lodash.findIndex(props.actions, a => a.id === id);
    if (idx >= props.actions.length - 1) return false;
    if (!(props.actions[idx] instanceof PairedAction)) return true;
    const el1 = props.actions[idx] as PairedAction;
    return !el1.isOther(props.actions[idx + 1])
  }

  const pills = props.actions.map((action, i) => {
    const pillDefaults = {
      onChange: action => updateAction(action),
      onRemove: removeAction,
      onMoveUp: canMoveUp(action.id) ? () => moveActionUp(action.id) : null,
      onMoveDown: canMoveDown(action.id) ? () => moveActionDown(action.id) : null,
    };

    if (action.type === ActionType.Delay)
      return (
        <DelayPill
          key={action.id}
          action={action as Delay}
          {...pillDefaults}
        />
      );
    else if (action.type === ActionType.PlaySound)
      return (
        <PlaySoundPill
          key={action.id}
          outputDevices={outputDevices}
          action={action as PlaySound}
          {...pillDefaults}
        />
      );
    else if (action.type === ActionType.PushToTalkStart) {
      const { onRemove, ...rest } = pillDefaults;
      return (
        <PushToTalkStartPill
          key={action.id}
          action={action as PushToTalkStart}
          onRemove={() => multiRemoveAction([action.id, (action as PushToTalkStart).endId])}
          {...rest}
        />
      );
    } else if (action.type === ActionType.PushToTalkEnd) {
      const { onRemove, ...rest } = pillDefaults;
      return (
        <PushToTalkEndPill
          key={action.id}
          action={action as PushToTalkEnd}
          onRemove={() => multiRemoveAction([action.id, (action as PushToTalkEnd).startId])}
          {...rest}
        />
      );
    } else if (action.type === ActionType.FlipFlopStart) {
      const { onRemove, ...rest } = pillDefaults;
      return (
        <FlipFlopStartPill
          key={action.id}
          action={action as FlipFlopStart}
          onRemove={() => multiRemoveAction([action.id, (action as FlipFlopStart).endId, (action as FlipFlopStart).middleId])}
          {...rest}
        />
      );
    } else if (action.type === ActionType.FlipFlopMiddle) {
      const { onRemove, ...rest } = pillDefaults;
      return (
        <FlipFlopMiddlePill
          key={action.id}
          action={action as FlipFlopMiddle}
          onRemove={() => multiRemoveAction([action.id, (action as FlipFlopMiddle).endId, (action as FlipFlopMiddle).startId])}
          {...rest}
        />
      );
    } else if (action.type === ActionType.FlipFlopEnd) {
      const { onRemove, ...rest } = pillDefaults;
      return (
        <FlipFlopEndPill
          key={action.id}
          action={action as FlipFlopEnd}
          onRemove={() => multiRemoveAction([action.id, (action as FlipFlopEnd).middleId, (action as FlipFlopEnd).startId])}
          {...rest}
        />
      );
    } else if (action.type === ActionType.SwitchPage)
      return (
        <SwitchPagePill
          key={action.id}
          pages={pages.map(p => ({ id: p.id, name: p.name }))}
          action={action as SwitchPage}
          {...pillDefaults}
        />
      );
    else if (action.type === ActionType.StopAllMacros)
      return (
        <StopAllMacrosPill
          key={action.id}
          action={action as StopAllMacros}
          {...pillDefaults}
        />
      );
    else if (action.type === ActionType.StopThisMacro)
      return (
        <StopThisMacroPill
          key={action.id}
          action={action as StopThisMacro}
          {...pillDefaults}
        />
      );
    else if (action.type === ActionType.RestartThisMacro)
      return (
        <RestartThisMacroPill
          key={action.id}
          action={action as RestartThisMacro}
          {...pillDefaults}
        />
      );
    else if (action.type === ActionType.TextToSpeech)
      return (
        <TextToSpeechPill
          key={action.id}
          action={action as TextToSpeech}
          {...pillDefaults}
        />
      );
    else if (action.type === ActionType.PressAHotkey)
      return (
        <HotkeyPill
          key={action.id}
          action={action as Hotkey}
          showMenu={showContextMenu}
          closeMenu={closeMenu}
          {...pillDefaults}
        />
      );
    else if (action.type === ActionType.LaunchApplication)
      return (
        <LaunchAppPill
          key={action.id}
          action={action as LaunchApp}
          {...pillDefaults}
        />
      );
    else if (action.type === ActionType.SetColor)
      return (
        <SetColorPill
          showContextMenu={showContextMenu}
          limitedColor={props.limitedColors}
          key={action.id}
          action={action as SetColor}
          {...pillDefaults}
        />
      );
    else if (action.type === ActionType.OBSSwitchScene)
      return (
        <OBSSwitchScenePill
          scenes={scenes}
          collections={collections}
          currentCollection={currentCollection}
          key={action.id}
          action={action as OBSSwitchScene}
          {...pillDefaults}
        />
      );
    else if (action.type === ActionType.OBSToggleSource)
      return (
        <OBSToggleSourcePill
          scenes={scenes}
          collections={collections}
          currentCollection={currentCollection}
          currentScene={currentScene}
          sources={sceneItems}
          key={action.id}
          action={action as OBSToggleSource}
          {...pillDefaults}
        />
      );
    else if (action.type === ActionType.OBSToggleMixer)
      return (
        <OBSToggleMixerPill
          scenes={scenes}
          collections={collections}
          currentCollection={currentCollection}
          currentScene={currentScene}
          sources={sceneItems}
          key={action.id}
          action={action as OBSToggleMixer}
          {...pillDefaults}
        />
      );
    else if (action.type === ActionType.OBSToggleFilter)
      return (
        <OBSToggleFilterPill
          key={action.id}
          action={action as OBSToggleFilter}
          {...pillDefaults}
        />
      );
    else if (action.type === ActionType.OBSStartStopStream)
      return (
        <OBSToggleStreamingPill
          key={action.id}
          action={action as OBSToggleStreaming}
          {...pillDefaults}
        />
      );
    else if (action.type === ActionType.OBSSaveReplayBuffer)
      return (
        <OBSSaveReplayPill
          key={action.id}
          action={action as OBSSaveReplay}
          {...pillDefaults}
        />
      );
    else return <React.Fragment key={'empty'} />;
  });

  return (
    <PillList
      header={
        <Split direction={'row'}>
          <Child grow padding="0 0 0 1rem">
            {props.header}
          </Child>
          <Child padding="1rem">
            <Tooltip title="Add a new action to the end of the list of actions.">
              <IconButton icon={<Icon icon={Plus} />} onClick={addAction}>Add action...</IconButton>
            </Tooltip>
          </Child>
        </Split>
      }
    >
      <AnimatePresence>
        {pills.map(p => (
          <motion.div
            positionTransition={{
              type: 'spring',
              damping: 30,
              stiffness: 200
            }}
            initial={{ opacity: 0, translateX: -100 }}
            animate={{ opacity: 1, translateX: 0 }}
            exit={{ opacity: 0, translateX: 100 }}
            key={p.props.action.id}
          >
            {p}
          </motion.div>
        ))}
      </AnimatePresence>
    </PillList>
  )
}

