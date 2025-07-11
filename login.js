const firebaseConfig = {
  apiKey: "AIzaSyDq2yjYSfyhiIbrviV0WhW-NKzdfk7ABrQ",
  authDomain: "chords-and-song-maps.firebaseapp.com",
  projectId: "chords-and-song-maps",
  storageBucket: "chords-and-song-maps.appspot.com",
  messagingSenderId: "364224410651",
  appId: "1:364224410651:web:d26213bf0e0b536aae34be",
  measurementId: "G-CQEJKPQX1C"
};

// Prevent double init
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

document.getElementById('loginForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const email = document.querySelector('input[name="email"]').value;
  const password = document.querySelector('input[name="psw"]').value;
  const remember = document.querySelector('input[name="remember"]').checked;

  // Set persistence
  const persistence = remember
    ? firebase.auth.Auth.Persistence.LOCAL
    : firebase.auth.Auth.Persistence.SESSION;

  firebase.auth().setPersistence(persistence)
    .then(() => {
      return firebase.auth().signInWithEmailAndPassword(email, password);
    })
    .then((userCredential) => {
      // Signed in
      window.location.href = 'Home-index.html';
    })
    .catch((error) => {
      alert(error.message);
    });
});
