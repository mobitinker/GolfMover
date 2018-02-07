
import React, { Component } from 'react';
import {
  Platform,
  StyleSheet,
  View
} from 'react-native';
import firebase from 'react-native-firebase';
import Modal from "react-native-modal";

// For posting to tracker.transistorsoft.com
import DeviceInfo from 'react-native-device-info';

import ActionButton from 'react-native-action-button';

// Import native-base UI components
import {
  Container,
  Button, Icon,
  Text,
  Header, Footer, Title,
  Content,
  Left, Body, Right,
  Switch,
  Spinner
} from 'native-base';

////
// Import BackgroundGeolocation plugin
// Note: normally you will not specify a relative url ../ here.  I do this in the sample app
// because the plugin can be installed from 2 sources:
//
// 1.  npm:  react-native-background-geolocation
// 2.  private github repo (customers only):  react-native-background-geolocation-android
//
// This simply allows one to change the import in a single file.
import BackgroundGeolocation from 'react-native-background-geolocation';

// react-native-maps
import MapView from 'react-native-maps';
const LATITUDE_DELTA = 0.00922;
const LONGITUDE_DELTA = 0.00421;

import App from '../App';

import {COLORS, SOUNDS} from './lib/config';
import SettingsView from './SettingsView';
import SettingsService from './lib/SettingsService';

//const TRACKER_HOST = 'https://tracker.transistorsoft.com/locations/';
const TRACKER_HOST = 'https://golfmover-test.herokuapp.com/locations/';
const STATIONARY_REGION_FILL_COLOR = "rgba(200,0,0,0.2)"
const STATIONARY_REGION_STROKE_COLOR = "rgba(200,0,0,0.2)"
const GEOFENCE_STROKE_COLOR = "rgba(17,183,0,0.5)"
const GEOFENCE_FILL_COLOR   ="rgba(17,183,0,0.2)"
const GEOFENCE_STROKE_COLOR_ACTIVATED = "rgba(127,127,127,0.5)";
const GEOFENCE_FILL_COLOR_ACTIVATED = "rgba(127,127,127, 0.2)";
const POLYLINE_STROKE_COLOR = "rgba(32,64,255,0.6)";

// FAB button / map-menu position is tricky per platform / device.
let ACTION_BUTTON_OFFSET_Y  = 70;
if (Platform.OS == 'android') {
  ACTION_BUTTON_OFFSET_Y = 65;
} else if (DeviceInfo.getModel() === 'iPhone X') {
  ACTION_BUTTON_OFFSET_Y = 95;
}

export default class MyRoundView extends Component<{}> {
  constructor(props) {
    super(props);

    let t = (new Date()).getTime()

    this.state = {
      enabled: false,
      isMoving: false,
      trackingMode: "location", //mkm
      motionActivity: {activity: 'unknown', confidence: 100},
      lastMotionChangeLocation: undefined,
      lastMotionTime: t,
      odometer: 0,
      username: props.navigation.state.params.username,
      // ActionButton state
      isMainMenuOpen: true,
      isSyncing: false,
      isEmailingLog: false,
      isDestroyingLocations: false,
      // Map state
      centerCoordinate: {
        latitude: 0,
        longitude: 0
      },
      isPressingOnMap: false,
      mapScrollEnabled: false,
      showsUserLocation: false,
      followsUserLocation: false,
      stationaryLocation: {timestamp: '',latitude:0,longitude:0},
      stationaryRadius: 0,
      markers: [],
      stopZones: [],
      geofences: [],
      geofencesHit: [],
      geofencesHitEvents: [],
      coordinates: [],
      // Application settings
      settings: {},
      // BackgroundGeolocation state
      bgGeo: {},
      // Firebase stuff
      db: null,
      currentRoundRef: null,
      currentRound: this.newCurrentRound(null),
      // UI stuff
      showStopConfirm: false
    };

    this.settingsService = SettingsService.getInstance();
    this.settingsService.setUsername(this.state.username);
  }

  componentDidMount() {

    // Fetch BackgroundGeolocation current state and use that as our config object.
    // We use the config as persisted by the
    // settings screen to configure the plugin.
    this.settingsService.getPluginState((state) => {
      this.configureBackgroundGeolocation(state);
    });

    // Fetch current app settings state.
    this.settingsService.getApplicationState((state) => {
      this.setState({
        settings: state
      });
    });

    let db = firebase.database()
    // Get database
    this.setState( {
      db: db
    });

    //TODO debug remove previous data for easier debugging
    db.ref("activityChanges").remove()
    db.ref("errors").remove()
    db.ref("events").remove()
    db.ref("motionchange").remove()
    db.ref("motionChanges").remove()
  }

