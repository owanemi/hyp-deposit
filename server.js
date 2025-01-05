const express = require('express');
const path = require("path");
const axios = require('axios');

const app = express();
const port = 3000;

// CONTRACT CONFIG
const CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'; // USDT CONTRACT ADDRESS
const DEPOSIT_ADDRESS = 'TMDBGskDMtzA6MXSLrmxHPjwmPk6hsLVpJ'; // Your deposit address

// POLLING CONFIG
const POLL_INTERVAL = 0.5; // Poll every 30 seconds
const TRANSACTIONS_URL = `https://api.trongrid.io/v1/accounts/${DEPOSIT_ADDRESS}/transactions/trc20?contract_address=${CONTRACT}`;
const ACCOUNT_URL = `https://apilist.tronscan.org/api/account?address=${DEPOSIT_ADDRESS}&includeToken=true`;

const seenTransactions = new Set();

// FETCH USDT TRANSACTIONS
async function getUsdtTransactions() {
    const response = await axios.get(TRANSACTIONS_URL);
    return response.data.data;
}

// LOG TRANSACTION DETAILS
function logTransaction(tx) {
    const timestamp = tx.block_timestamp;
    const id = tx.transaction_id;
    const datetime = new Date(timestamp).toISOString();
    const isDeposit = tx.to === DEPOSIT_ADDRESS;
    const amount = (parseFloat(tx.value) * Math.pow(10, -tx.token_info.decimals)).toFixed(6);
    const link = `https://tronscan.org/#/transaction/${id}`;
    const otherKey = isDeposit ? 'From' : 'To';
    const otherAccount = isDeposit ? tx.from : tx.to;

    console.log(`
Transaction Detected:
- Amount: ${amount} USDT
- Date: ${datetime}
- Transaction ID: ${id}
- ${otherKey}: ${otherAccount}
- Link: ${link}
    `);
}

// HANDLE USDT TRANSACTIONS
async function handleUsdtTransactions(startTimestamp) {
    while (true) {
        try {
            const transactions = await getUsdtTransactions();
            for (const tx of transactions) {
                const txTimestamp = tx.block_timestamp;
                const id = tx.transaction_id;

                if (!seenTransactions.has(id)) {
                    seenTransactions.add(id);

                    if (txTimestamp >= startTimestamp) {
                        console.log('New transaction detected:', txTimestamp, 'Transaction ID:', id);
                        logTransaction(tx);
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching transactions:', error);
        }

        console.log(`Sleeping for ${POLL_INTERVAL} minutes...`);
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL * 60 * 1000));
    }
}

// MAIN FUNCTION
async function main() {
    const timestamp = Date.now();
    await handleUsdtTransactions(timestamp);
}

main();

app.use(express.json());

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/deposit', (req, res) => {
  try {
    const { address, amount } = req.body;
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

console.log('Server is set up and ready to handle deposit requests.');