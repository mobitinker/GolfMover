// This file contains all styles that could be used in more than one place.
// Containers and components can add their own styles too.

const ApplicationStyles = {
  header: {
    backgroundColor: '#fedd1e'
  },
  title: {
    color: '#000'
  },
  body: {
    width: '100%',
    justifyContent: 'center',
    backgroundColor:'#272727'
  },
  h1: {
    color: '#fff',
    marginBottom: 20
  },
  p: {
    fontSize: 12,
    marginBottom: 5
  },
  url: {
    fontSize: 12,
    textAlign: 'center'
  },
  button: {
    marginBottom: 10
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF',
  },
  footer: {
    backgroundColor:"transparent",
    height: 215
  },
  userInfo: {
    padding: 10
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

}

export default ApplicationStyles
