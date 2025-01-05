const express = require('express');
const path = require("path");
const axios = require('axios');

const app = express();
const port = 3000;

// CONTRACT CONFIG
const CONTRACT = 'TQM1am5Ssf8phTwnoey1GMfHbM6CEeei72'; // USDT CONTRACT ADDRESS
const DEPOSIT_ADDRESS = 'TMDBGskDMtzA6MXSLrmxHPjwmPk6hsLVpJ'; 

// POLLING CONFIG
const POLL_INTERVAL = 0.5; // Poll every 30 seconds
const MAX_MONITORING_TIME = 5 * 60 * 1000; // 5 minutes in milliseconds
const TRANSACTIONS_URL = `https://api.shasta.trongrid.io/v1/accounts/${DEPOSIT_ADDRESS}/transactions/trc20?contract_address=${CONTRACT}`;

// Store pending and matched deposits
const pendingDeposits = new Map(); // Store expected deposits
const matchedTransactions = new Map(); // Store matched transactions

// FETCH USDT TRANSACTIONS
async function getUsdtTransactions() {
    const response = await axios.get(TRANSACTIONS_URL);
    return response.data.data;
}

// CHECK IF TRANSACTION MATCHES ANY PENDING DEPOSITS
function checkTransactionMatch(tx) {
    const txTimestamp = tx.block_timestamp;
    
    for (const [depositId, deposit] of pendingDeposits) {
        // Only consider transactions that occurred after the deposit request
        if (txTimestamp < deposit.timestamp) {
            continue; // Skip this transaction as it's older than the deposit request
        }

        // Check if the from address, to address, and amount all match
        if (tx.from === deposit.address && 
            tx.to === DEPOSIT_ADDRESS &&
            tx.value === deposit.amount &&
            !matchedTransactions.has(tx.transaction_id)) {
            
            // Save the matched transaction
            matchedTransactions.set(tx.transaction_id, {
                depositId,
                amount: tx.value,
                from: tx.from,
                timestamp: tx.block_timestamp,
                transactionId: tx.transaction_id
            });

            console.log(`Match found for deposit ${depositId}:`, {
                amount: tx.value,
                from: tx.from,
                to: tx.to,
                transactionId: tx.transaction_id,
                timestamp: new Date(tx.block_timestamp).toISOString()
            });

            // Remove from pending since it's matched
            pendingDeposits.delete(depositId);
            return true;
        }
    }
    return false;
}

// MONITOR TRANSACTIONS FOR SPECIFIC DEPOSIT
async function monitorDeposit(depositId) {
    const startTime = Date.now();
    const seenTransactions = []; 

    while (Date.now() - startTime < MAX_MONITORING_TIME) {
        try {
            const transactions = await getUsdtTransactions();
            
            for (const tx of transactions) {
                if (!seenTransactions.includes(tx.transaction_id)) {
                    seenTransactions.push(tx.transaction_id);
                    checkTransactionMatch(tx);
                }
            }
        } catch (error) {
            console.error('Error fetching transactions:', error);
        }

        // Sleep for POLL_INTERVAL minutes
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL * 60 * 1000));
        
        // If no more pending deposits, stop monitoring
        if (!pendingDeposits.has(depositId)) {
            console.log(`Monitoring stopped for deposit ${depositId} - match found`);
            return;
        }
    }

    // Clean up after monitoring period expires
    console.log(`Monitoring period expired for deposit ${depositId}`);
    pendingDeposits.delete(depositId);
}

app.use(express.json());

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/deposit', (req, res) => {
    try {
        const { address, amount } = req.body;
        
        if (!address || !amount) {
            return res.status(400).json({ 
                success: false, 
                message: 'Both address and amount are required' 
            });
        }

        const depositId = Date.now().toString();
        const timestamp = Date.now();
        
        // Store the deposit request with raw amount value
        pendingDeposits.set(depositId, {
            address,
            amount,
            timestamp
        });

        // Start monitoring for this deposit
        monitorDeposit(depositId);

        res.json({ 
            success: true,
            depositId,
            depositAddress: DEPOSIT_ADDRESS,
            expectedAmount: amount,
            timestamp,
            message: `Monitoring for transactions of ${amount} USDT from ${address} to ${DEPOSIT_ADDRESS} for 5 minutes.`
        });
    } catch (error) {
        console.error('Deposit error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'An error occurred processing your request.' 
        });
    }
});

app.get('/deposit/:depositId/status', (req, res) => {
    const { depositId } = req.params;
    
    // Check if deposit is still pending
    if (pendingDeposits.has(depositId)) {
        const deposit = pendingDeposits.get(depositId);
        return res.json({
            status: 'pending',
            message: 'Waiting for transaction',
            expectedAmount: deposit.amount,
            fromAddress: deposit.address,
            requestTimestamp: deposit.timestamp
        });
    }

    // Check if we have a matched transaction
    const matchedTx = Array.from(matchedTransactions.values())
        .find(tx => tx.depositId === depositId);

    if (matchedTx) {
        return res.json({
            status: 'matched',
            transaction: matchedTx
        });
    }

    res.json({
        status: 'expired',
        message: 'Monitoring period expired without finding a match'
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log('Ready to handle deposit requests and monitor transactions.');
});