
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
import {courseMSG} from './courseMSG'

// Marker icons
import markerLocation from '../../images/marker_location.png'
import markerWaiting from '../../images/marker_waiting.png'
import markerWalking from '../../images/marker_walking.png'
import markerCart from '../../images/marker_cart.png'


// Import native-base UI components
import {
  Container,
  Button, Icon, Text,
  Header, Footer, Title,
  Content,
  Left, Body, Right,
  Switch,
  Spinner
} from 'native-base';
import { Col, Row, Grid } from 'react-native-easy-grid';

import BackgroundGeolocation from 'react-native-background-geolocation';
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
    //this._isMounted = false
    console.log("Hit constructor *********************")

    let t = (new Date()).getTime()

    //TODO comment all below
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
      /* TODO remove
      centerCoordinate: {
        latitude: 0,
        longitude: 0
      },
      */
      //isPressingOnMap: false,
      mapScrollEnabled: false,
      showsUserLocation: false,
      followsUserLocation: false,
      didFirstCenter: false,            // Set to true after first centering of map
      stationaryLocation: {timestamp: '',latitude:0,longitude:0},
      stationaryRadius: 0,
      markers: [],
      stopZones: [],
      hideMarkers: false,               // Currently always false
      coordinates: [],
      // Application settings
      settings: {},
      // BackgroundGeolocation state
      bgGeo: {},
      // Firebase stuff
      db: null,
      curUser: null,
      currentRoundRef: null,
      currentPathRef: null,
      currentRound: this.newCurrentRound(null),
      // UI stuff
      showStopConfirm: false
    };

    this.settingsService = SettingsService.getInstance();
    this.settingsService.setUsername(this.state.username);
  }

  /**
  * For catching setting state on unmounted component
  */
  setStateWithLog(state) {
    /*
    if (!this._isMounted) {
      console.log("******************** Attempt to set state after component unmounted", state)
      return
    }
    */
    //console.log("Setting state", state)
    this.setState(state)
  }

  componentDidMount() {
    console.log("Mounted **************************************************")
    //this._isMounted = true
    // Fetch BackgroundGeolocation current state and use that as our config object.
    // We use the config as persisted by the
    // settings screen to configure the plugin.
    this.settingsService.getPluginState((state) => {
      this.configureBackgroundGeolocation(state);
    });

    // Fetch current app settings state.
    this.settingsService.getApplicationState((state) => {
      this.setStateWithLog({
        settings: state
      });
    });

    let db = firebase.database()
    // Get database
    this.setStateWithLog( {
      db: db
    });

    // Easy way to remove previous data for easier debugging
    /*
    db.ref("errors").remove()
    db.ref("paths").remove()
    db.ref("rounds").remove()
    */

    let authUser = firebase.auth().currentUser
    if (authUser) {
      firebase.database().ref('users/' + authUser.uid).once('value')
        .then( snapshot => {
          this.setStateWithLog({
            curUser: snapshot.val()
          })
        })
        .catch(e => {
          console.log("Error getting user data", e)
        })
    }
  }

  componentWillUnmount() {
    //this._isMounted = false
    console.log("Unmounting **************************************************")
  }

  configureBackgroundGeolocation(config) {
    // Set up event listeners. We only use a few. See docs for heartbeat, geofence etc
    BackgroundGeolocation.on('location', this.onLocation.bind(this));
    BackgroundGeolocation.on('motionchange', this.onMotionChange.bind(this));
    BackgroundGeolocation.on('activitychange', this.onActivityChange.bind(this));

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

    BackgroundGeolocation.configure(config, (bgGeoState) => {
      bgGeoState.enabled = false  //Force user to restart round
      this.setStateWithLog({
        enabled: bgGeoState.enabled,
        isMoving: bgGeoState.isMoving,
        followsUserLocation: bgGeoState.enabled,
        showsUserLocation: bgGeoState.enabled,
        bgGeo: bgGeoState
      });
    });

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
  * Pushes location to the appropriate ref for the round. Creates a new path if needed
  */
  addLocToPlayerPath(location) {
    // Skip it if no round is in progress
    if (this.state.currentRoundRef == null)
      return;
    let currentRoundId = this.state.currentRoundRef.key;
    if (!this.state.currentPathRef) {
      // Create a new path for this round
      this.state.currentPathRef = this.state.db.ref("paths/" + currentRoundId + "/locations")
    }
    this.state.currentPathRef.push({
      locationTime: firebase.database.ServerValue.TIMESTAMP,
      location: location
    })

  }

  /**
  * @event location
  */
  onLocation(location) {
    //console.log('[event] location: ', location);

    // Update current round with current location
    if (this.state.currentRound) {
      cr = this.state.currentRound
      cr.curLocation = location
      if (this.state.currentRoundRef) {
        this.state.currentRoundRef.set(cr)
      }
    }

    this.addLocToPlayerPath(location)

    if (!location.sample) {
      this.addMarker(location);
      this.setStateWithLog({
        odometer: (location.odometer/1000).toFixed(1)
      });
    }
    this.setCenter(location);
  }

  /**
  * @event motionchange
  */
  onMotionChange(event) {
    //console.log('[event] motionchange: ', event.isMoving, event.location);
    let t = (new Date()).getTime()
    let eventTime = t
    let duration = eventTime - this.state.lastMotionTime

    let location = event.location;
    this.addLocToPlayerPath(location)

    //TODO change name to be less confusing
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
        this.setStateWithLog({
          currentRound: cr,
          location : event.location
        })
        // what was this for ? this.state.currentRoundRef.set(cr)
      }
      state.stationaryRadius = 0,
      state.stationaryLocation = {
        timestamp: '',
        latitude: 0,
        longitude: 0
      };
    } else {
      // We've gone to "Still"
      state.stationaryRadius = 200
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
        this.setStateWithLog({
          currentRound: cr,
          location : event.location
        })
        if (this.state.currentRoundRef) {
          this.state.currentRoundRef.set(cr)
        }
      }
    }
    //TODO try combining setStates below
    this.setStateWithLog(state);
    this.setStateWithLog({
      lastMotionChangeLocation: location,
      lastMotionTime: eventTime
    })
  }

  /**
  * @event activitychange
  */
  onActivityChange(event) {
    //console.log('[event] activitychange: ', event);
    this.setStateWithLog({
      motionActivity: event
    });

  }

  clearModal = () => {
    this.setStateWithLog({showStopConfirm: false})
  }

  /**
  * If user confirms, turn off plugin here
  */
  endRound() {

    BackgroundGeolocation.stop();
    // Clear markers, polyline, stationary-region
    this.clearMarkers();
    this.setStateWithLog({
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

    // Update current round with round completed time. This will denote it
    // as no longer in progress
    if (this.state.currentRoundRef) {
      this.state.currentRoundRef.update({
          timeCompleted: firebase.database.ServerValue.TIMESTAMP
      })
    } else {
      console.log("Error: no currentRoundRef")
    }

    if (this.state.currentRoundRef) {
      this.setStateWithLog({
        currentRoundRef: null,
        currentPathRef: null
      })
    }
  }

  /**
  * Toggle button handler for round start / stop
  */
  onPlayStateChanged() {
    let enabled = !this.state.enabled;

    if (enabled) {
      // Start the plugin

      this.setStateWithLog({
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
        console.log("setting state after bg start")
        this.setStateWithLog({
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
        let currentRoundRef = this.state.db.ref("rounds").push(cr)
        this.setStateWithLog({
          currentRoundRef: currentRoundRef,
          currentRound: cr
        })
      } else {
        console.log("Unexpected absence of current user")
      }
      this.settingsService.toast("Round recording on")
      console.log('Started round');

    } else {
      this.settingsService.toast("Round recording off")
      console.log('Ending round')
      this.setStateWithLog({
        showStopConfirm: true
      })
    }
  }

  /**
  * Get location and pan to it on display
  */
  onClickGetCurrentPosition() {
    this.settingsService.playSound('BUTTON_CLICK');

    // When getCurrentPosition button is pressed, enable followsUserLocation
    // PanDrag will disable it.
    this.setStateWithLog({
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
    let isMoving = !this.state.isMoving;
    this.setStateWithLog({isMoving: isMoving});
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
    this.setStateWithLog({
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
      playerUID: curUser ? curUser.uid : null,
      pathId: null,
      playerEmail: curUser ? curUser.email : null,
      username: curUser ? curUser.username : null,
      onfoot: true,
      curLocation: null,
      curLocationTime: null,
      timeStarted: firebase.database.ServerValue.TIMESTAMP,
      timeCompleted: 0,
      currentHole: 0,
      holeTimes: null,
      timeStill: 0,
      timeMoving: 0
    }
  }

  /* TODO remove
  resetOdometer() {
    this.clearMarkers();
    this.setStateWithLog({isResettingOdometer: true, odometer: '0.0'});
    BackgroundGeolocation.setOdometer(0, () => {
      this.setStateWithLog({isResettingOdometer: false});
      this.settingsService.toast('Reset odometer success');
    }, (error) => {
      this.setStateWithLog({isResettingOdometer: false});
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
        this.setStateWithLog({isEmailingLog: true});
        BackgroundGeolocation.emailLog(email, () => {
          this.setStateWithLog({isEmailingLog: false});
        }, (error) => {
          this.setStateWithLog({isEmailingLog: false});
          this.settingsService.toast("Email log failure: " + error);
        });
      }, () => {
        // User said [NO]:  The want to change their email.  Clear it and recursively restart the process.
        this.settingsService.set('email', null);
        this.emailLog();
      });
    });
  }

  /**
  * Top-right map menu button-handler
  * [show/hide marker] [show/hide polyline]
  */
  onClickMapMenu(command) {
    //this.settingsService.playSound('BUTTON_CLICK');

    let enabled = !this.state.settings['hideMarkers'];
    this.settingsService.set('hideMarkers', enabled);

    let settings = Object.assign({}, this.state.settings);
    settings['hideMarkers'] = enabled;

    this.setStateWithLog({
      settings: settings
    });

    let message = ((enabled) ? 'Hide' : 'Show');
    switch (command) {
      case 'hideMarkers':
        message += ' map markers';
        break;
    }
    this.settingsService.toast(message, 'SHORT');
  }

  // Show stop round confirmation in a modal
  renderStopPrompt = () => {
    return (
      <Modal isVisible={this.state.showStopConfirm}>
        <Container>
          <Content contentContainerStyle={{flex: 1}} style={{padding: 10}}>
            <Text style={styles.modalContent}>Are you sure you want to stop tracking your round?</Text>
            <Grid style={{alignItems: 'center'}}>
              <Col size={1} style={{ height: 100 }}>
                <Button success size={1} style={styles.modalButton} onPress={this.endRound.bind(this)}>
                  <Text>Yes</Text>
                </Button>
              </Col>
              <Col size={1} style={{ height: 100 }}>
                <Button light size={1} style={styles.modalButton} onPress={this.clearModal.bind(this)}>
                  <Text>No</Text>
                </Button>
              </Col>
            </Grid>
          </Content>
        </Container>
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
          followsUserLocation={this.state.followsUserLocation}
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
            coordinates={this.state.coordinates}
            geodesic={true}
            strokeColor='rgba(0,179,253, 0.6)'
            strokeWidth={6}
            zIndex={0}
          />
          {this.renderMarkers()}
          {this.renderStopZoneMarkers()}
          {this.renderCourse()}
        </MapView>

        { /*
        <View style={styles.mapMenu}>
          <Button small success light={this.state.settings.hideMarkers} style={styles.mapMenuButton} onPress={() => this.onClickMapMenu('hideMarkers') }>
            <Icon name="ios-pin" />
          </Button>
        </View>
        */ }

        {this.renderActionButton()}
        {this.renderStopPrompt()}
        <Footer style={styles.footer}>
          <Left style={{flex:0.3}}>
            <Button small info onPress={this.onClickGetCurrentPosition.bind(this)}>
              <Icon active name="md-locate" style={styles.icon} />
            </Button>
          </Left>
          <Body style={styles.footerBody}>
            {/* < Icon active name={this.getMotionActivityIcon()} style={styles.activityIcon}/> */}
            <Text style={styles.status}>
              S-{this.formatDuration(this.state.currentRound.timeStill)}
            </Text>
            <Text style={styles.status}>
              &nbsp; M-{this.formatDuration(this.state.currentRound.timeMoving)}
            </Text>
          </Body>
          <Right style={{flex: 0.3}}>
            { this.renderActivityButton() }
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

  // Render current course
  renderCourse() {
    let rs = []
    // Parse the output from geoJSON.io
    let holes = courseMSG.features;
    let holeNumber = 0
    holes.map( hole => {
      let holePolygon = []
      hole.geometry.coordinates[0].map( c => {
        holePolygon.push({latitude: c[1], longitude: c[0]})
      })
      rs.push (
        <MapView.Polygon
          key = {++holeNumber}
          coordinates = {holePolygon}
          geodesic = {true}
          strokeColor = {COLORS.white}
          strokeWeight = {1}
        >
        </MapView.Polygon>
      )
    })
    return rs
  }

  renderActivityButton() {
    //if (this.isAdmin()) {
      return (
        <Button small
          danger={this.state.isMoving}
          success={!this.state.isMoving}
          disabled={!this.state.enabled}
          onPress={this.onClickChangePace.bind(this)}>
          <Icon active name={(this.state.isMoving) ? 'pause' : 'play'} style={styles.icon}/>
        </Button>
      )
    //}
  }

  // Show player's locations along path
  //TODO this gets called too many times
  renderMarkers() {
    //TODO remove
    //if (this.state.settings.hideMarkers) { return; }
    let rs = [];
    let cntMarkers = this.state.markers.length
    let m = 0

    // TODO remove (goes below)
    { /* coordinates={(!this.state.settings.hideMarkers) ? this.state.coordinates : []} */ }

    this.state.markers.map((marker) => {
      m += 1
      // Determine image to use
      let markerImage = markerLocation
      if (m == cntMarkers) {
        // This is the most recent/current location
        switch (this.state.motionActivity.activity) {
          case 'unknown':
          case 'still':
            markerImage = markerWaiting
            break
          case 'on_foot':
          case 'walking':
            markerImage = markerWalking
            break
          case 'running':
          case 'in_vehicle':
          case 'on_bicycle':
            markerImage = markerCart
            break
        }
      }

      let rotation = (m == cntMarkers ? 0 : marker.heading)
      if (marker.heading == -1) {
        rotation = 0
      }

      rs.push((
        <MapView.Marker
          key={marker.key}
          coordinate={marker.coordinate}
          anchor={{x:0, y:0.2}}
          title={marker.title}
          image={markerImage}
          />
      ));
    });
    return rs;
  }

  renderStopZoneMarkers() {
    return this.state.stopZones.map((stopZone) => (
      <MapView.Marker
        key={stopZone.key}
        coordinate={stopZone.coordinate}
        anchor={{x:0, y:0.2}}>
        <View style={[styles.stopZoneMarker]}></View>
      </MapView.Marker>
    ));
  }

  /**
  * Return true if user has admin role
  */
  isAdmin() {
    let result = false    //default false
    if (this.state.curUser) {
      result = 0 <= this.state.curUser.roles.indexOf("admin")
    } else {
      //console.log("No curUser set!")
    }
  }

  /**
  * Render the action button on left side of map
  */
  renderActionButton() {
    if (!this.isAdmin()) return

    return (
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

    )
  }

  /**
  * Map methods
  */
  setCenter(location) {
    if (!this.refs.map) {
      return;
    }
    if (!this.state.followsUserLocation && this.state.didFirstCenter) {
      return;
    }

    if (!location) {
      return;
    }

    this.setStateWithLog({
      didFirstCenter: true
    });

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

    this.setStateWithLog({
      markers: [...this.state.markers, marker],
      coordinates: [...this.state.coordinates, {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      }]
    });
  }

  onMapPanDrag() {
    this.setStateWithLog({
      followsUserLocation: false,
      mapScrollEnabled: true
    });
  }

  onLongPress(params) {
    return
  }

  clearMarkers() {
    this.setStateWithLog({
      coordinates: [],
      markers: [],
      stopZones: [],
    });
  }

}  // End of MyRoundView component

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
  modalButton: {
    margin: 10,
    /*
    justifyContent: "center",
    alignItems: "center",
    */
  },
  modalContent: {
    backgroundColor: "white",
    padding: 22,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 4,
    borderColor: "rgba(0, 0, 0, 0.1)"
  },

});
