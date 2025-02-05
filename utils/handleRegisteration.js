const UserConfirmation = require('./models/UserConfirmation');
const axios = require('axios');

// Helper function to send a WhatsApp message.
// You can replace this with your own implementation.
async function sendWhatsAppMessage(to, body, mediaURL = null) {
  const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_ID;
  const AUTH_TOKEN = process.env.WHATSAPP_API_TOKEN;
  
  const data = {
    messaging_product: 'whatsapp',
    to,
  };

  if (mediaURL) {
    // If a mediaURL is provided, send it as an image or document based on your logic.
    data.type = 'image';
    data.image = {
      link: mediaURL,
      caption: body
    };
  } else {
    data.text = { body };
  }
  
  try {
    await axios.post(`https://graph.facebook.com/v14.0/${PHONE_NUMBER_ID}/messages`, data, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      }
    });
  } catch (error) {
    console.error('Error sending WhatsApp message:', error.message);
  }
}

// Helper function to validate email format.
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * This function processes incoming WhatsApp messages for confirmation.
 * It collects the following details in order:
 *   1. Name
 *   2. Email
 *   3. Designation
 *   4. Institute/Company Name
 */
async function handleConfirmationMessage(sender, messageBody) {
  // Try to find an existing confirmation record for this sender.
  let confirmation = await UserConfirmation.findOne({ userId: sender });

  if (!confirmation) {
    // Create a new confirmation record and prompt for the name.
    confirmation = new UserConfirmation({ userId: sender });
    await confirmation.save();
    await sendWhatsAppMessage(sender, "Welcome! Please enter your full name to confirm your details:");
    return;
  }

  // Process the message based on the current step.
  switch (confirmation.step) {
    case 0:
      // Save name and prompt for email.
      confirmation.name = messageBody.trim();
      confirmation.step = 1;
      await confirmation.save();
      await sendWhatsAppMessage(sender, `Thanks, ${confirmation.name}. Please enter your email address:`);
      break;

    case 1:
      // Validate and save email, then prompt for designation.
      if (!isValidEmail(messageBody.trim())) {
        await sendWhatsAppMessage(sender, "The email you entered seems invalid. Please enter a valid email address:");
        return;
      }
      confirmation.email = messageBody.trim();
      confirmation.step = 2;
      await confirmation.save();
      await sendWhatsAppMessage(sender, "Great! Please provide your designation (e.g., Student, Professor, Manager, etc.):");
      break;

    case 2:
      // Save designation and prompt for institute/company name.
      confirmation.designation = messageBody.trim();
      confirmation.step = 3;
      await confirmation.save();
      await sendWhatsAppMessage(sender, "Almost done! Please enter the name of your institute or company:");
      break;

    case 3:
      // Save institute/company name and complete confirmation.
      confirmation.institute = messageBody.trim();
      confirmation.step = 4;
      await confirmation.save();

      // Send a final confirmation message with the details.
      await sendWhatsAppMessage(
        sender,
        `Thank you for confirming your details:\n\n` +
          `*Name:* ${confirmation.name}\n` +
          `*Email:* ${confirmation.email}\n` +
          `*Designation:* ${confirmation.designation}\n` +
          `*Institute/Company:* ${confirmation.institute}\n\n` +
          `Your confirmation has been recorded successfully.`
      );
      break;

    case 4:
      // Already confirmed.
      await sendWhatsAppMessage(sender, "Your details have already been confirmed. Thank you!");
      break;

    default:
      await sendWhatsAppMessage(sender, "Sorry, an unexpected error occurred. Please try again later.");
      break;
  }
}

module.exports = handleConfirmationMessage;