  configureBackgroundGeolocation(config) {
    // Step 1:  Listen to events:
    BackgroundGeolocation.on('location', this.onLocation.bind(this));
    BackgroundGeolocation.on('motionchange', this.onMotionChange.bind(this));
    BackgroundGeolocation.on('activitychange', this.onActivityChange.bind(this));
    BackgroundGeolocation.on('providerchange', this.onProviderChange.bind(this));
    BackgroundGeolocation.on('geofenceschange', this.onGeofencesChange.bind(this));
    BackgroundGeolocation.on('powersavechange', this.onPowerSaveChange.bind(this));
    BackgroundGeolocation.on('heartbeat', this.onHeartbeat.bind(this));
    BackgroundGeolocation.on('http', this.onHttp.bind(this));
    BackgroundGeolocation.on("geofence", this.onGeofence.bind(this));
    //TODO remove BackgroundGeolocation.on("schedule", this.onSchedule.bind(this));

    // Step 2:  #configure:
    // Values from setup are not loaded at startup. Set key parameters here
    config.desiredAccuracy = 0                // GPS, wifi and cellular
    config.activityRecognitionInterval = 1000
    config.stopTimeout = 0
    config.stopOnTerminate = true
    config.stopOnStationary = false
    config.forceReloadOnHeartbeat = true
    config.foregroundService = true
    config.notifyOnEntry = true
    config.notifyOnExit = true
    config.url = TRACKER_HOST + this.state.username

    // TODO determine how to only get for current course
    config.geofenceProximityRadius = 10000  // Should get all for current course

    BackgroundGeolocation.configure(config, (state) => {
      state.enabled = false  //Force user to restart round
      this.setState({
        enabled: state.enabled,
        isMoving: state.isMoving,
        followsUserLocation: state.enabled,
        showsUserLocation: state.enabled,
        bgGeo: state
      });
    });

    // Clear, then add course geofences
    BackgroundGeolocation.removeGeofences();
    let geofences = this.settingsService.getTestGeofences();
    BackgroundGeolocation.addGeofences(geofences, () => {
      console.log('Loaded geofences')
    }, () => {
      this.settingsService.toast('Failed to load geofences');
    });
    console.log("Done mounting")
  }

  /**
  * Log a message in 'errors' on Firebase
  */
  logError(msg) {
    console.log("Logging: ", msg)
    this.state.db.ref("errors").push(
      {
        errorTime : firebase.database.ServerValue.TIMESTAMP,
        error: msg,
      }
    )

  }

  /**
  * @event location
  */
  onLocation(location) {
    console.log('[event] location: ', location);
    /* This hits a bug in BackgroundGeolocation
      BackgroundGeolocation.getCount((count) => {
        if (count) {
          console.log('debug Locations in DB: ', BackgroundGeolocation.getCount())
          return
        } else {
          console.log('debug The db is empty')
          return
        }
      })
    */
    // Log event
    this.state.db.ref("events").push(
      {
        eventName: "location",
        eventTime : firebase.database.ServerValue.TIMESTAMP,
        location : location
      }
    )

    if (this.state.currentRound) {
      cr = this.state.currentRound
      cr.currentLocation = location
      if (this.state.currentRoundRef) {
        this.state.currentRoundRef.set(cr)
      }
    }

    if (!location.sample) {
      this.addMarker(location);
      this.setState({
        odometer: (location.odometer/1000).toFixed(1)
      });
    }
    this.setCenter(location);
  }

  /**
  * @event motionchange
  */
  onMotionChange(event) {
    console.log('[event] motionchange: ', event.isMoving, event.location);
    let t = (new Date()).getTime()
    let eventTime = t
    let duration = eventTime - this.state.lastMotionTime

    // Log event
    this.state.db.ref("events").push(
      {
        eventName: "motionchange",
        eventTime : eventTime,
        isMoving : event.isMoving,
        location : event.location
      }
    )

    let location = event.location;

    //TODO determine what's being done here. Confusing with state and this.state naming
    let state = {
      isMoving: event.isMoving
    };
    if (event.isMoving) {
      // We've gone to moving
      if (this.state.lastMotionChangeLocation) {
        state.stopZones = [...this.state.stopZones, {
          coordinate: {
            latitude: this.state.lastMotionChangeLocation.coords.latitude,
            longitude: this.state.lastMotionChangeLocation.coords.longitude
          },
          key: this.state.lastMotionChangeLocation.timestamp
        }];
      }

      // Report end of stopped to Firebase
      let cr = this.state.currentRound
      if (cr) {
        cr.moving = true
        cr.timeStill = cr.timeStill + duration
        cr.curLocation = event.location
        cr.curLocationTime = t
        this.setState({
          currentRound: cr,
          location : event.location
        })
        this.state.currentRoundRef.set(cr)
      }
      state.stationaryRadius = 0,
      state.stationaryLocation = {
        timestamp: '',
        latitude: 0,
        longitude: 0
      };
    } else {
      // We've gone to "Still"
      state.stationaryRadius = (this.settingsService.isLocationTrackingMode()) ? 200 : (this.state.bgGeo.geofenceProximityRadius/2);
      state.stationaryLocation = {
        timestamp: location.timestamp,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      };

      // Report end of moving to Firebase
      let cr = this.state.currentRound
      if (cr) {
        cr.moving = false
        cr.timeMoving = cr.timeMoving + duration
        cr.curLocation = event.location
        cr.curLocationTime = t
        this.setState({
          currentRound: cr,
          location : event.location
        })
        if (this.state.currentRoundRef) {
          this.state.currentRoundRef.set(cr)
        }
      }
    }
    //TODO try combining setStates below
    this.setState(state);
    this.setState({
      lastMotionChangeLocation: location,
      lastMotionTime: eventTime
    })
  }

