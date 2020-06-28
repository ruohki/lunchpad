import * as React from 'react';
import lodash from 'lodash';

import { Icon, OBS } from '@lunchpad/icons';
import { Split, Child, Row, Select, Button, Input, Switch } from '@lunchpad/base';

import Pill from '../../pill'
import { OBSToggleSource } from './classes';
import { SceneItem } from 'obs-websocket-js';

interface IOBSToggleSourcePill {
  currentCollection: string
  currentScene: string
  collections: string[]
  scenes: string[]
  sources: SceneItem[]
  action: OBSToggleSource
  expanded?: boolean
  onChange?: (action: OBSToggleSource) => void
  onRemove?: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}

export const OBSToggleSourcePill: React.SFC<IOBSToggleSourcePill> = (props) => {
  const [ showBody, setExpanded ] = React.useState<boolean>(props.expanded);
  
  const setVisibility = (val: boolean) => props.onChange(lodash.set(props.action, 'visible', val));
  const setSource = (val: string) => props.onChange(lodash.set(props.action, 'sourceName', val));
  const setScene = (val: string) => props.onChange(lodash.set(props.action, 'sceneName', val));
  const setCollection = (val: string) => props.onChange(lodash.set(props.action, 'collectionName', val));

  const collectionExists = lodash.includes(props.collections, props.action.collectionName)
  const currentCollectionActive = props.currentCollection === props.action.collectionName;
  const currentSceneActive = currentCollectionActive && props.currentScene === props.action.sceneName;

  const sceneExists = props.currentCollection === props.action.collectionName && lodash.includes(props.scenes, props.action.sceneName)
  const sourceExists = props.currentCollection === props.action.collectionName && lodash.includes(props.sources.map(s => s.name), props.action.sourceName)

  //const sourceExists = props.
  const Expanded = (
    <Split direction="row">
      <Child grow whiteSpace="nowrap" padding="0 1rem 0 0"><div style={{textOverflow: "ellipsis", overflow: "hidden"}}>OBS: {props.action.visible ? 'Enable' : 'Disable'} {props.action.sourceName}</div></Child>
    </Split>
  )

  return (
    <Pill
      isExpanded={showBody}
      icon={<Icon icon={OBS} />}
      expanded={Expanded}
      collapsed={Expanded}
      onRemove={() => props.onRemove(props.action.id)}
      onMoveUp={props.onMoveUp ? () => props.onMoveUp(props.action.id) : null}
      onMoveDown={props.onMoveDown ? () => props.onMoveDown(props.action.id) : null}
      onExpand={() => setExpanded(true)}
      onCollapse={() => setExpanded(false)}
    >
      <Split padding="0 0 1rem 0">
        <Child padding="1rem 0 0 1rem">
          <p>Only if the scene collection you choose is active in OBS-Studio you will get a scene dropdown for that specific scene collection</p>
        </Child>
        <Row title="Collection:">
          <Select
            value={props.action.collectionName}
            onChange={(e) => setCollection(e.target.value)}
          >
            {props.collections.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Row>
        <Row title="Scene:">
          {currentCollectionActive ? (
            <Select
              value={props.action.sceneName}
              onChange={e => setScene(e.target.value)}
            >
              {!sceneExists && <option disabled value={props.action.sceneName}>Unknown scene ({props.action.sceneName})</option>}
              {props.scenes.map(scene => <option key={scene} value={scene}>{scene}</option>)}
            </Select>
          ) : (
            <Input value={props.action.sceneName} onChange={(e) => setScene(e.target.value)} />
          )}
        </Row>
        <Row title="Source:">
          {currentSceneActive ? (
            <Select
              value={props.action.sourceName}
              onChange={e => setSource(e.target.value)}
            >
              {!sourceExists && <option disabled value={props.action.sourceName}>Unknown source ({props.action.sourceName})</option>}
              {props.sources.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </Select>
          ) : (
            <Input value={props.action.sourceName} onChange={(e) => setSource(e.target.value)} />
          )}
        </Row>
        <Row title="Visibility">
          <Split direction="row">
            <Child padding="0 1rem 0 0">
              <Switch
                value={props.action.visible}
                onChange={setVisibility}
              />
            </Child>
            <Child grow>
              <span>set sources visiblity to {props.action.visible ? 'visible' : 'hidden'}</span>
            </Child>
          </Split>
        </Row>
      </Split>
    </Pill>
  )
}

OBSToggleSourcePill.defaultProps = {
  expanded: false,
  onChange: () => {},
  onRemove: () => {},
}