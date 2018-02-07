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
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view'

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
      secureTextEntry: true,
      error: 'Password must be at least 8 characters, 1 uppercase, 1 lowercase, 1 numeral and 1 punctuation'
    },
  },
  stylesheet: formStyles,
};

export default class AuthView extends Component {

  constructor(props) {
    super(props);

    // TODO Modify form styles Here not working
    //t.form.Form.stylesheet.textbox.normal.borderColor = "#333333"
    this.state = {
      authError: null
    }
  }

  // Return home
  onClickBack() {
    App.goHome(this.props.navigation);
  }

  // Login as mobitinker
  onTestLogin = () => {
    firebase.auth().signInWithEmailAndPassword('mobitinker@gmail.com', 'Laika11!')
      .then((user) => {
        console.log("Test login successful")
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

  // Handle login
  onLogin = () => {
  const value = this._form.getValue();
  if (!value) {
    return
  }
  firebase.auth().signInWithEmailAndPassword(value.email, value.password)
    .then((user) => {
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
    const value = this._form.getValue();
    if (!value) {
      return
    }
    console.log("Registering...")
    firebase.auth().createUserWithEmailAndPassword(value.email, value.password)
      .then((user) => {
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

  // Handle forgot password
  onForgotPassword = () => {
    const value = this._form.getValue();
    if (!value) {
      return
    }
    console.log("Resetting password")
    firebase.auth().sendPasswordResetEmail(value.email)
      .then((user) => {
        console.log("Password reset successful")
        this.onClickBack()
      })
      .catch((error) => {
        //const { code, message } = error;
        // For details of error codes, see the docs
        // (https://github.com/gcanti/tcomb-form-native).
        // message contains the default Firebase error message
        console.log("Password reset failed")
        this.setState({
          authError: error
        });
      });
  }

  // Handle logout
  onLogout = () => {
    console.log("Logging out")
    firebase.auth().signOut()
      .then((user) => {
        console.log("Logout successful")
      })
      .catch((error) => {
        //const { code, message } = error;
        // For details of error codes, see the docs
        // (https://github.com/gcanti/tcomb-form-native).
        // message contains the default Firebase error message
        console.log("Logout failed", error)
        this.setState({
          authError: error
        });
      });
      //this.setState(curUser: null)
  }

  clearError = () => {
    this.setState({authError: null})
  }

  setFormValues() {
    let formValues
    if (firebase.auth().currentUser) {
      let curUser = firebase.auth().currentUser._user
      formValues = {
        email: curUser.email,
        password: "",
        displayName: ""
      }
    } else {
      formValues = {
        email: "",
        password: "",
        displayName: ""
      }
    }
    console.log("Setting form values: ", formValues)
    return formValues
  }

  // Show authorization error in a modal
  renderAuthError = (error) => {
    if (!error) {
      return
    }
    return (
      <Container style={styles.modalContainer}>
        <Modal isVisible={error != null}>
          <View >
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
    //console.log("stylesheet: ", t.form.Form.stylesheet)
    //console.log(t.form.Form.stylesheet.textbox.normal.borderColor)
    console.log("rendering")
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

        <Body style={styles.formBody}>
          <KeyboardAwareScrollView>
            <Form
              ref={c => this._form = c}
              type={User}
              options={options}
              value={this.setFormValues()}
            />
            <View style={styles.margin20} />
            <View style={styles.contHorzCenteredColumn}>
              <Button block style={styles.button} onPress={() => this.onLogin()}><Text>Login</Text></Button>
              <Button block style={styles.button} onPress={() => this.onRegister()}><Text>Register</Text></Button>
              <Button transparent primary onPress={() => this.onForgotPassword()}><Text>I forgot my password</Text></Button>
              <Button transparent primary style={styles.button} onPress={() => this.onLogout()}><Text>Logout</Text></Button>
              <Button transparent primary style={styles.button} onPress={() => this.onTestLogin()}><Text>Login as mobitinker (test)</Text></Button>
            </View>
          </KeyboardAwareScrollView>
          {this.renderAuthError(this.state.authError)}
        </Body>
      </Container>
    );
  }
}

const styles = StyleSheet.create({
  ...appStyles,
  // Local styles
})
