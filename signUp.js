function signUp() {
    // Get the values from the form fields
    const username = document.querySelector('input[name="Username"]').value;
    const password = document.querySelector('input[name="psw"]').value;
    const passwordRepeat = document.querySelector('input[name="psw-repeat"]').value;
    const rememberMe = document.querySelector('input[name="remember"]').checked;

    // Validate the input (basic validation)
    if (!username || !password || !passwordRepeat || password !== passwordRepeat) {
        if (password !== passwordRepeat) alert("Passwords do not match.");
        return;
    }
    else {
        // Store the username in localStorage
        localStorage.setItem('currentUser', username);

        // Hash the password before storing (simple hash for demonstration; use a stronger hash in production)
        async function hashPassword(password) {
            const encoder = new TextEncoder();
            const data = encoder.encode(password);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        }

        hashPassword(password).then(hashedPassword => {
            // Store the hashed password
            localStorage.setItem('userPassword', hashedPassword);

            // Store the username and hashed password
            const users = JSON.parse(localStorage.getItem('users')) || {};
            users[username] = hashedPassword;
            localStorage.setItem('users', JSON.stringify(users));

            if (rememberMe) {
            localStorage.setItem('rememberMe', 'true');
            } 
            else {
                localStorage.removeItem('rememberMe');
            }

            // Redirect to the index page
            window.location.href = 'Home-index.html';
        });
        return;
    }    
}