  /**
  * @event activitychange
  */
  onActivityChange(event) {
    console.log('[event] activitychange: ', event);
    this.setState({
      motionActivity: event
    });

    this.state.db.ref("events").push(
      {
        eventName: "activitychange",
        eventTime : firebase.database.ServerValue.TIMESTAMP,
        activity : event.activity,
        confidence : event.confidence
      }
    )
  }

  /**
  * @event heartbeat
  */
  onHeartbeat(params) {
    console.log("- heartbeat: ", params.location);
    //TODO Experiment with the following
    /*

    BackgroundGeolocation.getCurrentPosition(function(location) {
      // This location is already persisted to plugin’s SQLite db.
      // If you’ve configured #autoSync: true, the HTTP POST has already started.
      console.log(“- Current position received: “, location);
    }, function(errorCode) {
      alert('An location error occurred: ' + errorCode);
    }, {
      timeout: 30,      // 30 second timeout to fetch location
      maximumAge: 5000, // Accept the last-known-location if not older than 5000 ms.
      desiredAccuracy: 10,  // Try to fetch a location with an accuracy of `10` meters.
      samples: 3,   // How many location samples to attempt.
      extras: {         // [Optional] Attach your own custom `metaData` to this location.  This metaData will be persisted to SQLite and POSTed to your server
            // Could set the source of location to "sourceEvent":"heartbeat"
        foo: "bar"
      }
    });
    */
  }  // onHeartbeat

  /**
  * @event providerchange
  */
  onProviderChange(event) {
    console.log('[event] providerchange', event);
    // Log event
    this.state.db.ref("events").push(
      {
        eventName: "providerchange",
        eventTime : firebase.database.ServerValue.TIMESTAMP,
        location : event.location,
        event: event
      }
    )
  }

  /**
  * @event http
  */
  onHttp(response) {
    console.log('- http ' + response.status);
    // Log event
    /*
    this.state.db.ref("http").push(
      {
        eventName: "http",
        eventTime : firebase.database.ServerValue.TIMESTAMP,
        response : response
      }
    )
    */
  }

  /**
  * @event geofenceschange
  */
  onGeofencesChange(event) {
    // Log event
    this.state.db.ref("events").push(
      {
        eventName: "geofenceschange",
        eventTime : firebase.database.ServerValue.TIMESTAMP,
        on: event.on                      //List of active geofences
      }
    )

    var on  = event.on;
    var off = event.off;
    var geofences  = this.state.geofences;

    // Filter out all "off" geofences.
    geofences = geofences.filter(function(geofence) {
      return off.indexOf(geofence.identifier) < 0;
    });

    // Add new "on" geofences.
    on.forEach(function(geofence) {
      var marker = geofences.find(function(m) { return m.identifier === geofence.identifier;});
      if (marker) { return; }
      geofences.push(this.createGeofenceMarker(geofence));
    }.bind(this));

    this.setState({
      geofences: geofences
    });
  }

  /**
  * @event geofence
  */
  onGeofence(geofence) {
    // Log event
    this.state.db.ref("events").push(
      {
        eventName: "geofence",
        eventTime : firebase.database.ServerValue.TIMESTAMP,
        location : geofence.location,
        identifier : geofence.identifier,
        action : geofence.action,
        //extras : event.extras,
      }
    )

    let location = geofence.location;
    var marker = this.state.geofences.find((m) => {
      return m.identifier === geofence.identifier;
    });
    if (!marker) { return; }

    marker.fillColor = GEOFENCE_STROKE_COLOR_ACTIVATED;
    marker.strokeColor = GEOFENCE_STROKE_COLOR_ACTIVATED;

    let coords = location.coords;

    let hit = this.state.geofencesHit.find((hit) => {
      return hit.identifier === geofence.identifier;
    });
    if (!hit) {
      hit = {
        identifier: geofence.identifier,
        radius: marker.radius,
        center: {
          latitude: marker.center.latitude,
          longitude: marker.center.longitude
        },
        events: []
      };
      // TODO may need to prevent duplicates from being added
      this.setState({
        geofencesHit: [...this.state.geofencesHit, hit]
      });
    }
    // Get bearing of location relative to geofence center.
    let bearing = this.getBearing(marker.center, location.coords);
    let edgeCoordinate = this.computeOffsetCoordinate(marker.center, marker.radius, bearing);
    let event = {
      coordinates: [
        edgeCoordinate,
        {latitude: coords.latitude, longitude: coords.longitude},
      ],
      action: geofence.action,
      key: geofence.identifier + ":" + geofence.action + ":" + location.timestamp
    };
    this.setState({
      geofencesHitEvents: [...this.state.geofencesHitEvents, event]
    });
  }

