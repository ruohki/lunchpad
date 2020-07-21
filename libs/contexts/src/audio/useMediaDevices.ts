import { useEffect, useState } from 'react';

const noop = () => {};

const updateName = (device: Partial<MediaDeviceInfo>) => {
  if (device.deviceId === "default" || device.deviceId === "communications") {
    return `System ${device.label}`
  } else return device.label
}
const useMediaDevices = (filter: 'all' | 'audiooutput' | 'audioinput' = "all") => {
  const [state, setState] = useState([]);

  useEffect(() => {
    let mounted = true;

    const onChange = () => {
      navigator.mediaDevices
        .enumerateDevices()
        .then(devices => {
          if (mounted) {
            let dev = devices.map(({ deviceId, groupId, kind, label }) => ({ deviceId, groupId, kind, label: updateName({ deviceId, groupId, kind, label }) }))
            if (filter !== "all") {
              dev = [...dev].filter(({ kind }) => kind === filter);
            }
            setState(dev);
          }
        })
        .catch(noop);
    };
    navigator.mediaDevices.addEventListener('devicechange', onChange)
    
    onChange();

    return () => {
      mounted = false;
      navigator.mediaDevices.removeEventListener('devicechange', onChange);
    };
  }, [filter]);

  return state;
};

const useMediaDevicesMock = () => ({});

export default typeof navigator === 'object' && !!navigator.mediaDevices ? useMediaDevices : useMediaDevicesMock;