import * as React from 'react';
import { NotificationContext, Severity } from '@lunchpad/contexts'

import lodash from 'lodash';

import OBSWebSocket, { SceneItem } from 'obs-websocket-js';
import { StartOrStop } from '../../actions/obs-studio/togglestreaming';
import { SourcesOptions } from 'electron';
import { useLocalStorage } from '@lunchpad/hooks';
import { settingsLabels } from '@lunchpad/types';
import { settings } from 'cluster';
import { useEvent } from 'react-use';
const obs = new OBSWebSocket();

export type Source = {
  name: string,
  type: string,
  typeId: string
}

export type Filter = {
  enabled: boolean,
  name: string,
  settings: any,
  type: string
}

export interface IOBSStudioContext {
  isConnected: boolean
  hasError: unknown
  connect: () => void
  scenes: string[]
  currentScene: string
  sources: Source[]
  switchActiveScene: (name: string) => Promise<unknown>

  sceneItems: SceneItem[]

  collections: string[]
  currentCollection: string
  switchActiveSceneCollection: (name: string) => Promise<unknown>
  
  toggleStreaming: (mode: StartOrStop) => Promise<void>
  toggleRecording: (mode: StartOrStop) => Promise<void>
  toggleReplay: (mode: StartOrStop) => Promise<void>

  setMute: (source: string, mute: boolean) => Promise<void>
  setVolume: (source: string, volume: number) => Promise<void>

  getSourceFilters: (source: string) => Promise<Filter[]>

  saveReplay: () => Promise<void>

  setItemVisiblity: (name: string, scene: string, visible: boolean) => Promise<void>
  setFilterVisibility: (sourceName: string, filterName: string, filterEnabled: boolean) => Promise<void>
}

const obsContext = React.createContext<Partial<IOBSStudioContext>>({})
const { Provider } = obsContext;


