import * as React from 'react';
import lodash from 'lodash';

import { Icon, OBS } from '@lunchpad/icons';
import { Split, Child, Row, Select, Button, Input, Switch } from '@lunchpad/base';

import Pill from '../../pill'
import { OBSToggleFilter } from './classes';
import { OBSStudioContext, Filter } from '../../../contexts/obs-studio';


interface IOBSToggleFilterPill {
  action: OBSToggleFilter
  expanded?: boolean
  onChange?: (action: OBSToggleFilter) => void
  onRemove?: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}

export const OBSToggleFilterPill: React.SFC<IOBSToggleFilterPill> = (props) => {
  const [ showBody, setExpanded ] = React.useState<boolean>(props.expanded);
  const { sources, getSourceFilters } = React.useContext(OBSStudioContext.Context);
  const [ currentFilters, setCurrentFilters ] = React.useState<Filter[]>([]);

  const setSource = (val: string) => props.onChange(lodash.set(props.action, 'sourceName', val));
  const setFilter = (val: string) => props.onChange(lodash.set(props.action, 'filterName', val));
  const setToggle = (val: boolean) => props.onChange(lodash.set(props.action, 'toggle', val));

  const sourceExists = lodash.includes(sources.map(s => s.name), props.action.sourceName);
  const isUnknownSource = !sourceExists && !lodash.isEmpty(props.action.sourceName);

  const filterExists = lodash.includes(currentFilters.map(f => f.name), props.action.filterName);
  const isUnknownFilter = !filterExists && !lodash.isEmpty(props.action.filterName);

  React.useEffect(() => {
    getSourceFilters(props.action.sourceName).then(filter => {
      setCurrentFilters(filter);
      if (lodash.isEmpty(props.action.filterName) && filter.length > 0) setFilter(filter[0].name)
    });
  }, [ props.action.sourceName, isUnknownSource ])

  const Expanded = (
    <Split direction="row">
      <Child
        grow
        whiteSpace="nowrap"
        padding="0 1rem 0 0"
      >
        <div
          style={{textOverflow: "ellipsis", overflow: "hidden"}}
        >
          OBS: {props.action.toggle ? "Enable" : "Disable"} filter {props.action.filterName}
        </div>
      </Child>
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
        <Row title="Source:">
          <Select
            value={props.action.sourceName}
            //@ts-ignore
            onChange={(e) => setSource(e.target.value)}
          >
            {isUnknownSource && <option value={props.action.sourceName}>Unknown source ({props.action.sourceName})</option>}
            {lodash.isEmpty(props.action.sourceName) && <option value="">No source selected</option>}
            {sources.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
          </Select>
        </Row>
        {!isUnknownSource && <Row title="Filter:">
          <Select
            value={props.action.filterName}
            //@ts-ignore
            onChange={(e) => setFilter(e.target.value)}
          >
            {isUnknownFilter && <option value={props.action.filterName}>Unknown filter ({props.action.filterName})</option>}
            {lodash.isEmpty(props.action.filterName) && <option value="">No filter selected</option>}
            {currentFilters.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
          </Select>
        </Row>}
        {!isUnknownSource && <Row title="Enabled:">
          <Split direction="row">
            <Child padding="0 1rem 0 0">
              <Switch
                value={props.action.toggle}
                onChange={setToggle}
              />
            </Child>
            <Child grow>
              <span>set filter state to {props.action.toggle ? 'enabled' : 'disabled'}</span>
            </Child>
          </Split>
        </Row>}
      </Split>
    </Pill>
  )
}

OBSToggleFilterPill.defaultProps = {
  expanded: false,
  onChange: () => {},
  onRemove: () => {},
}