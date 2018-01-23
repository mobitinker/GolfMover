/**
* This SettingsService is just a simple singleton for managing the complex Settings screen
* as well as a general application-wide utility service.
*
* There's nothing particularly interesting here with-respect-to the Background Geolocation
* plugin.
*/
'use strict';

import React, { Component } from 'react';
import {
  AsyncStorage,
  Alert
} from 'react-native';

import Toast from 'react-native-root-toast';
import prompt from 'react-native-prompt-android';
import DeviceInfo from 'react-native-device-info';
import BackgroundGeolocation from "../../react-native-background-geolocation";

const STORAGE_KEY = "@transistorsoft:";
const TRACKER_HOST = 'http://tracker.transistorsoft.com/locations/';

const GEOFENCE_RADIUS_OPTIONS = {
  "20":"20",
  "100":"100",
  "150":"150",
  "200":"200",
  "300":"300",
  "500":"500",
  "1000":"1000"
};

const GEOFENCE_LOITERING_DELAY_OPTIONS = {
  "0":"0",
  "10000":"10000",
  "30000":"30000",
  "60000":"60000"
};

const APP_SETTINGS = [
  {show: true, name: 'email', group: 'application', dataType: 'string', inputType: 'text', defaultValue: 'mobitinker@gmail.com'},
  {show: false, name: 'radius', group: 'geofence', dataType: 'integer', inputType: 'select', defaultValue: 20, values: [20, 100, 150, 200, 500, 1000]},
  {show: false, name: 'notifyOnEntry', group: 'geofence', dataType: 'boolean', inputType: 'toggle', defaultValue: true},
  {show: false, name: 'notifyOnExit', group: 'geofence', dataType: 'boolean', inputType: 'toggle', defaultValue: true},
  {show: false, name: 'notifyOnDwell', group: 'geofence', dataType: 'boolean', inputType: 'toggle', defaultValue: false},
  {show: false, name: 'loiteringDelay', group: 'geofence', dataType: 'integer', inputType: 'select', defaultValue: 0, values: [0, (1*1000), (5*1000), (10*1000), (30*1000), (60*1000), (5*60*1000)]},
  {show: true, name: 'hideMarkers', group: 'map', dataType: 'boolean', inputType: 'toggle', defaultValue: true},
  {show: true, name: 'hidePolyline', group: 'map', dataType: 'boolean', inputType: 'toggle', defaultValue: true},
  {show: true, name: 'hideGeofenceHits', group: 'map', dataType: 'boolean', inputType: 'toggle', defaultValue: true},
  {show: true, name: 'followsUserLocation', group: 'map', dataType: 'boolean', inputType: 'toggle', defaultValue: true},
];

