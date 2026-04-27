const express = require('express');
const router = express.Router();
const { Client, Environment } = require('square');

const client = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: process.env.NODE_ENV === 'production' 
    ? Environment.Production 
    : Environment.Sandbox,
});

// Process payment
router.post('/payment', async (req, res) => {
  const { sourceId, amount, currency, orderDetails } = req.body;

  try {
    const response = await client.paymentsApi.createPayment({
      sourceId: sourceId,
      idempotencyKey: `${Date.now()}-${Math.random()}`,
      amountMoney: {
        amount: BigInt(Math.round(amount * 100)), // convert to cents
        currency: currency || 'EUR',
      },
      note: `Shopify Order - ${orderDetails?.productName || 'Purchase'}`,
    });

    if (response.result.payment.status === 'COMPLETED') {
      // Now create the order in Shopify
      const shopifyOrder = await createShopifyOrder(orderDetails, response.result.payment);
      
      res.json({ 
        success: true, 
        paymentId: response.result.payment.id,
        shopifyOrderId: shopifyOrder?.id,
        message: 'Payment successful!'
      });
    } else {
      res.status(400).json({ success: false, message: 'Payment failed' });
    }

  } catch (error) {
    console.error('Payment error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.errors?.[0]?.detail || 'Payment processing error' 
    });
  }
});

// Create order in Shopify after successful payment
async function createShopifyOrder(orderDetails, payment) {
  try {
    const shopifyDomain = process.env.SHOPIFY_STORE_DOMAIN;
    const shopifyToken = process.env.SHOPIFY_ADMIN_TOKEN;

    const response = await fetch(
      `https://${shopifyDomain}/admin/api/2024-01/orders.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': shopifyToken,
        },
        body: JSON.stringify({
          order: {
            line_items: orderDetails.lineItems || [],
            customer: {
              first_name: orderDetails.firstName,
              last_name: orderDetails.lastName,
              email: orderDetails.email,
            },
            billing_address: {
              first_name: orderDetails.firstName,
              last_name: orderDetails.lastName,
              address1: orderDetails.address,
              city: orderDetails.city,
              zip: orderDetails.zip,
              country: orderDetails.country || 'FR',
            },
            shipping_address: {
              first_name: orderDetails.firstName,
              last_name: orderDetails.lastName,
              address1: orderDetails.address,
              city: orderDetails.city,
              zip: orderDetails.zip,
              country: orderDetails.country || 'FR',
            },
            financial_status: 'paid',
            transactions: [{
              kind: 'sale',
              status: 'success',
              amount: orderDetails.amount,
              gateway: 'Square',
              authorization: payment.id,
            }],
            note: `Paid via Square. Payment ID: ${payment.id}`,
          }
        })
      }
    );

    const data = await response.json();
    return data.order;
  } catch (error) {
    console.error('Shopify order error:', error);
    return null;
  }
}

// Get cart details from Shopify
router.get('/cart/:cartToken', async (req, res) => {
  try {
    const shopifyDomain = process.env.SHOPIFY_STORE_DOMAIN;
    const response = await fetch(
      `https://${shopifyDomain}/cart/${req.params.cartToken}.js`
    );
    const cart = await response.json();
    res.json(cart);
  } catch (error) {
    res.status(500).json({ error: 'Could not fetch cart' });
  }
});

module.exports = router;
