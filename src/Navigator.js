/**
* This is the Application's root navigator which automatically routes to the currently
* selected view
* - MyRound
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
import MyRoundView from './myround/MyRoundView';

class Root extends Component<{}> {
  componentDidMount() {
    let navigation = this.props.navigation;

    // Fetch current routeName (ie: MyRound)
    AsyncStorage.getItem("@transistorsoft:initialRouteName", (err, page) => {
      let params = {username: undefined};
      if (!page) {
        // Default route:  Home
        page = "Home";
        AsyncStorage.setItem("@transistorsoft:initialRouteName", page);
      }
      // Append username to route params.
      AsyncStorage.getItem("@transistorsoft:username", (err, username) => {
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
    screen: MyRoundView
  }
}, {
  initialRouteName: 'Root',
  headerMode: 'none',
  onTransitionStart: (transition) => {
    // Store the current page route as the initialRouteName so that app boots immediately
    // into the currently selected SampleApp
    // - MyRound
    let routeName = transition.scene.route.routeName;
    AsyncStorage.setItem("@transistorsoft:initialRouteName", routeName);
  }
});