const PLUGIN_SETTINGS = {
  common: [

    // Geolocation
    {show: true, name: 'desiredAccuracy', group: 'geolocation', dataType: 'integer', inputType: 'select', values: [-1, 0, 10, 100, 1000], defaultValue: 0 },
    {show: true, name: 'distanceFilter', group: 'geolocation', dataType: 'integer', inputType: 'select', values: [0, 10, 20, 50, 100, 500], defaultValue: 20 },
    {show: false, name: 'disableElasticity', group: 'geolocation', dataType: 'boolean', inputType: 'toggle', values: [true, false], defaultValue: false},
    {show: false, name: 'elasticityMultiplier', group: 'geolocation', dataType: 'integer', inputType: 'select', values: [0, 1, 2, 3, 5, 10], defaultValue: 1},
    {show: true, name: 'geofenceProximityRadius', group: 'geolocation', dataType: 'integer', inputType: 'select', values: [1000, 1500, 2000, 5000, 10000, 100000], defaultValue: 10000 },
    {show: false, name: 'stopAfterElapsedMinutes', group: 'geolocation', dataType: 'integer', inputType: 'select', values: [-1, 0, 1, 2, 5, 10, 15], defaultValue: 0},
    {show: false, name: 'desiredOdometerAccuracy', group: 'geolocation', dataType: 'integer', inputType: 'select', values: [10, 20, 50, 100, 500], defaultValue: 100},

    // Activity Recognition
    {show: true, name: 'activityRecognitionInterval', group: 'activity recognition', dataType: 'integer', inputType: 'select', values: [0, 1000, 5000, 10000, 30000], defaultValue: 1000},
    {show: true, name: 'stopTimeout', group: 'activity recognition', dataType: 'integer', inputType: 'select', values: [0, 1, 5, 10, 15], defaultValue: 0},

    // HTTP & Persistence
    {show: false, name: 'url', group: 'http', inputType: 'text', dataType: 'string', defaultValue: 'http://your.server.com/endpoint'},
    {show: false, name: 'autoSync', group: 'http', dataType: 'boolean', inputType: 'toggle', values: [true, false], defaultValue: true},
    {show: false, name: 'autoSyncThreshold', group: 'http', dataType: 'integer', inputType: 'select', values: [0, 5, 10, 25, 50, 100], defaultValue: 0},
    {show: false, name: 'batchSync', group: 'http', dataType: 'boolean', inputType: 'toggle', values: [true, false], defaultValue: false},
    {show: false, name: 'maxBatchSize', group: 'http', dataType: 'integer', inputType: 'select', values: [-1, 50, 100, 250, 500], defaultValue: -1},
    {show: false, name: 'maxRecordsToPersist', group: 'http', dataType: 'integer', inputType: 'select', values: [-1, 0, 1, 10, 100, 1000], defaultValue: -1},
    {show: false, name: 'maxDaysToPersist', group: 'http', dataType: 'integer', inputType: 'select', values: [-1, 1, 2, 3, 4, 5, 6, 7], defaultValue: -1},

    // Application
    {show: false, name: 'stopOnTerminate', group: 'application', dataType: 'boolean', inputType: 'toggle', values: [true, false], defaultValue: true},
    {show: false, name: 'startOnBoot', group: 'application', dataType: 'boolean', inputType: 'toggle', values: [true, false], defaultValue: false},
    {show: true, name: 'heartbeatInterval', group: 'application', dataType: 'integer', inputType: 'select', values: [60, (2*60), (5*60), (15*60)], defaultValue: 60},

    // Logging & Debug
    {show: false, name: 'debug', group: 'debug', dataType: 'boolean', inputType: 'toggle', values: [true, false], defaultValue: true},
    {show: false, name: 'logLevel', group: 'debug', dataType: 'string', inputType: 'select', values: ['OFF', 'ERROR', 'WARN', 'INFO', 'DEBUG', 'VERBOSE'], defaultValue: 'VERBOSE'},
    {show: false, name: 'logMaxDays', group: 'debug', dataType: 'integer', inputType: 'select', values: [1, 2, 3, 4, 5, 6, 7], defaultValue: 3}
  ],

  ios: [
    // Geolocation
    {show: true, name: 'stationaryRadius', group: 'geolocation', dataType: 'integer', inputType: 'select', values: [0, 25, 50, 100, 500, 1000, 5000], defaultValue: 25 },
    {show: true, name: 'activityType', group: 'geolocation', dataType: 'string', inputType: 'select', values: ['Other', 'AutomotiveNavigation', 'Fitness', 'OtherNavigation'], defaultValue: 'Other'},
    {show: true, name: 'useSignificantChangesOnly', group: 'geolocation', dataType: 'boolean', inputType: 'toggle', values: [true, false], defaultValue: false},

    // Application
    {show: true, name: 'preventSuspend', group: 'application', dataType: 'boolean', inputType: 'toggle', values: [true, false], defaultValue: false},

    // Activity Recognition
    {show: true, name: 'disableStopDetection', group: 'activity recognition', dataType: 'boolean', inputType: 'toggle', values: [true, false], defaultValue: false},
    {show: true, name: 'stopDetectionDelay', group: 'activity recognition', dataType: 'integer', inputType: 'select', values: [0, 1, 5, 10, 15], defaultValue: 0}
  ],

  android: [
    // Geolocation
    {show: true, name: 'locationUpdateInterval', group: 'geolocation', dataType: 'integer', inputType: 'select', values: [0, 1000, 5000, 10000, 30000, 60000], defaultValue: 5000},
    {show: true, name: 'fastestLocationUpdateInterval', group: 'geolocation', dataType: 'integer', inputType: 'select', values: [0, 1000, 5000, 10000, 30000, 60000], defaultValue: 5000},
    {show: true, name: 'deferTime', group: 'geolocation', dataType: 'integer', inputType: 'select', values: [0, (10*1000), (30*1000), (60*1000), (5*60*1000)], defaultValue: 0},

    // Activity Recognition
    {show: false, name: 'triggerActivities', group: 'activity recognition', dataType: 'string', inputType: 'select', values: ['in_vehicle', 'on_bicycle', 'on_foot', 'running', 'walking'], defaultValue: 'in_vehicle, on_bicycle, running, walking, on_foot'},

    // Application
    {show: false, name: 'foregroundService', group: 'application', dataType: 'boolean', inputType: 'toggle', values: [true, false], defaultValue: false},
    {show: false, name: 'forceReloadOnMotionChange', group: 'application', dataType: 'boolean', inputType: 'toggle', values: [true, false], defaultValue: false},
    {show: false, name: 'forceReloadOnLocationChange', group: 'application', dataType: 'boolean', inputType: 'toggle', values: [true, false], defaultValue: false},
    {show: false, name: 'forceReloadOnGeofence', group: 'application', dataType: 'boolean', inputType: 'toggle', values: [true, false], defaultValue: false},
    {show: false, name: 'forceReloadOnHeartbeat', group: 'application', dataType: 'boolean', inputType: 'toggle', values: [true, false], defaultValue: false},
    {show: false, name: 'notificationPriority', group: 'application', dataType: 'string', inputType: 'select', values: ['DEFAULT', 'HIGH', 'LOW', 'MAX', 'MIN'], defaultValue: 'DEFAULT'}
  ]
};

