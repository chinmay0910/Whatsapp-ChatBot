const checkIfUserIsSignedIn = async () => {
    try {
      const response = await fetch('/getuser', {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Auth-token": localStorage.getItem('Auth-token')
        },
      });
  
      if (!response.ok) {
        throw new Error('Unauthorized');
      }
  
      const json = await response.json();
      DisplayEmail.innerText = json.email;
      return !!json.email; // Returns true if email is present in response, false otherwise
    } catch (error) {
      console.error('Error:', error);
      return false; // Return false in case of error
    }
  }
  
  // Call the function to check if the user is signed in
  checkIfUserIsSignedIn().then((signedIn) => {
    if (!signedIn) {
      // Redirect to login page if user is not signed in
      window.location.href = "/signinpage";
    }
  });
  
  // Function to logout
  const logout = () => {
    localStorage.clear('Auth-token')
    window.location.href = "/"
  }
  