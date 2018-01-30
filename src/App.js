/**
 * GolfMover
 */

import React, { Component } from 'react';
import firebase from 'react-native-firebase';
import { StackNavigator, NavigationActions } from 'react-navigation';

import {StyleProvider} from "native-base";
import Navigator from './Navigator';

export default class App extends Component<{}> {
  constructor() {
    super();
    this.state = {
      loading: true,
      curUser: null
    };
  }

  /**
  * Helper method for resetting the router to Home screen
  */
  static goHome(navigation) {
    navigation.dispatch(NavigationActions.reset({
      index: 0,
      key: null,
      actions: [
        NavigationActions.navigate({ routeName: 'Home', params: navigation.state.params})
      ]
    }));
  }

  /**
   * When the App component mounts, we listen for any authentication
   * state changes in Firebase.
   * Once subscribed, the 'user' parameter will either be null
   * (logged out) or an Object (logged in)
   */
  componentDidMount() {
    this.authSubscription = firebase.auth().onAuthStateChanged((user) => {
      // TODO remove if not used
      this.setState({
        loading: false,
        curUser: user
      });
      // Currently using firebase.auth().currentUser to tell current login state
    });
  }

  componentWillUnmount() {
    // Stop listening for auth
    this.authSubscription();
  }

  render() {
    return (
      <Navigator />
    );
  }
}
