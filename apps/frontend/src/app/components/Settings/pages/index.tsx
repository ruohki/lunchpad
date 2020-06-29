import * as React from 'react';

import {  Split, Child, Tooltip, IconButton, PillList, Outer } from '@lunchpad/base';

import { Icon, Plus, PagePaste } from '@lunchpad/icons'

import { LayoutContext, Severity, useNotification } from '@lunchpad/contexts';
import { AnimatePresence, motion } from 'framer-motion';
import { PagePill } from './pagepill';
import { Page } from '@lunchpad/types';

const { remote } = window.require('electron')

export default () => {
  const { activePage, pages, addPage, pastePage, removePage, renamePage, setActivePage } = React.useContext(LayoutContext.Context);
  const [ showPasteError ] = useNotification();
  const [ showExportSuccess ] = useNotification();
  
  const tryImport = () => {
    try {
      const clipboard: any = JSON.parse(remote.clipboard.readText());
      if ("id" in clipboard && "name" in clipboard && "buttons" in clipboard)  {
        pastePage(clipboard as Page);
      }
    } catch  {
      showPasteError("Data does not seem to be a valid Lunchpad page", 2500, Severity.error);
    }
  }

  const exportPage = (page: Page) => {
    remote.clipboard.writeText(JSON.stringify(page));
    showExportSuccess("Page copied to clipboard")
  }

  const importPage = (id: string) => {
    try {
      const clipboard: any = JSON.parse(remote.clipboard.readText());
      if ("id" in clipboard && "name" in clipboard && "buttons" in clipboard)  {
        clipboard.id = id
        pastePage(clipboard as Page, id);
      }
    } catch  {
      showPasteError("Data does not seem to be a valid Lunchpad page", 2500, Severity.error);
    }
  }

  return (
    <Outer padding="1rem">
      <PillList
        header={
          <Split direction={'row'}>
            <Child grow padding="0 0 0 1rem">
              Pages:
            </Child>
            <Child padding="1rem">
              <Tooltip title="Try to import a page from clipboard">
                <IconButton icon={<Icon icon={PagePaste} />} onClick={tryImport}>Import as new Page</IconButton>
              </Tooltip>
            </Child>
            <Child padding="1rem">
              <Tooltip title="Add a new action to the end of the list of actions.">
                <IconButton icon={<Icon icon={Plus} />} onClick={() => addPage(`New Page: ${pages.length}`)}>Add Page</IconButton>
              </Tooltip>
            </Child>
          </Split>
        }
      >
        <AnimatePresence>
          {pages.map(page => (
            <motion.div
              positionTransition={{
                type: 'spring',
                damping: 30,
                stiffness: 200
              }}
              initial={{ opacity: 0, translateX: -100 }}
              animate={{ opacity: 1, translateX: 0 }}
              exit={{ opacity: 0, translateX: 100 }}
              key={page.id}
            >
              <PagePill
                page={page}
                onClone={() => pastePage(page)}
                onExport={() => exportPage(page)}
                onImport={() => importPage(page.id)}
                onSwitch={() => setActivePage(page.id)}
                onChange={(name) => renamePage(page.id, name)}
                onRemove={(page.id !== "default" && page.id !== activePage.id) ? () => removePage(page.id) : null }
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </PillList>
    </Outer>
  )
}


/* <Child grow height="100%">
      <PagesList menu={
        <Split direction={"row"}>
          <Child grow>
            Pages:
          </Child>
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
    </Child> */