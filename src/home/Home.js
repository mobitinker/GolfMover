
import React, { Component } from 'react';
import {
  Platform,
  StyleSheet,
  AsyncStorage,
  Alert,
  Linking,
  View,
  BackHandler
} from 'react-native';
import { NavigationActions } from 'react-navigation';
import {
  Container, Header, Content, Footer,
  Left, Body, Right,
  Card, CardItem,
  Text, H1,
  Button, Icon,
  Title,
  Form, Item, Input, Label
} from 'native-base';
import firebase from 'react-native-firebase';
import BackgroundGeolocation from "../react-native-background-geolocation";

import prompt from 'react-native-prompt-android';
import appStyles from '../themes/ApplicationStyles'

const DEFAULT_USERNAME = "mobitinker";
//const TRACKER_HOST = 'http://tracker.transistorsoft.com/';
const TRACKER_HOST = 'https://golfmover-test.herokuapp.com/';
const USERNAME_KEY = '@murphysw:username';

// Only allow alpha-numeric usernames with '-' and '_'
const USERNAME_VALIDATOR =  /^[a-zA-Z0-9_-]*$/;

export default class Home extends Component<{}> {
  constructor(props) {
    super(props);

    let navigation = props.navigation;
    this.state = {
      //mkm username: navigation.state.params.username,
      //mkm url: TRACKER_HOST + navigation.state.params.username
      username: "mobitinker",
      url: TRACKER_HOST + "mobitinker",
      isLocalHost: true
    }
  }

  componentDidMount() {
    console.log("Mounted Home")

    // Redirect to login if no current user
    if (!firebase.auth().currentUser) {
      navigation.dispatch(NavigationActions.reset({
        index: 0,
        key: null,
        actions: [
          NavigationActions.navigate({ routeName: 'Auth', params: params})
        ]
      }));
    }

    /* TODO remove
    // #stop BackroundGeolocation and remove-listeners when Home Screen is rendered.
    BackgroundGeolocation.stop();
    BackgroundGeolocation.removeListeners();
    */

    if (!this.state.username) {
      this.getUsername().then(this.setUserName.bind(this)).catch(() => {
        this.onClickEditUsername();
      });
    }
  }
  onClickNavigate(routeName) {
    this.props.navigation.dispatch(NavigationActions.reset({
      index: 0,
      key: null,
      actions: [
        NavigationActions.navigate({routeName: routeName, params: {
          username: this.state.username
        }})
      ]
    }));
  }

  onClickEditUsername() {
    AsyncStorage.getItem(USERNAME_KEY, (err, username) => {
      AsyncStorage.removeItem(USERNAME_KEY);
      this.getUsername(username).then(this.setUserName.bind(this)).catch(() => {
        // Revert to current username on [Cancel]
        AsyncStorage.setItem(USERNAME_KEY, username);
        this.onClickEditUsername();
      });
    });
  }

  onClickViewServer() {
     Linking.canOpenURL(this.state.url).then(supported => {
      if (supported) {
        Linking.openURL(this.state.url);
      } else {
        console.log("Don't know how to open URI: " + this.props.url);
      }
    });
  }

  getUsername(defaultValue) {
    return new Promise((resolve, reject) => {
      AsyncStorage.getItem(USERNAME_KEY, (err, username) => {
        if (username) {
          resolve(username);
        } else {
          prompt('Tracking Server Username', 'Please enter a unique identifier (eg: Github username) so the plugin can post loctions to tracker.transistorsoft.com/{identifier}', [{
            text: 'OK',
            onPress: (username) => {
              username = username.replace(/\s+/, "");
              console.log('OK Pressed, username: ', username, username.length);
              if (!username.length) {
                Alert.alert('Username required','You must enter a username.  It can be any unique alpha-numeric identifier.', [{
                  text: 'OK', onPress: () => {
                    reject();
                  }
                }],{
                  cancelable: false
                });
              } else if (!USERNAME_VALIDATOR.test(username)) {
                Alert.alert("Invalid Username", "Username must be alpha-numeric\n('-' and '_' are allowed)", [{
                  text: 'OK', onPress: () => {
                    reject();
                  }
                }],{
                  cancelable: false
                });
              } else {
                resolve(username);
              }
            }
          }],{
            type: 'plain-text',
            defaultValue: defaultValue || ''
          });
        }
      });
    });
  }

  setUserName(username) {
    AsyncStorage.setItem(USERNAME_KEY, username);

    this.setState({
      username: username,
      url: TRACKER_HOST + username
    });

    BackgroundGeolocation.setConfig({url: TRACKER_HOST + 'locations/' + username});
  }

  /**
  * Show Exit button on android Only
  */
  renderExit() {
    if (Platform.OS === 'android') {
      return (<Button block style={styles.button} onPress={() => BackHandler.exitApp()}><Text>Exit</Text></Button>)
    } else {
      return
    }
  }

  render() {
    console.log("Styles", styles)
    return (
      <Container>
        <Header style={styles.header}>
          <Body>
            <Title style={styles.title}>GolfMover</Title>
          </Body>
        </Header>
        <Body style={styles.body}>
            <Button block style={styles.button} onPress={() => this.onClickNavigate('MyRound')}><Text>My round</Text></Button>
            <Button block style={styles.button} onPress={() => this.onClickNavigate('Auth')}><Text>Login/Register</Text></Button>
            {this.renderExit()}
        </Body>
        { /*
        <Footer style={styles.footer}>
            <Card style={styles.userInfo}>
              <Text style={styles.p}>These views will post locations to the demo server.  You can view your tracking in the browser by visiting:</Text>
              <Text style={styles.url}>{this.state.url}</Text>

              <Item inlineLabel disabled>
                <Label>Username</Label>
                <Input value={this.state.username} />
              </Item>
              <CardItem style={{margin: 0}}>
                <Left>
                  <Button danger small full onPress={this.onClickEditUsername.bind(this)}><Text>Edit username</Text></Button>
                </Left>
                <Right>
                  <Button small full onPress={this.onClickViewServer.bind(this)}><Text>View server</Text></Button>
                </Right>
              </CardItem>
            </Card>
        </Footer>
        */ }
      </Container>
    );
  }
}

const styles = StyleSheet.create({
  ...appStyles,
  // Local styles
})
