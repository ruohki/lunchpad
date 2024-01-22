import {useModal} from "./components/modal";
import {createSignal, createEffect, createResource, onMount, For} from "solid-js";
import {invoke} from "@tauri-apps/api";
import Dropdown, {DropboxItem} from "./components/primitives/dropdown.tsx";
import { Select } from '@thisbeyond/solid-select';
import "@thisbeyond/solid-select/style.css";
import type { LaunchpadType } from '../src-tauri/bindings/LaunchpadType.ts';
import Button from "./components/primitives/button.tsx";
import Input from "./components/primitives/input.tsx";
import Switch from "./components/primitives/switch.tsx";

const NameMappings: Record<LaunchpadType, string> = {
  Legacy: "Launchpad Legacy", MarkTwo: "Launchpad MK2", ProMarkThree: "Launchpad Pro MK3", S: "Launchpad S", Unknown: "Unknown Device",
  MiniMarkThree: "Launchpad Mini MK3",
  ProMarkTwo: "Launchpad Pro MK2",
  X: "Launchpad X"
};

/*
function Test(props) {
  const [devices, setDevices] = createSignal([]);

  createEffect(async () => {
    const results = await invoke("enumerate_devices");
  console.log(results);
    setDevices(results.map(d => ({
      id: d[0],
      inputIdx: d[1].idx,
      inputName: d[1].name,
      outputIdx: d[2].idx,
      outputName: d[2].name,
    })))
  });

  const finishModal = () => {
    props.close(test());
  }

  const format = (item, type) => <><span class="text-md">{NameMappings[item.id]}</span><br /><span class="text-sm">{item.inputName} / {item.outputName}</span></>

  return (
    <div>

      <Select options={devices} format={format} class="custom" placeholder={"Please select a Launchpad"}>
        <select></select>
      </Select>

      <button onClick={finishModal}>Close</button>
    </div>
  )
}*/

const items: Array<DropboxItem<number>> = [{
  label: "Launchpad Mini MK3",
  list: <span>Launchpad Mini MK3<span className="block text-xs text-white/[.85]">MIDIIN 2 / MIDIOUT 2</span></span>,
  value: 1,
}, {
  label: "Launchpad Mini MK3",
  list: <span>Launchpad Mini MK3<span className="block text-xs text-white/[.85]">Launchpad Mini MK3 / Launchpad Mini MK3</span></span>,
  value: 2,
}]

function App() {
  const [ open, close ] = useModal();

  const acceptModal = (data) => {
    console.log(data);
    close();
  }
  //open!(<div>Ich bin ein Testmodal</div>)

  return (
    <div className="w-full p-5 space-y-2 flex flex-col">
      <label>Select:</label>
      <div className="relative">
        <Dropdown<number> items={items} />
      </div>
      <label>Buttons:</label>
      <div className="space-x-2">
        <Button onClick={() => open!(<div>Ich bin ein Testmodal</div>)} label="Default"  type="Default" />
        <Button onClick={() => open!(<div>Ich bin ein Testmodal</div>)} label="Primary"  type="Primary" />
        <Button onClick={() => open!(<div>Ich bin ein Testmodal</div>)} label="Danger"  type="Danger" />
        <Button onClick={() => open!(<div>Ich bin ein Testmodal</div>)} label="Light"  type="Light" />
      </div>
      <label>Input:</label>
      <div className="flex flex-row space-x-2">
        <Input />
        <Input placeholder="Please input!"/>
      </div>
      <label>Toggle / Switch:</label>
      <div className="flex flex-row space-x-2">
        <Switch label="Default" />
        <Switch label="Default" />
        <Switch label="Primary" type="Primary" />
        <Switch label="Primary" type="Primary" />
        <Switch label="Danger" type="Danger" />
        <Switch label="Danger" type="Danger" />
      </div>
    </div>
  );
}

export default App;