// A collection of soundId for use with BackgroundGeolocation#playSound
// Note, core sounds can not be changed or disabled
const SOUND_MAP = {
  "ios": {
    "LONG_PRESS_ACTIVATE": 1113,
    "LONG_PRESS_CANCEL": 1075,
    "ADD_GEOFENCE": 1114,
    "BUTTON_CLICK": 1104,
    "MESSAGE_SENT": 1303,
    "ERROR": 1006,
    "OPEN": 1502,
    "CLOSE": 1503,
    "FLOURISH": 1509
  },
  "android": {
    "LONG_PRESS_ACTIVATE": 27,
    "LONG_PRESS_CANCEL": 94,
    "ADD_GEOFENCE": 28,
    "BUTTON_CLICK": 19,
    "MESSAGE_SENT": 90,
    "ERROR": 89,
    "OPEN": 37,
    "CLOSE": 94,
    "FLOURISH": 37
  }
};

// Auto-incrementing id For creating test geofences.
let geofenceNextId = 0;

let instance = null;

class SettingsService {
  static getInstance() {
    if (instance === null) {
      instance = new SettingsService();
    }
    return instance;
  }

  constructor(props) {
    this.applicationState = null;
    this.pluginState      = null;
    this.changeBuffer     = null;
    this.uuid             = null;
    this.username         = null;

    this._loadApplicationState();

    this.getUUID((uuid) => {
      this.uuid = uuid;
    });

    let platform = DeviceInfo.getSystemName();
    if (platform.match(/iPhone/)) {
      platform = 'ios'
    };
    this.platform = platform.toLowerCase();

    let items = [].concat(PLUGIN_SETTINGS.common).concat(PLUGIN_SETTINGS[this.platform]);

    this.settings = {
      items: items,
      map: {}
    };
    // Create a Map of Settings for speedy lookup.
    items.forEach((item) => {
      this.settings.map[item.name] = item;
    });
  }

  setUsername(username) {
    this.username = username;
  }

  getUUID(callback) {
    if (this.uuid) {
      callback(this.uuid);
      return;
    }
    AsyncStorage.getItem(STORAGE_KEY+"uuid", (err, uuid) => {
      if (uuid) {
        this.uuid = uuid;
      }
      callback(uuid);
    });
  }

  setUUID(uuid) {
    this.uuid = uuid;
    AsyncStorage.setItem(STORAGE_KEY+"uuid", uuid);
  }

