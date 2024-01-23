import { useModal } from "./components/modal";
import Dropdown, { DropboxItem } from "./components/primitives/dropdown.tsx";
import type { LaunchpadType } from '../src-tauri/bindings/LaunchpadType.ts';
import Button from "./components/primitives/button.tsx";
import Input from "./components/primitives/input.tsx";
import Switch from "./components/primitives/switch.tsx";
import { Divider } from "./components/primitives/divider.tsx";
import ModalTabbar from "./components/specific/modal-tabs/index.tsx";
import AboutPage from "./components/specific/modal-tabs/settings-pages/about.tsx";

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

const Testmodal = (props) => {
  return (
    <div className="h-full flex flex-col">
      <ModalTabbar tabs={[{
        title: "Settings",
        content: <div />
      }, {
        title: "Pages",
        content: <div />
      }, {
        title: "About",
        content: <AboutPage />
      }]}></ModalTabbar>
      <div className="p-2">

        <Divider />
        <div className="w-full flex justify-end">
          <Button onClick={props.close} type="Primary" label="Close" />
        </div>
      </div>
    </div>
  )
}

function App() {
  const [ open, close] = useModal();

  return (
    <div className="w-full p-5 space-y-3 flex flex-col">
      <label>Select:</label>
      <div className="relative">
        <Dropdown<number> items={items} />
      </div>
      <Divider />
      <label>Buttons:</label>
      <div className="space-x-2">
        <Button onClick={() => open!(<Testmodal close={close} />)} label="Default" type="Default" />
        <Button label="Primary" type="Primary" />
        <Button label="Danger" type="Danger" />
        <Button label="Light" type="Light" />
      </div>
      <Divider />
      <label>Input:</label>
      <div className="flex flex-row space-x-2">
        <Input />
        <Input placeholder="Please input!" />
      </div>
      <Divider />
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
