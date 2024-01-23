import React from "react"
import type { ReactNode } from 'react';
import { classNames } from "../../../lib/utils"

export type ModalTabbarProps = {
  tabs: Array<ModalTab>
}

export type ModalTab = {
  title: string
  content: ReactNode
}

export const ModalTabbar = ({ tabs }: ModalTabbarProps) => {
  const [selectedTab, setSelectedTab] = React.useState<number>(0)

  return (
    <div className="w-full h-full">
      <div className="w-full flex flex-row justify-start items-center bg-dark-800/[.85] rounded-md">
        {tabs.map((t, i) => (
          <div
            key={`tab-${i}`}
            className={classNames("mt-1 px-10 py-2 cursor-pointer transition-colors duration-200 rounded-t-lg", i == selectedTab ? "bg-dark-700" : "hover:bg-dark-700/[.45]")}
            onClick={() => setSelectedTab(i)}
          >{t.title}</div>
        ))}
      </div>
      {tabs[selectedTab].content}
    </div>
  )
}

export default ModalTabbar;