  getEmail(callback) {
    if (this.applicationState.email) {
      callback(this.applicationState.email);
      return;
    }
    prompt('Email address', 'Please enter your email address', [{
      text: 'Cancel',
      style: 'cancel',
      onPress: () => {
        console.log('Cancel Pressed');
        callback(null);
      }
    },{
      text: 'OK',
      onPress: (email) => {
        this.set('email', email);
        callback(email);
      }
    }],{
      type: 'plain-text'
    });
  }

  /**
  * Returns application-specific state
  * {hideMarkers, hidePolyline, hideGeofences, email}
  */
  getApplicationState(callback) {
    if (this.applicationState) {
      callback(this.applicationState);
    } else {
      this._loadApplicationState(callback);
    }
  }

  getApplicationSettings(group) {
    if (group !== undefined) {
      let settings = [];
      return APP_SETTINGS.filter((setting) => { return setting.group === group; });
    } else {
      return APP_SETTINGS;
    }
  }

  getPlatform() {
    return this.platform;
  }

  /**
  * Returns a list of BackgroundGeolocation settings by group
  * @param {String} group
  * @return {Array}
  */
  getPluginSettings(group) {
    if (group === undefined) {
      return this.settings.items;
    } else {
      let settings = [];
      this.settings.items.forEach((setting) => {
        if (setting.group === group && !setting.ignore) {
          settings.push(setting);
        }
      });
      return settings;
    }
  }

  /**
  * Returns the current plugin state.  If this is the first boot of the app, returns a default state of
  * {
    debug: true,
    logLevel: BackgroundGeolocation.LOG_LEVEL_VERBOSE,
    foregroundService: true,
    autoSync: true,
    stopOnTerminate: false,
    url: TRACKER_HOST + this.username,
    startOnBoot: true,
    heartbeatInterval: 60,
    params : {
      device: {
        uuid: DeviceInfo.getUniqueID(),
        model: DeviceInfo.getModel(),
        platform: DeviceInfo.getSystemName(),
        manufacturer: DeviceInfo.getManufacturer(),
        version: DeviceInfo.getSystemVersion(),
        framework: 'ReactNative'
      }
    }
    First-boot is detected by querying AsyncStorage for Device "uuid".  When uuid is detected, the current plugin state
    is returned, as configured by the Settings screen.
  }
  * @return {Object}
  */
  getPluginState(callback) {
    // Determine if this is app first-boot.
    this.getUUID((uuid) => {
      if (!uuid) {
        BackgroundGeolocation.getState((state) => {
          // First boot:  Override default options from plugin state.
          // We want to start with debug: true.
          console.log("Debug getPluginState ", state)
          this.setUUID(DeviceInfo.getUniqueID());  // <-- flag to detect we've booted before
          state.debug = true;
          state.logLevel = BackgroundGeolocation.LOG_LEVEL_VERBOSE;
          state.foregroundService = true;
          state.autoSync = true;
          state.stopOnTerminate = false;
          state.url = TRACKER_HOST + this.username;
          state.startOnBoot = true;
          state.heartbeatInterval = 60;
          state.params = {
            device: {
              uuid: DeviceInfo.getUniqueID(),
              model: DeviceInfo.getModel(),
              platform: DeviceInfo.getSystemName(),
              manufacturer: DeviceInfo.getManufacturer(),
              version: DeviceInfo.getSystemVersion(),
              framework: 'ReactNative'
            }
          }
          this.pluginState = state;
          callback(state);
        });
      } else {
        BackgroundGeolocation.getState((state) => {
          this.pluginState = state;
          callback(state);
        });
      }
    });
  }

  /**
  * Determines if plugin is in location or geofences-only mode
  * @return {Boolean}
  */
  isLocationTrackingMode() {
    return (this.pluginState.trackingMode === 1) || (this.pluginState.trackingMode === 'location');
  }