  /**
  * @event schedule
  */
  // Todo remove
  /*
  onSchedule(state) {
    console.log("- schedule", state.enabled, state);
    this.setState({
      enabled: state.enabled
    });
  }
  */

  /**
  * @event powersavechange
  */
  // Todo remove
  onPowerSaveChange(isPowerSaveMode) {
    console.log('[event] powersavechange', isPowerSaveMode);
    // Log event
    this.state.db.ref("events").push(
      {
        eventName: "powersavechange",
        eventTime : firebase.database.ServerValue.TIMESTAMP,
        isPowerSaveMode : isPowerSaveMode
      }
    )
  }

  clearModal = () => {
    this.setState({showStopConfirm: false})
  }

  /**
  * If user confirms, turn off plugin here
  */
  endRound() {
    // Log event
    this.state.db.ref("events").push(
      {
        eventTime : firebase.database.ServerValue.TIMESTAMP,
        eventName : "pluginstatechange",
        enabled : false
      }
    )

    BackgroundGeolocation.stop();
    // Clear markers, polyline, geofences, stationary-region
    this.clearMarkers();
    this.setState({
      stationaryRadius: 0,
      stationaryLocation: {
        timestamp: '',
        latitude: 0,
        longitude: 0
      },
      enabled: false,
      isMoving: false,
      showsUserLocation: false,
      followsUserLocation: false,
      showStopConfirm: false
    });

    //TODO update and move to completedRounds
    if (this.state.currentRoundRef) {
      this.state.currentRoundRef.remove()
      this.setState({
        currentRoundRef: null
      })
    }
  }

  /**
  * Toggle button handler for round start / stop
  */
  onPlayStateChanged() {
    console.log("About to change play state to ", !this.state.enabled)

    let enabled = !this.state.enabled;

    if (enabled) {
      // Start the plugin

      // Log event
      this.state.db.ref("events").push(
        {
          eventTime : firebase.database.ServerValue.TIMESTAMP,
          eventName : "pluginstatechange",
          enabled : enabled
        }
      )

      this.setState({
        enabled: enabled,
        isMoving: false,
        showsUserLocation: false,
        followsUserLocation: false
      });

      let t = (new Date()).getTime()
      BackgroundGeolocation.start((state) => {
        // We tell react-native-maps to access location only AFTER
        // the plugin has requested location, otherwise we have a permissions tug-of-war,
        // since react-native-maps wants WhenInUse permission
        this.setState({
          showsUserLocation: enabled,
          followsUserLocation: enabled,
          lastMotionChangeLocation: undefined,
          lastMotionTime: t,
        });
      });
      // Add a new current round to the database
      if (firebase.auth().currentUser) {
        let curUser = firebase.auth().currentUser._user
        // Create new current round
        cr = this.newCurrentRound(curUser)
        let currentRoundRef = this.state.db.ref("currentRounds").push(cr)
        this.setState({
          currentRoundRef: currentRoundRef,
          currentRound: cr
        })
      } else {
        console.log("Unexpected absence of current user")
      }
      this.settingsService.toast("Round recording on")
      console.log('Started location tracking mode');
    } else {
      this.settingsService.toast("Round recording off")
      this.setState({
        showStopConfirm: true
      })
    }
  }

  /**
  * get current position button handler
  */
  onClickGetCurrentPosition() {
    this.settingsService.playSound('BUTTON_CLICK');

    // When getCurrentPosition button is pressed, enable followsUserLocation
    // PanDrag will disable it.
    this.setState({
      followsUserLocation: true
    });

    BackgroundGeolocation.getCurrentPosition((location) => {
      console.log('- getCurrentPosition success: ', location);
      //this.logError('- getCurrentPosition success: ')
    }, (error) => {
      console.warn('- getCurrentPosition error: ', error);
      //this.logError('- getCurrentPosition error: ' + error)
    }, {
      persist: true,
      samples: 1
    });
  }

  /**
  * [>] / [||] button executes #changePace
  */
  // TODO Remove
  onClickChangePace() {
    console.log('- onClickChangePace');
    let isMoving = !this.state.isMoving;
    this.setState({isMoving: isMoving});
    BackgroundGeolocation.changePace(isMoving);
  }

  onClickHome() {
    App.goHome(this.props.navigation);
  }

  /**
  * FAB button show/hide handler
  */
  onClickMainMenu() {
    let soundId = (this.state.isMainMenuOpen) ? 'CLOSE' : 'OPEN';
    this.setState({
      isMainMenuOpen: !this.state.isMainMenuOpen
    });
    this.settingsService.playSound(soundId);
  }

