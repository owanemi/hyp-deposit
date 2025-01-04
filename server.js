const express = require('express');
const path = require("path");
// import { fileURLToPath } from 'url';
// import { dirname, join } from 'path';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

const app = express();
const port = 3000;

// This would be your actual deposit address
const DEPOSIT_ADDRESS = 'TRonDepositAddressHere123456789';

app.use(express.json());
// app.use(express.static(__dirname));


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/deposit', (req, res) => {
  try {
    const { address, amount } = req.body;

    // Here you would typically:
    // 1. Validate the address
    // 2. Check if the amount is within acceptable limits
    // 3. Generate a unique identifier for this deposit
    // 4. Store the deposit information in your database

    // For this example, we'll just return a success response with the deposit address
    res.json({ 
      success: true, 
      depositAddress: DEPOSIT_ADDRESS,
      message: `Please send ${amount} USDT to the provided address.`
    });
  } catch (error) {
    console.error('Deposit error:', error);
    res.status(500).json({ success: false, message: 'An error occurred processing your request.' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

// This is just to demonstrate the server is running
console.log('Server is set up and ready to handle deposit requests.');