const express = require('express');
const router = express.Router();
const { Client, Environment } = require('square');
 
const client = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: process.env.NODE_ENV === 'production'
    ? Environment.Production
    : Environment.Sandbox,
});
 
// Process Square payment
router.post('/payment', async (req, res) => {
  const { sourceId, amount, currency, orderDetails } = req.body;
 
  try {
    const response = await client.paymentsApi.createPayment({
      sourceId: sourceId,
      idempotencyKey: `${Date.now()}-${Math.random()}`,
      amountMoney: {
        amount: BigInt(Math.round(amount * 100)),
        currency: currency || 'EUR',
      },
      locationId: process.env.SQUARE_LOCATION_ID,
      note: `Shopify Order - ${orderDetails?.firstName} ${orderDetails?.lastName}`,
    });
 
    if (response.result.payment.status === 'COMPLETED') {
      const shopifyOrder = await createShopifyOrder(orderDetails, response.result.payment);
      res.json({
        success: true,
        paymentId: response.result.payment.id,
        shopifyOrderId: shopifyOrder?.id,
        message: 'Payment successful!',
      });
    } else {
      res.status(400).json({ success: false, message: 'Payment failed' });
    }
 
  } catch (error) {
    console.error('Payment error:', error);
    res.status(500).json({
      success: false,
      message: error.errors?.[0]?.detail || 'Payment processing error',
    });
  }
});
 
// Create order in Shopify using Client ID + Secret directly
async function createShopifyOrder(orderDetails, payment) {
  try {
    const shop = process.env.SHOPIFY_STORE_DOMAIN;
    const accessToken = process.env.SHOPIFY_CLIENT_SECRET;
 
    const orderResponse = await fetch(
      `https://${shop}/admin/api/2026-01/orders.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
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
          },
        }),
      }
    );
 
    const data = await orderResponse.json();
    console.log('Shopify order created:', data.order?.id);
    return data.order;
 
  } catch (error) {
    console.error('Shopify order error:', error);
    return null;
  }
}
 
// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Square-Shopify checkout is running!' });
});
 
module.exports = router;
