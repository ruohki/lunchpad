import * as React from 'react';
import lodash from 'lodash';

import { Icon, Stopwatch } from '@lunchpad/icons';
import { Split, Child, Row, Select, Button, Input } from '@lunchpad/base';

import Pill from '../../pill'
import { OBSSwitchScene } from './classes';

interface IOBSSwitchScenePill {
  currentCollection: string
  collections: string[]
  scenes: string[]
  action: OBSSwitchScene
  expanded?: boolean
  onChange?: (action: OBSSwitchScene) => void
  onRemove?: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}

export const OBSSwitchScenePill: React.SFC<IOBSSwitchScenePill> = (props) => {
  const [ showBody, setExpanded ] = React.useState<boolean>(props.expanded);
  
  const setScene = (val: string) => {
    const actn = new OBSSwitchScene(
      val,
      props.action.collectionName,
      props.action.id
    )
    props.onChange(actn)
  }

  const setCollection = (val: string) => {
    const actn = new OBSSwitchScene(
      props.action.sceneName,
      val,
      props.action.id
    );
    props.onChange(actn)
  }

  const collectionExists = lodash.includes(props.collections, props.action.collectionName)
  const currentCollectionActive = props.currentCollection === props.action.collectionName;
  const sceneExists = props.currentCollection === props.action.collectionName && lodash.includes(props.scenes, props.action.sceneName)

  const Expanded = (
    <Split direction="row">
      <Child grow whiteSpace="nowrap" padding="0 1rem 0 0"><div style={{textOverflow: "ellipsis", overflow: "hidden"}}>OBS: Switch to: {props.action.sceneName}</div></Child>
    </Split>
  )

  return (
    <Pill
      isExpanded={showBody}
      icon={<Icon icon={Stopwatch} />}
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
            {!collectionExists && <option disabled value={props.action.collectionName}>Unknown collection ({props.action.collectionName})</option>}
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
      </Split>
    </Pill>
  )
}

OBSSwitchScenePill.defaultProps = {
  expanded: false,
  onChange: () => {},
  onRemove: () => {},
}