  /**
  * Application settings change handler method used in SettingsView.  This method buffers change-events by 500ms.
  * When the buffer timer expires, the change will be persisted in AsyncStorage.
  * NOTE:  This is only for "application" settings -- not BackgroundGeolocation settings.
  * @param {Object} setting
  * @param {Mixed} value
  */
  onChange(setting, value) {
    if (typeof(setting) === 'string') {
      let name = setting;
      setting = APP_SETTINGS.find((item) => {
        return item.name === name
      });
      if (!setting) {
        console.warn('SettingsService#onChange failed to find setting: ', name);
        return;
      }
    }
    switch(setting.dataType) {
      case 'integer':
        value = parseInt(value, 10);
        break;
    }
    // Buffer field-changes by 500ms
    if (this.changeBuffer) {
      this.changeBuffer = clearTimeout(this.changeBuffer);
    }
    this.changeBuffer = setTimeout(() => {
      this.set(setting.name, value);
    }, 500);
  }

  /**
  * Sets and persists a single Application setting
  * @param {String} name
  * @param {Mixed} value
  */
  set(name, value) {
    if (this.applicationState[name] === value) {
      // No change.  Ignore
      return;
    }
    this.applicationState[name] = value;
    this._saveState();
  }

  /**
  * Helper method to show a confirmation dialog
  * @param {String} title
  * @param {String} message
  * @param {Function} callback
  */
  confirm(title, message, callback) {
    // Works on both iOS and Android
    Alert.alert(title, message, [
      {text: 'Cancel', onPress: () => {}},
      {text: 'OK', onPress: callback},
    ], { cancelable: false });
  }

  /**
  * Helper method to show a [YES] [NO] dialog
  * @param {String} title
  * @param {String} message
  * @param {Function} yesFn Called when user clicks [YES] button
  * @param {Function} noFn Called when user clicks [NO] button
  */
  yesNo(title, message, yesFn, noFn) {
    Alert.alert(title, message, [
      {text: 'No', onPress: noFn},
      {text: 'Yes', onPress: yesFn},
    ], { cancelable: false });
  }
  /**
  * Show a toast message
  * @param {String} message
  * @param {String} duration LONG|SHORT
  */
  toast(message, duration) {
    duration = duration || 'LONG';
    // Add a Toast on screen.
    let toast = Toast.show(message, {
      duration: Toast.durations[duration.toUpperCase()],
      position: Toast.positions.BOTTOM,
      shadow: true,
      animation: true,
      hideOnPress: true,
      delay: 0
    });
  }

  /**
  * Auto-build a scheule based upon current time.
  *                ______________..._______________                      ___...
  * ______________|                                |____________________|
  * |<-- delay -->|<---------- duration ---------->|<---- interval ---->|<-- duration -->
  *
  * @param {Integer} count How many schedules to generate?
  * @param {Integer} delay How many minutes in future to start generating schedules
  * @param {Integer} duration How long is each trigger event
  * @param {Integer} interval How long between trigger events
  */
  generateSchedule(count, delay, duration, interval) {
    // Start 2min from now
    var now = new Date();
    var start = new Date(now.getTime() + delay*60000);

    var rs = [];
    for (var n=0,len=count;n<len;n++) {
      var end = new Date(start.getTime() + duration*60000);
      var schedule = '1-7 ' + start.getHours()+':'+start.getMinutes() + '-' + end.getHours()+':'+end.getMinutes();
      start = new Date(end.getTime() + interval*60000);
      rs.push(schedule);
    }
    return rs;
  }

  /**
  * Returns lists of available values for geofence radius select box in Views
  * @return {Array}
  */
  getRadiusOptions() {
    return GEOFENCE_RADIUS_OPTIONS;
  }

  /**
  * Returns list of available values for loiteringDelay select box in Views
  * @return {Array}
  */
  getLoiteringDelayOptions() {
    return GEOFENCE_LOITERING_DELAY_OPTIONS;
  }

  /**
  * Returns an array of test-geofences suitable for sending to BackgroundGeolocation#addGeofences
  * @param {Function} callback
  * @return {Array}
  */
  getTestGeofences() {
    var data = this.getCourseData();
    var geofences = [];

    for (var n=0, len=data.length;n<len;n++) {
      ++geofenceNextId
      geofences.push({
        identifier: data[n].identifier,
        extras: {
          "geofence_extra_foo": "extra geofence data"
        },
        latitude: data[n].lat,
        longitude: data[n].lng,
        radius: data[n].radius,
        notifyOnEntry: true, //config.notifyOnEntry,
        notifyOnExit: true, //config.notifyOnExit,
        notifyOnDwell: false, //config.notifyOnDwell,
        loiteringDelay: 0 //config.loiteringDelay
      });
      console.log("Pushed geofence " + geofenceNextId)
    }
    return geofences;
  }

