import { app, BrowserWindow } from 'electron';
import * as settings from 'electron-settings';

import SquirrelEvents from './app/events/squirrel.events';
import ElectronEvents from './app/events/electron.events';
import UpdateEvents from './app/events/update.events';
import MidiEvents from './app/events/midi.events';
import SettingsEvents from './app/events/settings.events';

import App from './app/app';

//@ts-ignore
global.settings = settings;

export default class Main {

    static initialize() {
        if (SquirrelEvents.handleEvents()) {
            // squirrel event handled (except first run event) and app will exit in 1000ms, so don't do anything else
            app.quit();
        }
    }

    static bootstrapApp() {
        App.main(app, BrowserWindow);
    }

    static bootstrapAppEvents() {
        ElectronEvents.bootstrapElectronEvents();
        MidiEvents.boostrapMidiEvents();
        SettingsEvents.boostrapSettingsEvents();
        
        // initialize auto updater service
        if (!App.isDevelopmentMode()) {
            // UpdateEvents.initAutoUpdateService();
        }
    }

}

// handle setup events as quickly as possible
Main.initialize();

// bootstrap app
Main.bootstrapApp();
Main.bootstrapAppEvents();