const OBSStudioProvider = (props) => {
  const obs = React.useRef(new OBSWebSocket());

  const [ enabled, setEnabled ] = useLocalStorage<boolean>(settingsLabels.connections.obsStudio.enabled, false);
  const [ address ] = useLocalStorage<string>(settingsLabels.connections.obsStudio.address, "localhost:4444");
  const [ autoConnect ] = useLocalStorage<boolean>(settingsLabels.connections.obsStudio.autoConnect, false);
  const [ password ] = useLocalStorage<string>(settingsLabels.connections.obsStudio.password, "");

  const [ showErrorMessage ] = NotificationContext.useNotification();
  const [ showSuccessMessage ] = NotificationContext.useNotification();
  const [ isConnected, _setConnected ] = React.useState<boolean>(false);
  const [ hasError, setError ] = React.useState<Error>();
  
  const [ collections, setCollections ] = React.useState<Array<string>>([]);
  const [ scenes, setScenes ] = React.useState<Array<string>>([])
  const [ sceneItems, setSceneItems ] = React.useState<SceneItem[]>([]);
  const [ sources, setSources ] = React.useState<Source[]>([]);

  const [ currentScene, setCurrentScene ] = React.useState<string>();
  const [ currentCollection, setCurrentCollection ] = React.useState<string>();
  
  const setConnected = (val) => {
    _setConnected(val)
  }

  const onConnected = () => {
    setConnected(true);
  } 
  const onDisconnected = () => {
    setConnected(false);
  }
  const onAuthenticationFailure = () => {
    setEnabled(false);
    setConnected(false);
  }

  obs.current.removeAllListeners('AuthenticationSuccess')
  obs.current.removeAllListeners('AuthenticationFailure')
  obs.current.removeAllListeners('ConnectionClosed')
  obs.current.addListener('AuthenticationSuccess', onConnected);
  obs.current.addListener('ConnectionClosed', onDisconnected);
  obs.current.addListener('AuthenticationFailure', onAuthenticationFailure);

  const OBSError = (error: any) => {
    if ('error' in error) {
      console.error(error)
      if (error.error === "Authentication Failed.")
        showErrorMessage("Authentication with OBS-Websocket failed.", 2500, Severity.error);
      else if ('code' in error && error.code === "CONNECTION_ERROR") {
        showErrorMessage("Cannot connect to OBS-Websocket. Is OBS Studio running and the OBS-Websocket plugin enabled? Disabling OBS-Studio integration.", 5000, Severity.error);
        setEnabled(false);
      }
    } else {
      console.error(error)
    }
  }
  
  const connect = () => {
    if (enabled) {
      obs.current.connect({ address, password }).then(() => {
        obs.current.send('GetVersion').then((result) => {
          const [ major, minor, fix] = result["obs-websocket-version"].split(".");
          if (parseInt(major) <= 4) {
            if (parseInt(minor) < 8) {
              setEnabled(false)
              return showErrorMessage("Please upgrade your obs-websocket plugin version to 4.8.0+", 5000, Severity.error);
            }
          }
          showSuccessMessage("OBS-Websocket connection established", 2500, Severity.info) 
        })
      }).catch(OBSError)
    }
  }

  React.useEffect(() => {
    if (autoConnect && enabled) {
      connect();
    }
    
    return () => {
      if (enabled) {
        obs.current.disconnect();
      }
    }
  }, [ autoConnect, enabled, password ])

  const fetchSceneCollections = () => obs.current.send('ListSceneCollections').then(result => setCollections(result["scene-collections"].map(sc => lodash.get(sc, 'sc-name')))).catch(OBSError)
  const fetchScenes = () => obs.current.send('GetSceneList').then(result => setScenes([...result.scenes.map(scene => scene.name)])).catch(OBSError);
  const fetchCurrentCollection = () => obs.current.send('GetCurrentSceneCollection').then(result => setCurrentCollection(result["sc-name"])).catch(OBSError);
  const fetchCurrentScene = () => obs.current.send('GetCurrentScene').then(result => {
    setCurrentScene(result.name);
    setSceneItems(result.sources);
  }).catch(OBSError);
  const fetchSources = () => obs.current.send('GetSourcesList').then(result => {
    //@ts-ignore  type def is wrong
    setSources(result.sources);
  }).catch(OBSError)

  React.useEffect(() => {
    if (enabled && isConnected) {
      fetchSceneCollections();
      fetchCurrentCollection();
      fetchScenes();
      fetchCurrentScene();
      fetchSources();
    }
  }, [ isConnected, enabled ])

  React.useEffect(() => {
    obs.current.on('SceneCollectionListChanged', fetchSceneCollections);
    obs.current.on('SceneCollectionChanged', () => {
      fetchCurrentCollection();
      fetchCurrentScene();
    });
    
    obs.current.on('SourceCreated', fetchSources);
    obs.current.on('SourceDestroyed', fetchSources);
    obs.current.on('SourceRenamed', fetchSources);
    obs.current.on('SourceFilterAdded', fetchSources);
    obs.current.on('SourceFilterRemoved', fetchSources);

    obs.current.on('ScenesChanged', fetchScenes);
    obs.current.on('SwitchScenes', result => {
      setCurrentScene(result["scene-name"]);
      setSceneItems(result.sources);
    });
  
    return () => {
      obs.current.removeAllListeners('SceneCollectionListChanged')
      obs.current.removeAllListeners('SceneCollectionChanged')
      obs.current.removeAllListeners('SourceCreated')
      obs.current.removeAllListeners('SourceDestroyed')
      obs.current.removeAllListeners('SourceRenamed')
      obs.current.removeAllListeners('SourceFilterAdded')
      obs.current.removeAllListeners('SourceFilterRemoved')
      obs.current.removeAllListeners('ScenesChanged')
      obs.current.removeAllListeners('SwitchScenes')
    }
  }, [ isConnected ])

  const switchActiveScene = React.useCallback((name: string): Promise<void> => {
    if (!isConnected) return;
    return obs.current.send('SetCurrentScene', { "scene-name": name})
  }, [ isConnected ]);

  const switchActiveSceneCollection = React.useCallback((name: string): Promise<void> => {
    if (!isConnected) return;
    return obs.current.send('SetCurrentSceneCollection', { "sc-name": name })
  }, [ isConnected ]);

  const setItemVisiblity = React.useCallback((name: string, scene: string, visible: boolean): Promise<void> => {
    if (!isConnected) return;
    //@ts-ignore - buggy types
    return obs.current.send('SetSceneItemProperties', { "scene-name": scene, item: name, visible })
  }, [ isConnected ])
  
  const toggleStreaming = React.useCallback((mode: StartOrStop): Promise<void> => {
    if (!isConnected) return;
    if (mode === StartOrStop.Start) return obs.current.send('StartStreaming', {})
    if (mode === StartOrStop.Stop) return obs.current.send('StopStreaming')
    if (mode === StartOrStop.Toggle) return obs.current.send('StartStopStreaming')
  }, [ isConnected ])

  const toggleRecording = React.useCallback((mode: StartOrStop): Promise<void> => {
    console.log(mode)
    if (!isConnected) return;
    if (mode === StartOrStop.Start) return obs.current.send('StartRecording');
    if (mode === StartOrStop.Stop) return obs.current.send('StopRecording')
    if (mode === StartOrStop.Toggle) return obs.current.send('StartStopRecording')
  }, [ isConnected ])

  const toggleReplay = React.useCallback((mode: StartOrStop): Promise<void> => {
    if (!isConnected) return;
    if (mode === StartOrStop.Start) return obs.current.send('StartReplayBuffer')
    if (mode === StartOrStop.Stop) return obs.current.send('StopReplayBuffer')
    if (mode === StartOrStop.Toggle) return obs.current.send('StartStopReplayBuffer')
  }, [ isConnected ])
  
  const getSourceFilters = React.useCallback(async (source: string): Promise<Filter[]> => {
    if (!isConnected) return;
    const result = await obs.current.send('GetSourceFilters', { sourceName: source })
    //@ts-ignore wrong type defs
    return result.filters;
  }, [ isConnected ])

  const setFilterVisibility = React.useCallback((sourceName: string, filterName: string, filterEnabled: boolean): Promise<void> => {
    if (!isConnected) return;
    //@ts-ignore wrong type defs
    return obs.current.send("SetSourceFilterVisibility", { sourceName, filterName, filterEnabled })
  }, [ isConnected ]);

  const saveReplay = React.useCallback((): Promise<void> => {
    if (!isConnected) return;
    return obs.current.send("SaveReplayBuffer")
  }, [ isConnected ])

  const setMute = React.useCallback((source: string, mute: boolean): Promise<void> => {
    if (!isConnected) return;
    return obs.current.send("SetMute", { source, mute });
  }, [ isConnected ])

  const setVolume = React.useCallback((source: string, volume: number): Promise<void> => {
    if (!isConnected) return;
    //@ts-ignore
    return obs.current.send("SetVolume", { source, volume, useDecibel: true });
  }, [ isConnected ])

  const value = React.useMemo(() => ({
    isConnected,
    hasError,
    connect,
    scenes,
    collections,
    sources,
    currentCollection,
    currentScene,
    switchActiveScene,
    switchActiveSceneCollection,
    sceneItems,
    setItemVisiblity,
    toggleStreaming,
    toggleRecording,
    toggleReplay,
    saveReplay,
    getSourceFilters,
    setFilterVisibility,
    setMute,
    setVolume,
  }), [ setMute, setVolume, connect, getSourceFilters, setFilterVisibility, isConnected, hasError, scenes, collections, currentCollection, currentScene, switchActiveScene, switchActiveSceneCollection, sceneItems, setItemVisiblity, toggleStreaming, toggleRecording, toggleReplay, saveReplay, sources ])

  return (
    <Provider value={value}>
      {props.children}
    </Provider>
  )
}

export const OBSStudioContext = {
  Provider: OBSStudioProvider,
  Context: obsContext,
}