  /**
  * Helper method to play a UI sound via BackgroundGeolocation#playSound
  * @param {String/Number} name/soundId
  */
  playSound(name) {
    var soundId = 0;

    if (typeof(name) === 'string') {
      soundId = SOUND_MAP[this.platform][name];
    } else if (typeof(name) === 'number') {
      soundId = name;
    }
    if (!soundId) {
      alert('Invalid sound id provided to BGService#playSound' + name);
      return;
    }
    BackgroundGeolocation.playSound(soundId);
  }

  /**
  * Returns an array of greens. Tees to come later when
  * @return {Array}
  */
  getCourseData() {

    let greens =
    [
      // In front of Murphy's
      {'identifier':'M1','lat':'45.587004','lng':'-122.754586', 'radius':'20'},
      {'identifier':'M2','lat':'45.586726','lng':'-122.753674', 'radius':'20'},
      {'identifier':'M3','lat':'45.586426','lng':'-122.752730', 'radius':'20'},
      // OHGCC greens
      {'identifier':'G1','lat':'45.579909','lng':'-122.331377','radius':'22'},
      {'identifier':'G2','lat':'45.581636','lng':'-122.330188','radius':'23'},
      {'identifier':'G3','lat':'45.582032','lng':'-122.327205','radius':'20'},
      {'identifier':'G4','lat':'45.580374','lng':'-122.330795','radius':'18'},
      {'identifier':'G5','lat':'45.579089','lng':'-122.331899','radius':'10'},
      {'identifier':'G6','lat':'45.578624','lng':'-122.327512','radius':'25'},
      {'identifier':'G7','lat':'45.57955','lng':'-122.327393','radius':'25'},
      {'identifier':'G8','lat':'45.578742','lng':'-122.331802','radius':'22'},
      {'identifier':'G9','lat':'45.580013','lng':'-122.327394','radius':'15'},
      {'identifier':'G10','lat':'45.582404','lng':'-122.321087','radius':'22'},
      {'identifier':'G11','lat':'45.58188','lng':'-122.326','radius':'20'},
      {'identifier':'G12','lat':'45.583064','lng':'-122.325373','radius':'22'},
      {'identifier':'G13','lat':'45.58232','lng':'-122.318582','radius':'22'},
      {'identifier':'G14','lat':'45.58148','lng':'-122.316002','radius':'25'},
      {'identifier':'G15','lat':'45.578263','lng':'-122.315985','radius':'25'},
      {'identifier':'G16','lat':'45.581242','lng':'-122.318113','radius':'25'},
      {'identifier':'G17','lat':'45.581812','lng':'-122.320062','radius':'25'},
      {'identifier':'G18','lat':'45.581015','lng':'-122.326034','radius':'25'},    ]
    return greens;

  }

  /**
  * Returns the default application-settings {}
  * @return {Object}
  */
  _getDefaultState() {
    let state = {};
    APP_SETTINGS.forEach((setting) => {
      state[setting.name] = setting.defaultValue;
    });
    return state;
  }

  /**
  * Load the application-settings from AsyncStorage
  * @param {Function} callback
  */
  _loadApplicationState(callback) {
    AsyncStorage.getItem(STORAGE_KEY + ":settings", (err, value) => {
      if (value) {
        this.applicationState = JSON.parse(value);
      } else {
        this.applicationState = this._getDefaultState();
        this._saveState();
      }

      if (typeof(callback) === 'function') {
        callback(this.applicationState);
      }
    });
  }

  /**
  * Persist the application settings to AsyncStorage
  */
  _saveState() {
    AsyncStorage.setItem(STORAGE_KEY + ":settings", JSON.stringify(this.applicationState, null));
  }
}

module.exports = SettingsService;
