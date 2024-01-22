import React, {Fragment, ReactNode} from 'react';
import {v4 as uuid} from 'uuid';
import {Listbox, Transition} from '@headlessui/react';
import {classNames} from "../../lib/utils.ts";
import {ChevronUpDownIcon} from "@heroicons/react/24/solid";

export type DropboxItem<T = string> = {
  label: ReactNode
  list?: ReactNode
  value: T
}

export type DropdownProps<T> = {
  items: Array<DropboxItem<T>>
}
export const Dropdown = <T, >(props: DropdownProps<T>) => {
  const [selectedItem, setSelectedItem] = React.useState<T>(props.items[0]);
  const [id] = React.useState(() => uuid())

  return (
    <Listbox
      value={selectedItem.value as unknown as string}
      onChange={value => setSelectedItem(props.items.find(el => el.value == value))}
    >
      <Listbox.Button
        className="appearance-none text-left block w-full py-1.5 px-3 text-white bg-dark-800/[.50] hover:bg-dark-800/[.85] border-2 border-dark-500/[.45] rounded-lg outline-0 shadow"
      >
        <span className="block truncate">{selectedItem.label}</span>
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
          <ChevronUpDownIcon
            className="h-5 w-5 text-white"
            aria-hidden="true"
          />
        </span>
      </Listbox.Button>
      <Transition
        as={Fragment}
        leave="transition ease-in duration-250"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 -translate-y-[10px]"
        enterFrom="opacity-0 -translate-y-[10px]"
        enterTo="opacity-1 translate-y-0"
        enter="transition ease-in duration-250"
      >
        <Listbox.Options
          className="bg-dark-700 border-2 border-dark-500/[.45] rounded-lg text-white mt-1 p-1 space-y-1 absolute w-full shadow-lg"
        >
          {props.items.map((item, i) => (
            <Listbox.Option
              key={`${id}-${i}`}
              value={item.value}
              className={classNames("transition-colors duration-250 cursor-pointer hover:bg-blurple-500 rounded-lg p-2", item.value == selectedItem.value ? "bg-dark-600" : null)}
            >
              {item.list ? item.list : item.label}
            </Listbox.Option>
          ))}
        </Listbox.Options>
      </Transition>
    </Listbox>
  )
}

export default Dropdown;