  /**
  * FAB Button command handler
  */
  onSelectMainMenu(command) {
    switch(command) {
      case 'settings':
        this.settingsService.playSound('OPEN');
        this.props.navigation.navigate('Settings');
        break;
        case 'emailLog':
          this.settingsService.playSound('BUTTON_CLICK');
          this.emailLog();
          break;
      /*
      case 'resetOdometer':
        this.settingsService.playSound('BUTTON_CLICK');
        this.resetOdometer();
        break;
      case 'sync':
        this.settingsService.playSound('BUTTON_CLICK');
        this.sync();
        break;
      case 'destroyLocations':
        this.settingsService.playSound('BUTTON_CLICK');
        this.destroyLocations();
        break;
      */
    }
  }

  /**
  * Return a new currentRound object
  */
  newCurrentRound(curUser) {
    return {
      courseId: null,
      groupId: null,
      playerId: curUser ? curUser.uuid : null,
      playerEmail: curUser ? curUser.email : null,
      onfoot: true,
      curLocation: null,
      curLocationTime: null,
      timeStarted: firebase.database.ServerValue.TIMESTAMP,
      currentHole: 0,
      holeTimes: null,
      timeStill: 0,
      timeMoving: 0
    }
  }
  /* TODO remove
  resetOdometer() {
    this.clearMarkers();
    this.setState({isResettingOdometer: true, odometer: '0.0'});
    BackgroundGeolocation.setOdometer(0, () => {
      this.setState({isResettingOdometer: false});
      this.settingsService.toast('Reset odometer success');
    }, (error) => {
      this.setState({isResettingOdometer: false});
      this.settingsService.toast('Reset odometer failure: ' + error);
    });
  }
  */

  emailLog() {
    // First fetch the email from settingsService.
    this.settingsService.getEmail((email) => {
      if (!email) { return; }  // <-- [Cancel] returns null
      // Confirm email
      this.settingsService.yesNo('Email log', 'Use email address: ' + email + '?', () => {
        // Here we go...
        this.setState({isEmailingLog: true});
        BackgroundGeolocation.emailLog(email, () => {
          this.setState({isEmailingLog: false});
        }, (error) => {
          this.setState({isEmailingLog: false});
          this.settingsService.toast("Email log failure: " + error);
        });
      }, () => {
        // User said [NO]:  The want to change their email.  Clear it and recursively restart the process.
        this.settingsService.set('email', null);
        this.emailLog();
      });
    });
  }

  /* TODO Remove
  sync() {
    BackgroundGeolocation.getCount((count) => {
      if (!count) {
        this.settingsService.toast('Locations database is empty');
        return;
      }
      this.settingsService.confirm('Confirm Sync', 'Sync ' + count + ' records?', () => {
        this.setState({isSyncing: true});
        BackgroundGeolocation.sync((rs) => {
          this.settingsService.toast('Sync success (' + count + ' records)');
          //this.settingsService.playSound('MESSAGE_SENT');
          this.setState({isSyncing: false});
        }, (error) => {
          this.settingsService.toast('Sync error: ' + error);
          this.setState({isSyncing: false});
        });
      });
    });
  }

  destroyLocations() {
    BackgroundGeolocation.getCount((count) => {
      if (!count) {
        this.settingsService.toast('Locations database is empty');
        return;
      }
      this.settingsService.confirm('Confirm Delete', 'Destroy ' + count + ' records?', () => {
        this.setState({isDestroyingLocations: true});
        BackgroundGeolocation.destroyLocations(() => {
          this.setState({isDestroyingLocations: false});
          this.settingsService.toast('Destroyed ' + count + ' records');
        }, (error) => {
          this.setState({isDestroyingLocations: false});
          this.settingsService.toast('Destroy locations error: ' + error, null, 'LONG');
        });
      });
    });
  }
  */

  /**
  * Top-right map menu button-handler
  * [show/hide marker] [show/hide polyline] [show/hide geofence hits]
  */
  onClickMapMenu(command) {
    //this.settingsService.playSound('BUTTON_CLICK');

    let enabled = !this.state.settings['hideMarkers'];
    this.settingsService.set('hideMarkers', enabled);

    let settings = Object.assign({}, this.state.settings);
    settings['hideMarkers'] = enabled;

    this.setState({
      settings: settings
    });

    let message = ((enabled) ? 'Hide' : 'Show');
    switch (command) {
      case 'hideMarkers':
        message += ' map markers';
        break;
      /*
      case 'hidePolyline':
        message += ' polyline';
        break;
      case 'hideGeofenceHits':
        message += ' geofence transitions';
        break;
     */
    }
    this.settingsService.toast(message, 'SHORT');
  }

  // Show stop round confirmation in a modal
  renderStopPrompt = () => {
    return (
      <Modal isVisible={this.state.showStopConfirm}>
        <View style={{ flex: 1 }}>
          <Text style={styles.modalContent}>Are you sure you want to stop tracking your round?</Text>
          <Button style={styles.modalButton} onPress={this.endRound.bind(this)}>
            <Text>Yes</Text>
          </Button>
          <Button style={styles.modalButton} onPress={this.clearModal.bind(this)}>
            <Text>No</Text>
          </Button>
        </View>
      </Modal>
    )
  }

