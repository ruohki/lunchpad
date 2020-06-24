import { BrowserWindow, shell, Tray, Menu, ipcMain } from 'electron';
import { rendererAppName, rendererAppPort } from './constants';
import { join } from 'path';
import { format } from 'url';
import AutoLaunch from 'auto-launch';

import { ipcLabels, LaunchpadButton } from '@lunchpad/types';

import * as Configstore from 'configstore';
const config = new Configstore('lunchpad', {stayOnTop: false})

export default class Lunchpad {
  // Keep a global reference of the window object, if you don't, the window will
  // be closed automatically when the JavaScript object is garbage collected.
  static mainWindow: Electron.BrowserWindow;
  static application: Electron.App;
  static BrowserWindow;
  static tray: Electron.Tray;

  static isQuiting: boolean = false;
  static stayOnTop: boolean;
  static minimizeToTray: boolean;
  static runAtStartup: boolean;

  static Launcher: any;

  public static isDevelopmentMode() {
    const isEnvironmentSet: boolean = 'ELECTRON_IS_DEV' in process.env;
    const getFromEnvironment: boolean =
      parseInt(process.env.ELECTRON_IS_DEV, 10) === 1;
    return isEnvironmentSet ? getFromEnvironment : !Lunchpad.application.isPackaged;
  }

  private static onWindowAllClosed() {
    if (process.platform !== 'darwin') {
      Lunchpad.application.quit();
    }
  }

  private static onClose() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    Lunchpad.mainWindow = null;
  }

  private static onRedirect(event: any, url: string) {
    if (url !== Lunchpad.mainWindow.webContents.getURL()) {
      // this is a normal external redirect, open it in a new browser window
      event.preventDefault();
      shell.openExternal(url);
    }
  }

  private static onReady() {
    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    Lunchpad.initMainWindow();
    Lunchpad.loadMainWindow();
  }

  private static onActivate() {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (Lunchpad.mainWindow === null) {
      Lunchpad.onReady();
    }
  }

  private static SetStayOnTop(value: boolean) {
    Lunchpad.mainWindow.setAlwaysOnTop(value);
    config.set('stayOnTop', value);
    Lunchpad.stayOnTop = value;
  }

  private static SetMinimizeToTray(value: boolean) {
    config.set('minimizeToTray', value);
    Lunchpad.minimizeToTray = value;
  }

  private static SetRunAtStartup(value: boolean) {
    if (value) {
      Lunchpad.Launcher.enable();
    } else {
      Lunchpad.Launcher.disable();
    }
    config.set('runAtStartup', value);
    Lunchpad.runAtStartup = value;
  }
  private static initMainWindow() {
    // Create the browser window.
    Lunchpad.mainWindow = new BrowserWindow({
      width: 756,
      height: 756,
      show: false,
      alwaysOnTop: Lunchpad.stayOnTop,
      backgroundColor: "#23272A",
      useContentSize: true,
      webPreferences: {
        webSecurity: false,
        nodeIntegration: true,
        backgroundThrottling: false,
        defaultFontFamily: {
          monospace: "Exo 2",
          serif: "Exo 2",
          sansSerif: "Exo 2",
          standard: "Exo 2",
        }
      },
      minHeight: 756,
      minWidth: 756,
      title: "Lunchpad",
      icon: join(__dirname, "assets/logo.ico")
    });
    
    Lunchpad.mainWindow.center();
    Lunchpad.mainWindow.setMenuBarVisibility(false)
    
    Lunchpad.tray = new Tray(join(__dirname, "assets/logo.png"));
    Lunchpad.tray.setContextMenu(Menu.buildFromTemplate([{ 
      label: "Join me on discord!",
      icon: join(__dirname, "assets/discord.png"),
      click: () => shell.openExternal("https://discord.com/invite/4Ys9TRR")
    }, {
      type: "separator"
    }, {
      label: 'Show Lunchpad', click: () => {
        Lunchpad.mainWindow.show();
      }
    }, {
      type: "separator"
    }, { 
      type: "checkbox",
      label: "Stay on top",
      checked: Lunchpad.stayOnTop,
      click: (e) => Lunchpad.SetStayOnTop(e.checked)
    }, { 
      type: "checkbox",
      label: "Minimize to tray",
      checked: Lunchpad.minimizeToTray,
      click: (e) => Lunchpad.SetMinimizeToTray(e.checked)
    }, { 
      type: "checkbox",
      label: "Run at startup",
      checked: Lunchpad.runAtStartup,
      click: (e) => Lunchpad.SetRunAtStartup(e.checked)
    }, {
      type: "separator"
    }, {
      label: "Stop all running macros",
      click: () => Lunchpad.mainWindow.webContents.send(ipcLabels.macros.stopAll),
    }, {
      type: "separator"
    }, {
      label: 'Quit', click: () => {
        Lunchpad.isQuiting = true;
        Lunchpad.application.quit();
      }
    }]));
    
    Lunchpad.tray.on('double-click', () => Lunchpad.mainWindow.show())

    Lunchpad.mainWindow.on('minimize', (event) => {
      if (Lunchpad.minimizeToTray) {
        event.preventDefault();
        Lunchpad.mainWindow.hide();
      }
    });

    Lunchpad.mainWindow.on('close', (event) => {
      if(!Lunchpad.isQuiting){
        event.returnValue = true;
        event.preventDefault()
        Lunchpad.mainWindow.hide();
      } else {
        Lunchpad.mainWindow = null;
      }
    });

    // if main window is ready to show, close the splash window and show the main window
    Lunchpad.mainWindow.once('ready-to-show', () => {
      Lunchpad.mainWindow.show();
    });

    // handle all external redirects in a new browser window
    // Lunchpad.mainWindow.webContents.on('will-navigate', Lunchpad.onRedirect);
    // Lunchpad.mainWindow.webContents.on('new-window', (event, url, frameName, disposition, options) => {
    //     Lunchpad.onRedirect(event, url);
    // });

    // Emitted when the window is closed.
    
  }
 
  private static loadMainWindow() {
    // load the index.html of the Lunchpad.
    if (Lunchpad.isDevelopmentMode()) {
      Lunchpad.mainWindow.loadURL(`http://localhost:${rendererAppPort}`);
    } else {
      Lunchpad.mainWindow.loadURL(
        format({
          pathname: join(__dirname, '..', rendererAppName, 'index.html'),
          protocol: 'file:',
          slashes: true
        })
      );
    }
  }

  static main(app: Electron.App, browserWindow: typeof BrowserWindow) {
    // we pass the Electron.App object and the
    // Electron.BrowserWindow into this function
    // so this class has no dependencies. This
    // makes the code easier to write tests for
    Lunchpad.Launcher = new AutoLaunch({ name: "Lunchpad"});
    Lunchpad.stayOnTop = config.get('stayOnTop');
    Lunchpad.minimizeToTray = config.get('minimizeToTray');
    Lunchpad.Launcher.isEnabled().then(isEnabled => Lunchpad.runAtStartup = isEnabled);


    Lunchpad.BrowserWindow = browserWindow;
    Lunchpad.application = app;

    Lunchpad.application.on('window-all-closed', Lunchpad.onWindowAllClosed); // Quit when all windows are closed.
    Lunchpad.application.on('ready', Lunchpad.onReady); // App is ready to load data
    Lunchpad.application.on('activate', Lunchpad.onActivate); // App is activated
  }
}
 