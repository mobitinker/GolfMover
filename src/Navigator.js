/**
* This is the Application's root navigator which automatically routes to the currently
* selected view
* - MyRoundView
* - AuthView
*
* The default route is home/Home
*
* This file contains nothing related to Background Geolocation plugin.  This is just
* boilerplate routing stuff.
*/
import React, { Component } from 'react';
import {
  AsyncStorage,
  View,
  Text,
  StyleSheet
} from 'react-native';

import { StackNavigator, NavigationActions } from 'react-navigation';

import Home from './home/Home';
import MyRoundNav from './myround/MyRoundNav';
import AuthView from './auth/AuthView';

class Root extends Component<{}> {
  componentDidMount() {
    let navigation = this.props.navigation;

    // Fetch current routeName (ie: MyRound)
    AsyncStorage.getItem("@murphysw:initialRouteName", (err, page) => {
      let params = {username: undefined};
      if (!page) {
        // Default route:  Home
        page = "Home";
        AsyncStorage.setItem("@murphysw:initialRouteName", page);
      }
      // Append username to route params.
      AsyncStorage.getItem("@murphysw:username", (err, username) => {
        // Append username to route-params
        if (username) { params.username = username; }
        navigation.dispatch(NavigationActions.reset({
          index: 0,
          key: null,
          actions: [
            NavigationActions.navigate({ routeName: page, params: params})
          ]
        }));
      });
    });
  }
  render() {
    return (<View></View>);
  }
}

export default Navigator = StackNavigator({
  Root: {
    screen: Root,
  },
  Home: {
    screen: Home
  },
  MyRound: {
    screen: MyRoundNav
  },
  Auth: {
    screen: AuthView
  }
}, {
  initialRouteName: 'Root',
  headerMode: 'none',
  onTransitionStart: (transition) => {
    // Store the current page route as the initialRouteName so that app boots immediately
    // into the currently selected SampleApp
    let routeName = transition.scene.route.routeName;
    AsyncStorage.setItem("@murphysw:initialRouteName", routeName);
  }
});
