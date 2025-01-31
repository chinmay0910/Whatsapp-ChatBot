document.addEventListener('DOMContentLoaded', function() {
    // Get reference to the submit button
    const submitBtn = document.getElementById('submitBtn');
  
    // Add event listener to the submit button
    submitBtn.addEventListener('click', function(event) {
      event.preventDefault(); // Prevent form submission
    // console.log("Hello world");

  
      // Get form data
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      const userId = document.getElementById('userId').value;
  
      // Send form data to backend using fetch
      fetch('/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password, userId })
      })
      .then(response => {
        if (response.ok) {
          // Form submitted successfully
          alert('Form submitted successfully');
        } else {
          // Error occurred
          throw new Error('Failed to submit form');
        }
      })
      .catch(error => {
        console.error(error);
        alert('Failed to submit form');
      });
    });
  });