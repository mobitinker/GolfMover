import React, { Component } from 'react';
import { View, StyleSheet} from 'react-native';
import { Container, Button, Header, Body, Footer,
      Left, Right, Icon, Title, Text} from 'native-base';

import t from 'tcomb-form-native'; // 0.6.9
import App from '../App';
import appStyles from '../themes/ApplicationStyles'
import firebase from 'react-native-firebase';
import Modal from "react-native-modal";
import { NavigationActions } from 'react-navigation';

const Form = t.form.Form;

// Validator for email address
const Email = t.refinement(t.String, email => {
  const reg = /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/;
  return reg.test(email);
});

// Validator for email address
const Password = t.refinement(t.String, password => {
  //1 cap, 1 lower, 1 numeral, 1 punc >=8 chars
  const reg = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])(?=.{8,})/
  return reg.test(password);
});

const User = t.struct({
  email: Email,
  password: Password,
  displayName: t.maybe(t.String),
});

const formStyles = {
  ...Form.stylesheet,
  formGroup: {
    normal: {
      marginBottom: 10
    },
  },
  controlLabel: {
    normal: {
      color: 'blue',
      fontSize: 18,
      marginBottom: 7,
      fontWeight: '600'
    },
    // the style applied when a validation error occours
    error: {
      color: 'red',
      fontSize: 14,
      marginBottom: 7,
      fontWeight: '600'
    }
  }
}

// Set form defaults
const options = {
  auto: 'placeholders',
  fields: {
    email: {
      autoCapitalize: 'none',
      error: 'Please enter a valid email address'
    },
    password: {
      autoCapitalize: 'none',
      //TODO secureTextEntry: true,
      error: 'Password must be at least 8 characters, 1 uppercase, 1 lowercase, 1 numeral and 1 punctuation'
    },
  },
  stylesheet: formStyles,
};

//TODO remove after dev
const debugUser = {
  email: "mobitinker2@gmail.com",
  password: "Laika11!",
  displayName: "Murph"
}

export default class AuthView extends Component {

  constructor(props) {
    super(props);

    this.state = {
      authError: null
    }
  }

  // Return to previous window
  onClickBack() {
    this.props.navigation.dispatch(NavigationActions.reset({
      index: 0,
      key: null,
      actions: [
        NavigationActions.navigate({routeName: "Home"})
      ]
    }));

  }

  // Handle login
  onLogin = () => {
  const value = this._form.getValue();
  if (!value) {
    return
  }
  firebase.auth().signInWithEmailAndPassword(value.email, value.password)
    .then((user) => {
      // The user will be logged in automatically by the
      // `onAuthStateChanged` listener in App.js
      console.log("Login successful")
      this.onClickBack()
    })
    .catch((error) => {
      //const { code, message } = error;
      // For details of error codes, see the docs
      // (https://github.com/gcanti/tcomb-form-native).
      // message contains the default Firebase error message
      console.log("Login failed")
      this.setState({
        authError: error
      });
    });
  }

  // Handle registration
  onRegister = () => {
    console.log("Registering...")
    const value = this._form.getValue();
    if (!value) {
      return
    }
    firebase.auth().createUserWithEmailAndPassword(value.email, value.password)
      .then((user) => {
        // The user will be logged in automatically by the
        // `onAuthStateChanged` listener in App.js
        console.log("Registration successful")
        this.onClickBack()
      })
      .catch((error) => {
        //const { code, message } = error;
        // For details of error codes, see the docs
        // (https://github.com/gcanti/tcomb-form-native).
        // message contains the default Firebase error message
        console.log("Register failed")
        this.setState({
          authError: error
        });
      });
  }

  clearError = () => {
    this.setState({authError: null})
  }

  // Show authorization error in a modal
  renderAuthError = (error) => {
    if (!error) {
      return
    }
    return (
      <Container style={styles.modalContainer}>
        <Modal isVisible={error != null}>
          <View style={styles.bottomModal}>
            <Text style={styles.modalContent}>{error.message}</Text>
            <Button style={styles.modalButton} onPress={this.clearError.bind(this)}>
              <Text>OK</Text>
            </Button>
          </View>
        </Modal>
      </Container>
    )
  }

  render() {
    return (
      <Container>
        <Header style={styles.header}>
          <Left>
            <Button transparent small onPress={this.onClickBack.bind(this)}>
              <Icon active name="arrow-back" style={{color: '#000'}}/>
            </Button>
          </Left>
          <Body>
            <Title style={styles.title}>GolfMover</Title>
          </Body>
        </Header>

        <Form
          ref={c => this._form = c}
          type={User}
          options={options}
          value={debugUser}
        />
        <Body style={styles.body}>
          <Button full style={styles.button} onPress={() => this.onLogin()}><Text>Login</Text></Button>
          <Button full style={styles.button} onPress={() => this.onRegister('Register')}><Text>Register/Register</Text></Button>
        </Body>
        {this.renderAuthError(this.state.authError)}
      </Container>
    );
  }
}

const styles = StyleSheet.create({
  ...appStyles,
  // Local styles
})