  /**
  * Render the back button only if tracking is off
  */
  renderBackButton() {
    if (!this.state.enabled) {
      return (
        <Button transparent small onPress={this.onClickHome.bind(this)}>
          <Icon active name="arrow-back" style={{color: '#000'}}/>
        </Button>
      )
    }
  }

  render() {
    return (
      <Container style={styles.container}>
        <Header style={styles.header}>
          <Left>
            {this.renderBackButton()}
          </Left>
          <Body>
            <Title style={styles.title}>My Round</Title>
          </Body>
          <Right>
            <Button small
              danger={this.state.enabled}
              success={!this.state.enabled}
              onPress={this.onPlayStateChanged.bind(this)}>
              <Text>{this.state.enabled ? "Stop" : "Start"}</Text>
            </Button>

          </Right>
        </Header>

        <MapView
          ref="map"
          style={styles.map}
          mapType="hybrid"
          showsUserLocation={this.state.showsUserLocation}
          followsUserLocation={false}
          onLongPress={this.onLongPress.bind(this)}
          onPanDrag={this.onMapPanDrag.bind(this)}
          scrollEnabled={this.state.mapScrollEnabled}
          showsMyLocationButton={false}
          showsPointsOfInterest={false}
          showsScale={false}
          showsTraffic={false}
          toolbarEnabled={false}>
          <MapView.Polyline
            key="polyline"
            coordinates={(!this.state.settings.hideMarkers) ? this.state.coordinates : []}
            geodesic={true}
            strokeColor='rgba(0,179,253, 0.6)'
            strokeWidth={6}
            zIndex={0}
          />
          {this.renderMarkers()}
          {this.renderStopZoneMarkers()}
          {this.renderActiveGeofences()}
          {this.renderGeofencesHit()}
          {this.renderGeofencesHitEvents()}
        </MapView>

        <View style={styles.mapMenu}>
          <Button small success light={this.state.settings.hideMarkers} style={styles.mapMenuButton} onPress={() => this.onClickMapMenu('hideMarkers') }>
            <Icon name="ios-pin" />
          </Button>
        </View>

        <ActionButton
          position="left"
          hideShadow={false}
          autoInactive={false}
          active={this.state.isMainMenuOpen}
          backgroundTappable={true}
          onPress={this.onClickMainMenu.bind(this)}
          icon={<Icon name="ios-add" size={25}/>}
          verticalOrientation="down"
          buttonColor="rgba(254,221,30,1)"
          buttonTextStyle={{color: "#000"}}
          spacing={15}
          offsetX={10}
          offsetY={ACTION_BUTTON_OFFSET_Y}>
          <ActionButton.Item size={40} buttonColor={COLORS.gold} onPress={() => this.onSelectMainMenu('settings')}>
            <Icon name="ios-cog" style={styles.actionButtonIcon} />
          </ActionButton.Item>
          <ActionButton.Item size={40} buttonColor={COLORS.gold} onPress={() => this.onSelectMainMenu('emailLog')}>
            {!this.state.isEmailingLog ? (<Icon name="ios-mail" style={styles.actionButtonIcon} />) : (<Spinner color="#000" size="small" />)}
          </ActionButton.Item>
        </ActionButton>
        {this.renderStopPrompt()}
        <Footer style={styles.footer}>
          <Left style={{flex:0.3}}>
            <Button small info onPress={this.onClickGetCurrentPosition.bind(this)}>
              <Icon active name="md-locate" style={styles.icon} />
            </Button>
          </Left>
          <Body style={styles.footerBody}>
            <Icon active name={this.getMotionActivityIcon()} style={styles.activityIcon}/>
            <Text style={styles.status}>
              S-{this.formatDuration(this.state.currentRound.timeStill)}
            </Text>
            <Text style={styles.status}>
              &nbsp; M-{this.formatDuration(this.state.currentRound.timeMoving)}
            </Text>
          </Body>
          <Right style={{flex: 0.3}}>
            {/*
            <Button small
              danger={this.state.isMoving}
              success={!this.state.isMoving}
              disabled={!this.state.enabled}
              onPress={this.onClickChangePace.bind(this)}>
              <Icon active name={(this.state.isMoving) ? 'pause' : 'play'} style={styles.icon}/>
            </Button>
            */}
          </Right>
        </Footer>

      </Container>

    );
  }

  /**
  * Format duration in ms as 00:00:00
  */
  formatDuration(durationMS) {
    var duration = Math.floor(durationMS / 1000)
    var hours   = Math.floor(duration / 3600)
    var minutes = Math.floor((duration - (hours * 3600)) / 60)
    var seconds = duration - (hours * 3600) - (minutes * 60)

    if (hours   < 10) {hours   = "0"+hours}
    if (minutes < 10) {minutes = "0"+minutes}
    if (seconds < 10) {seconds = "0"+seconds}
    //return hours + ':' + minutes + ':' + seconds;
    return hours + ':' + minutes
  }

