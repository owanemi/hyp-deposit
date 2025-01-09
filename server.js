import express from 'express';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(express.static(__dirname));
app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/create-deposit', async (req, res) => {
  const { priceAmount, orderId } = req.body;
  const apiKey = "ZHPDVK9-MHGMA0T-M7RN834-BS5DGVJ";

  if (!apiKey) {
    return res.status(500).json({ error: 'NOW_PAYMENTS_API_KEY is not set' });
  }

  try {
    const response = await fetch('https://api.nowpayments.io/v1/payment', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        price_amount: priceAmount,
        price_currency: 'usdttrc20',
        pay_currency: 'usdttrc20',
        ipn_callback_url: 'https://your-domain.com/api/nowpayments-callback',
        order_id: orderId,
        order_description: 'deposit',
        is_fixed_rate: true,
        is_fee_paid_by_user: true //this isn't working
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to create payment');
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to create payment' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});