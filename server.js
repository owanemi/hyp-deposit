const express = require('express');
const path = require("path");
const axios = require('axios');

const app = express();
const port = 3000;

// Config
const CONTRACT = 'TQM1am5Ssf8phTwnoey1GMfHbM6CEeei72';
const DEPOSIT_ADDRESS = 'TMDBGskDMtzA6MXSLrmxHPjwmPk6hsLVpJ';
const POLL_INTERVAL = 30 * 1000; // 30 seconds
const MAX_MONITOR_TIME = 5 * 60 * 1000; // 5 minutes
const TRANSACTIONS_URL = `https://api.shasta.trongrid.io/v1/accounts/${DEPOSIT_ADDRESS}/transactions/trc20?contract_address=${CONTRACT}`;

const pendingDeposits = new Map();
const matchedTransactions = new Map();

async function getTransactions() {
    const { data } = await axios.get(TRANSACTIONS_URL);
    return data.data;
}

function matchTransaction(tx) {
    for (const [id, deposit] of pendingDeposits) {
        if (tx.block_timestamp >= deposit.timestamp &&
            tx.from === deposit.address &&
            tx.to === DEPOSIT_ADDRESS &&
            tx.value === deposit.amount &&
            !matchedTransactions.has(tx.transaction_id)) {

            matchedTransactions.set(tx.transaction_id, { ...tx, depositId: id });
            pendingDeposits.delete(id);
            console.log(`Matched deposit ${id}:`, tx);
            return true;
        }
    }
    return false;
}

async function monitorDeposit(depositId) {
    const start = Date.now();
    const seen = new Set();

    while (Date.now() - start < MAX_MONITOR_TIME) {
        try {
            const transactions = await getTransactions();
            transactions.forEach(tx => {
                if (!seen.has(tx.transaction_id)) {
                    seen.add(tx.transaction_id);
                    matchTransaction(tx);
                }
            });
        } catch (err) {
            console.error('Error fetching transactions:', err);
        }
        if (!pendingDeposits.has(depositId)) return;
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
    }
    console.log(`Monitoring expired for deposit ${depositId}`);
    pendingDeposits.delete(depositId);
}

app.use(express.json());

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.post('/deposit', (req, res) => {
    const { address, amount } = req.body;
    if (!address || !amount) return res.status(400).json({ success: false, message: 'Address and amount are required' });

    const depositId = Date.now().toString();
    pendingDeposits.set(depositId, { address, amount, timestamp: Date.now() });

    monitorDeposit(depositId);
    res.json({
        success: true,
        depositId,
        depositAddress: DEPOSIT_ADDRESS,
        message: `Monitoring ${amount} USDT from ${address} for 5 minutes.`
    });
});

app.get('/deposit/:id/status', (req, res) => {
    const depositId = req.params.id;

    if (pendingDeposits.has(depositId)) {
        const { address, amount, timestamp } = pendingDeposits.get(depositId);
        return res.json({ status: 'pending', amount, address, timestamp });
    }

    const matched = Array.from(matchedTransactions.values()).find(tx => tx.depositId === depositId);
    if (matched) return res.json({ status: 'matched', transaction: matched });

    res.json({ status: 'expired', message: 'No match found within the monitoring period.' });
});

app.listen(port, () => console.log(`Server running at http://localhost:${port}`));
