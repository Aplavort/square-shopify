# Square + Shopify Checkout

A custom checkout that connects Square payments to your Shopify store.

## Setup

1. Copy `.env.example` to `.env` and fill in your credentials
2. Run `npm install`
3. Run `npm start`

## Environment Variables

- `SQUARE_ACCESS_TOKEN` — From Square Developer Dashboard
- `SQUARE_APP_ID` — From Square Developer Dashboard  
- `SQUARE_LOCATION_ID` — From Square Developer Dashboard → Locations
- `SHOPIFY_STORE_DOMAIN` — e.g. mystore.myshopify.com
- `SHOPIFY_ADMIN_TOKEN` — From Shopify Admin → Apps → Private apps

## How it works

1. Customer adds products to Shopify cart
2. They click a custom "Checkout" button that redirects to this app
3. They fill in their info and pay via Square
4. Order is automatically created in Shopify as paid
