import * as React from 'react';
const Registry = window.require('winreg')

async function getDLLPath() {
  const regKey = new Registry({
    hive: Registry.HKLM,
    key: '\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\VB:Voicemeeter {17359A74-1236-5467}'
  });
  return new Promise(resolve => {
    regKey.values((err, items) => {
      const unistallerPath = items.find(i => i.name === 'UninstallString').value;
      const fileNameIndex = unistallerPath.lastIndexOf('\\')
      resolve(unistallerPath.slice(0, fileNameIndex));
    });
  });
}

const VoiceMeeterIndicator = () => {
  const [ VMDllPath, setVMDllPath ] = React.useState(false);

  React.useEffect(() => {
    getDLLPath().then(setVMDllPath)
  }, [])

  return VMDllPath ? (
    <p>VM Installed</p> 
  ) : (
    <p>VM not Installed</p>
  )
}

export default VoiceMeeterIndicator;