  /**
  * Returns an icon for the current activityType
  */
  getMotionActivityIcon() {
    this.state.motionActivity.activity
    console.log("Getting icon for " + this.state.motionActivity.activity)
    switch (this.state.motionActivity.activity) {
      case 'unknown':
        return 'ios-help-circle';
      case 'still':
        return 'ios-body';
      case 'on_foot':
        return 'ios-walk';
      case 'walking':
        return 'ios-walk';
      case 'running':
        return 'ios-walk';
      case 'in_vehicle':
        return 'ios-car';
      case 'on_bicycle':
        return 'ios-bicycle';
      default:
        return 'ios-help-circle';
    }
  }

  // Show player's locations
  renderMarkers() {
    if (this.state.settings.hideMarkers) { return; }
    let rs = [];
    this.state.markers.map((marker) => {
      rs.push((
        <MapView.Marker
          key={marker.key}
          coordinate={marker.coordinate}
          anchor={{x:0, y:0.1}}
          title={marker.title}>
          <View style={[styles.markerIcon]}></View>
        </MapView.Marker>
      ));
    });
    return rs;
  }

  renderStopZoneMarkers() {
    return this.state.stopZones.map((stopZone) => (
      <MapView.Marker
        key={stopZone.key}
        coordinate={stopZone.coordinate}
        anchor={{x:0, y:0.1}}>
        <View style={[styles.stopZoneMarker]}></View>
      </MapView.Marker>
    ));
  }

  renderActiveGeofences() {
    return this.state.geofences.map((geofence) => (
      <View
        key={geofence.identifier}
        >
        <MapView.Circle
          key={geofence.identifier + "-c"}
          radius={geofence.radius}
          center={geofence.center}
          strokeWidth={1}
          strokeColor={geofence.strokeColor}
          fillColor={geofence.fillColor}
        />
        <MapView.Marker
          coordinate={geofence.center}
          anchor={{x:0.5,y:0.5}}
          key={geofence.identifier + "-m"}>
          <View style={styles.flag}>
            <Text style={styles.flagText}>{geofence.identifier}</Text>
          </View>
        </MapView.Marker>
      </View>
    ));
  }

  renderGeofencesHit() {
    if (this.state.settings.hideMarkers) { return; }
    let rs = [];
    return this.state.geofencesHit.map((hit) => {
      return (
        <MapView.Circle
          key={"hit:" + hit.identifier}
          radius={hit.radius+1}
          center={hit.center}
          strokeWidth={1}
          strokeColor={COLORS.black}>
        </MapView.Circle>
      );
    });
  }

  renderGeofencesHitEvents() {
    if (this.state.settings.hideGeofenceHits) { return; }
    return this.state.geofencesHitEvents.map((event) => {
      let isEnter = (event.action === 'ENTER');
      let color = undefined;
      switch(event.action) {
        case 'ENTER':
          color = COLORS.green;
          break;
        case 'EXIT':
          color = COLORS.red;
          break;
        case 'DWELL':
          color = COLORS.gold;
          break;
      }
      let markerStyle = {
        backgroundColor: color
      };
      return (
        <View key={event.key}>
          <MapView.Polyline
            key="polyline"
            coordinates={event.coordinates}
            geodesic={true}
            strokeColor={COLORS.black}
            strokeWidth={1}
            style={styles.geofenceHitPolyline}
            zIndex={1}
            lineCap="square" />
          <MapView.Marker
            key="edge_marker"
            coordinate={event.coordinates[0]}
            anchor={{x:0, y:0.1}}>
            <View style={[styles.geofenceHitMarker, markerStyle]}></View>
          </MapView.Marker>
          <MapView.Marker
            key="location_marker"
            coordinate={event.coordinates[1]}
            anchor={{x:0, y:0.1}}>
            <View style={styles.markerIcon}></View>
          </MapView.Marker>
        </View>
      );
    });
  }

  /**
  * Map methods
  */
  setCenter(location) {
    if (!this.refs.map) { return; }
    if (!this.state.followsUserLocation) { return; }

    this.refs.map.animateToRegion({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      latitudeDelta: LATITUDE_DELTA,
      longitudeDelta: LONGITUDE_DELTA
    });
  }

  addMarker(location) {
    var m = this.state.markers.find( (m) => { return m.key === location.uuid; })
    if (m != undefined) {
      console.log("Attempt to insert duplicate marker")
      return
    }

    let marker = {
      key: location.uuid,
      title: location.timestamp,
      heading: location.coords.heading,
      coordinate: {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      }
    };

    this.setState({
      markers: [...this.state.markers, marker],
      coordinates: [...this.state.coordinates, {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      }]
    });
  }

  createGeofenceMarker(geofence) {
    return {
      key: geofence.identifier,
      radius: geofence.radius,
      center: {
        latitude: geofence.latitude,
        longitude: geofence.longitude
      },
      identifier: geofence.identifier,
      strokeColor:GEOFENCE_STROKE_COLOR,
      fillColor: GEOFENCE_FILL_COLOR
    }
  }

  onMapPanDrag() {
    this.setState({
      followsUserLocation: false,
      mapScrollEnabled: true
    });
  }

