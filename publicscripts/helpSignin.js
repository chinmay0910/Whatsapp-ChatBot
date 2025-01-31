document.addEventListener("DOMContentLoaded", function() {
    // Get the form element
    const loginForm = document.getElementById("login-form");

    // Add submit event listener to the form
    loginForm.addEventListener("submit", async function(event) {
        // Prevent default form submission
        event.preventDefault();

        // Get values from form fields
        const Email = document.getElementById("Email").value;
        const password = document.getElementById("password").value;

        try {
            // Make fetch request to endpoint
            const response = await fetch('/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ Email, password })
            });

            const responseData = await response.json();
            // console.log(responseData); // Log response data from fetch request
            if(responseData.success){
                // redirect
                localStorage.setItem('Auth-token', responseData.authtoken);
                window.location.href = "/";
                // alert("Login Successfull")
            } 
              else{
                alert("Failed to login")
              }
        } catch (error) {
            console.error('Error:', error);
            alert(error)
        }
    });
});