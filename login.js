document.querySelector('form').addEventListener('submit', function(e) {
  e.preventDefault();
  const username = document.querySelector('input[name="uname"]').value.trim();
  if (username) {
    const users = JSON.parse(localStorage.getItem('users')) || {};
    const password = document.querySelector('input[name="psw"]').value.trim();
    const rememberMe = document.querySelector('input[name="remember"]').checked;

    // Hash the entered password before comparing
    async function hashPassword(password) {
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    if (users[username]) {
      hashPassword(password).then(hashedPassword => {
        if (users[username] === hashedPassword) {
          localStorage.setItem('currentUser', username);
          if (rememberMe) {
            localStorage.setItem('rememberMe', 'true');
          } 
          else {
            localStorage.removeItem('rememberMe');
          }
          window.location.href = 'Home-index.html';
        }
        else {
          alert('Incorrect password. Please try again.');
        }
      });
    } 
    else {
      alert('Username does not exist. Please sign up first.');
    }
  }
});
