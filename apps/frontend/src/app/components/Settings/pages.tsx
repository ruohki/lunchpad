import React, { useContext, useState, useRef, useEffect } from 'react';

import { darken } from 'polished';
import { COLOR_REDISH, COLOR_BLACK, COLOR_MENU, Split, Child, Tooltip, Button, IconButton } from '@lunchpad/base';

import { Icon, Trash, Pen, PageOpen } from '@lunchpad/icons'

import PagesList, { ListItem } from '../List'
import { LayoutContext, Severity, useNotification } from '@lunchpad/contexts';

import {useFocus} from '@lunchpad/hooks';

import { EditInput } from './components';

//TODO: Clean this mess up :S

const PageListItem = ({ page, onClick, onDelete, onRename, active }) => {
  const [ editMode, setEditMode ] = useState(false);
  const inputRef = useRef();
  const hasFocus = useFocus(inputRef, false)

  const [ pageName, setPageName ] = useState(page.name);

  useEffect(() => {
    if (editMode) {
      if (inputRef && inputRef.current) {
        //@ts-ignore - wtf!?
        inputRef.current.focus();
      }
    }
  }, [editMode])

  useEffect(() => {
    if (!hasFocus) {
      setEditMode(false);
    }
  }, [hasFocus])

  return (
    <ListItem key={page.name} backgroundColor={editMode ? COLOR_BLACK : darken(0.02, COLOR_MENU)}>
      <Split direction="row" >
        <Child margin="0 1rem 0 0">
            <Tooltip
              active={!active}
              title={`Activate page ${page.name}`}
            >
              <IconButton disabled={active} icon={<Icon icon={PageOpen} />} onClick={(e) => onClick(page.id)}/>
          </Tooltip>
        </Child>
        <Child grow>
          <EditInput
            onKeyDown={(e) =>{
              if (e.keyCode === 27) {
                setPageName(page.name);
                setEditMode(false);
              } else if (e.keyCode === 13) {
                if (page.name !== pageName) {
                  onRename(page.id, pageName);
                }
                setEditMode(false);
              }
            }}
            ref={inputRef}
            style={{display: editMode ? "block" : 'none' }}
            value={pageName}
            onChange={(e) => setPageName(e.target.value)}
          />
          <span style={{ display: editMode ? 'none' : 'block'}}>{page.name}</span>
        </Child>
        {page.id !== "default" ? (
          <> 
            <Child margin="0 2rem 0 0">
              <Tooltip
                title="Edit the name of the page"
              >
                <IconButton onClick={() => {
                  setPageName(page.name);
                  setEditMode(true);
                }} icon={<Icon icon={Pen} />} />
              </Tooltip>
            </Child>
            {/* <Child margin="0 3rem 0 0">
              <Tooltip
                title="Export this page to a file."
              >
                <IconButton icon={<IconFileExport />} />
              </Tooltip>
            </Child> */}
            <Child>
              <Tooltip
                type="error"
                title="Delete this page. All data will be LOST!"
              >
                <IconButton onClick={() => onDelete(page.id)} hover={COLOR_REDISH} icon={<Icon icon={Trash} />} />
              </Tooltip>
            </Child>
          </>
        ) : (
          <Child>
            {/* <Tooltip
              title="Export this page to a file."
            >
              <IconButton icon={<IconFileExport />} />
            </Tooltip> */}
          </Child>
        )}
      </Split>
      
    </ListItem>
  )
}

export default () => {
  const { activePage, pages, addPage, removePage, renamePage, setActivePage } = useContext(LayoutContext.Context);
  const [ showRenameNotification ] = useNotification();

  return (
    <Child grow height="100%">
      <PagesList menu={
        <Split direction={"row"}>
          <Child grow>
            Pages:
          </Child>
          {/* <Child padding="1rem">
            <Tooltip
              title="Export your entire configuration."
            >
              <IconButton icon={<IconFileExport />} />
            </Tooltip>
          </Child> */}
          <Child padding="1rem 0 1rem 1rem"> 
          <Tooltip
            title="Add a whole new page of macro goodness!"
          >
            <Button padding="4px 20px 8px 20px" onClick={() => addPage(`New Page: ${pages.length}`)}>Add new Page</Button>
              </Tooltip>
          </Child>
        </Split>
      }>
        {pages.map(page => (
          <PageListItem
            active={page.id === activePage.id}
            key={page.id}
            onClick={setActivePage}
            onDelete={removePage}
            onRename={(id, name) => renamePage(id, name) ? (
              showRenameNotification("The page has been renamed.", 1500, Severity.info)
            ) : (
              showRenameNotification("The page could not be renamed.", 1500, Severity.error)
            )}
            page={page}
          />
        ))}
      </PagesList>
    </Child>
  )
}