  onLongPress(params) {
    return
    /*
    var coordinate = params.nativeEvent.coordinate;
    this.settingsService.playSound('LONG_PRESS_ACTIVATE');
    this.props.navigation.navigate('Geofence', {
      coordinate: coordinate
    });
    */
  }

  /* TODO remove
  onLoginRegister(params) {
    var coordinate = params.nativeEvent.coordinate;
    this.props.navigation.navigate('Auth', {
      coordinate: coordinate
    });
  }
  */

  clearMarkers() {
    this.setState({
      coordinates: [],
      markers: [],
      stopZones: [],
      geofencesHit: [],
      geofencesHitEvents: []
    });
  }

  /**
  * Map geometry methods for calculating Geofence hit-markers
  * TODO move to Utility class
  */
  toRad(n) {
    return n * (Math.PI / 180);
  }
  toDeg(n) {
    return n * (180 / Math.PI);
  }

  getBearing(start, end){
    let startLat = this.toRad(start.latitude);
    let startLong = this.toRad(start.longitude);
    let endLat = this.toRad(end.latitude);
    let endLong = this.toRad(end.longitude);

    let dLong = endLong - startLong;

    let dPhi = Math.log(Math.tan(endLat/2.0+Math.PI/4.0)/Math.tan(startLat/2.0+Math.PI/4.0));
    if (Math.abs(dLong) > Math.PI){
      if (dLong > 0.0)
         dLong = -(2.0 * Math.PI - dLong);
      else
         dLong = (2.0 * Math.PI + dLong);
    }
    return (this.toDeg(Math.atan2(dLong, dPhi)) + 360.0) % 360.0;
  }

  computeOffsetCoordinate(coordinate, distance, heading) {
    distance = distance / (6371*1000);
    heading = this.toRad(heading);

    var lat1 = this.toRad(coordinate.latitude), lon1 = this.toRad(coordinate.longitude);
    var lat2 = Math.asin(Math.sin(lat1) * Math.cos(distance) +
                        Math.cos(lat1) * Math.sin(distance) * Math.cos(heading));

    var lon2 = lon1 + Math.atan2(Math.sin(heading) * Math.sin(distance) *
                                Math.cos(lat1),
                                Math.cos(distance) - Math.sin(lat1) *
                                Math.sin(lat2));

    if (isNaN(lat2) || isNaN(lon2)) return null;

    return {
      latitude: this.toDeg(lat2),
      longitude: this.toDeg(lon2)
    };
  }
}

// TODO combine with global styles
var styles = StyleSheet.create({
  container: {
    backgroundColor: '#272727'
  },
  header: {
    backgroundColor: '#fedd1e'
  },
  title: {
    color: '#000'
  },
  footer: {
    backgroundColor: '#fedd1e',
    paddingLeft: 5,
    paddingRight: 5
  },
  footerBody: {
    justifyContent: 'center',
    width: 200,
    flex: 1
  },
  icon: {
    color: '#ffffff'
  },
  activityIcon: {
    color: '#000000',
    marginRight: 10
  },
  map: {
    flex: 1
  },
  actionButtonIcon: {
    fontSize: 24
  },
  status: {
    fontSize: 16
  },
  markerIcon: {
    borderWidth:1,
    borderColor:'#000000',
    backgroundColor: 'rgba(0,179,253, 0.6)',
    width: 10,
    height: 10,
    borderRadius: 5
  },
  stopZoneMarker: {
    borderWidth:1,
    borderColor: COLORS.red,
    backgroundColor: COLORS.red,
    borderRadius: 5,
    width: 10,
    height: 10
  },
  geofenceHitMarker: {
    borderWidth:1,
    borderColor:'black',
    borderRadius: 6,
    zIndex: 10,
    width: 12,
    height:12
  },
  markerIcon: {
    borderWidth:1,
    borderColor:'#000000',
    backgroundColor: COLORS.polyline_color,
    width: 10,
    height: 10,
    borderRadius: 5
  },
  // Map Menu on top-right.  What a pain to style this thing...
  mapMenu: {
    position:'absolute',
    right: 5,
    top: ACTION_BUTTON_OFFSET_Y,
    flexDirection: 'row'
  },
  mapMenuButton: {
    marginLeft: 10
  },
  mapMenuIcon: {
    color: '#000'
  },
  mapMenuButtonIcon: {
    marginRight: 0
  },
  motionActivityIcon: {
    fontSize: 24
  },
  flag: {
    width: 30,
    height: 30,
    borderRadius: 30 / 2,
    backgroundColor: 'red',
  },
  flagText: {
      color: 'white',
      textAlign: 'center',
      fontSize: 10,
      marginTop: 5,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  modalButton: {
    backgroundColor: "lightblue",
    padding: 12,
    margin: 16,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 4,
    borderColor: "rgba(0, 0, 0, 0.1)"
  },
  modalContent: {
    backgroundColor: "white",
    padding: 22,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 4,
    borderColor: "rgba(0, 0, 0, 0.1)"
  },
  bottomModal: {
    justifyContent: "flex-end",
    margin: 0
  }

});
