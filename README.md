# ILCFRONTEND

Dark ecommerce storefront for trendy tech product keys, backed by a private SellAuth API proxy and ready for Railway hosting.

## What Is Included

- React + Vite storefront with a dark red/pink product-key theme.
- Home, full store, status, product detail, and checkout review pages.
- Discord community section that can show the latest messages from a real channel.
- Express server that serves the production frontend and proxies SellAuth API calls.
- Private SellAuth credentials through `.env`, never exposed in browser code.
- Railway config using Nixpacks.
- Demo products while your SellAuth credentials are not configured.

## Local Setup

1. Install Node.js 22 or newer from `https://nodejs.org`.
2. Open PowerShell in this folder:

   ```powershell
   cd C:\Users\bigboy124\Documents\ILCFRONTEND
   ```

3. Install dependencies:

   ```powershell
   npm install
   ```

4. Create your local environment file:

   ```powershell
   Copy-Item .env.example .env
   ```

5. Edit `.env` and add:

   ```env
   SELLAUTH_API_KEY=your_real_api_key
   SELLAUTH_SHOP_ID=your_real_shop_id
   ```

   In SellAuth, the API key is available from the dashboard under Account > API.

6. Start the local development servers:

   ```powershell
   npm run dev
   ```

7. Open:

   ```text
   http://localhost:5173
   ```

The React app runs on port `5173`. The Express API runs on port `8787`. Vite forwards `/api` requests to Express automatically.

Useful local pages:

```text
http://localhost:5173/
http://localhost:5173/store
http://localhost:5173/status
http://localhost:5173/product/windows-11-pro
http://localhost:5173/checkout/windows-11-pro?variant=1-week
```

For the Discord section, add a bot token and channel ID to `.env` so the site can show recent channel messages:

```env
VITE_DISCORD_INVITE_URL=https://discord.gg/YOUR_INVITE
DISCORD_BOT_TOKEN=your_discord_bot_token
DISCORD_CHANNEL_ID=your_channel_id
```

The bot must be in the server and able to read that channel's message history.

## SellAuth API Access

The server includes two storefront-friendly routes:

```text
GET /api/storefront/products
GET /api/storefront/products/:productId
GET /api/storefront/products/:productId/status
POST /api/storefront/checkout
```

The generic SellAuth proxy is disabled by default:

```text
/api/sellauth/*
```

Only enable it for trusted local/admin work by setting:

```env
SELLAUTH_PROXY_ENABLED=true
```

Leave it disabled for public storefront deployments. The storefront routes above are the safe browser-facing API surface.

## Railway Deployment

1. Push this folder to a GitHub repository.
2. Create a new Railway project and connect the repository.
3. Add these Railway variables:

   ```env
   SELLAUTH_API_KEY=your_real_api_key
   SELLAUTH_SHOP_ID=your_real_shop_id
   SELLAUTH_API_BASE=https://api.sellauth.com/v1
   SELLAUTH_PROXY_ENABLED=false
   VITE_SELLAUTH_SHOP_ID=your_real_shop_id
   VITE_STORE_NAME=ILC Keys
   VITE_SUPPORT_EMAIL=support@example.com
   VITE_DISCORD_INVITE_URL=https://discord.gg/YOUR_INVITE
   DISCORD_BOT_TOKEN=your_discord_bot_token
   DISCORD_CHANNEL_ID=your_channel_id
   ```

4. Railway will run:

   ```text
   npm run railway:build
   npm start
   ```

## Production Commands

Build locally:

```powershell
npm run railway:build
```

Run the production server locally:

```powershell
npm start
```

Then open:

```text
http://localhost:8787
```

## Next Storefront Steps

- Add admin screens on top of `/api/sellauth/*` for products, coupons, orders, and feedback.
- Replace the fallback imagery with product-specific images from your SellAuth catalogue.
