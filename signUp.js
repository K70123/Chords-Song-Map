const firebaseConfig = {
  apiKey: "AIzaSyDq2yjYSfyhiIbrviV0WhW-NKzdfk7ABrQ",
  authDomain: "chords-and-song-maps.firebaseapp.com",
  projectId: "chords-and-song-maps",
  storageBucket: "chords-and-song-maps.appspot.com",
  messagingSenderId: "364224410651",
  appId: "1:364224410651:web:d26213bf0e0b536aae34be",
  measurementId: "G-CQEJKPQX1C"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

document.getElementById('signUpForm').addEventListener('submit', function (e) {
  e.preventDefault();

  const email = document.querySelector('input[name="email"]').value;
  const password = document.querySelector('input[name="psw"]').value;
  const passwordRepeat = document.querySelector('input[name="psw-repeat"]').value;
  const remember = document.querySelector('input[name="remember"]').checked;

  if (password !== passwordRepeat) {
    alert("Passwords do not match.");
    return;
  }

  const persistence = remember
    ? firebase.auth.Auth.Persistence.LOCAL
    : firebase.auth.Auth.Persistence.SESSION;

  firebase.auth().setPersistence(persistence)
    .then(() => {
      return firebase.auth().createUserWithEmailAndPassword(email, password);
    })
    .then(() => {
      window.location.href = "Home-index.html";
    })
    .catch((error) => {
      alert(error.message);
    });
});
