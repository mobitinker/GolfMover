/**
* The MyRoundView contains its own child-router for routing to:
* - SettingsView
* - AboutView
*/
import React, { Component } from 'react';

import { StackNavigator, NavigationActions } from 'react-navigation';

import MyRoundView from './MyRoundView';
import SettingsView from './SettingsView';
import AboutView from './AboutView';

export default MyRoundNav = StackNavigator({
  MyRound: {
    screen: MyRoundView
  },
  Settings: {
    screen: SettingsView
  },
  About: {
    screen: AboutView
  }
}, {
  initialRouteName: 'Home',
  headerMode: 'none',
  mode: 'modal'
});
