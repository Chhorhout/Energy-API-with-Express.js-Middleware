const path = require('path');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const basicAuth = require('express-basic-auth');
const app = express();
const PORT = process.env.PORT || 3001;

// Static oil price data returned by /api/oil-prices
const oilPriceData = {
  market: 'Global Energy Exchange',
  last_updated: '2024-03-15T12:55:00Z',
  currency: 'USD',
  data: [
    { symbol: 'WTI', name: 'West Texas Intermediate', price: 78.45, change: 0.12 },
    { symbol: 'BRENT', name: 'Brent Crude', price: 82.3, change: -0.05 },
    { symbol: 'NAT_GAS', name: 'Natural Gas', price: 2.15, change: 0.02 }
  ]
};

// Auth credentials (see README for testing)
const BEARER_TOKEN = 'energy-api-secret-token-2024';
const BASIC_AUTH_USER = 'admin';
const BASIC_AUTH_PASS = 'energy123';

// 1. IP Filter: Only allow localhost (127.0.0.1, ::1). Block others with 403.
const ipFilter = (req, res, next) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  const allowedIps = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

  if (allowedIps.includes(clientIp)) {
    next();
  } else {
    res.status(403).json({ error: 'Forbidden: Access denied. Only localhost is allowed.' });
  }
};

// 2. CORS: Restrict to local development origin only
const corsOptions = { origin: `http://localhost:${PORT}` };

// 3. Rate Limit: 10 requests per 1 minute
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// 4. Bearer Token: Require Authorization: Bearer <token> for /api/oil-prices
const bearerAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Bearer token required.' });
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  if (token === BEARER_TOKEN) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized: Invalid token.' });
  }
};

// Apply middleware in required order: IP → CORS → Rate Limit
app.use(ipFilter);
app.use(cors(corsOptions));
app.use(limiter);
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint: Bearer Token required
app.get('/api/oil-prices', bearerAuth, (req, res) => {
  res.json(oilPriceData);
});

// Dashboard: Basic Auth required
app.get(
  '/dashboard',
  basicAuth({
    users: { [BASIC_AUTH_USER]: BASIC_AUTH_PASS },
    challenge: true,
    realm: 'Energy Dashboard'
  }),
  (req, res) => {
    res.send(generateDashboardHtml(oilPriceData));
  }
);

// Logout: Clears session, redirects to "Logged Out" message
app.get('/logout', (req, res) => {
  res.redirect('/logged-out');
});

// Logged out confirmation page
app.get('/logged-out', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Logged Out</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link href="/css/logged-out.css" rel="stylesheet">
</head>
<body>
  <div class="logged-out-card">
    <h1>Logged Out</h1>
    <p>You have been successfully logged out.</p>
    <a href="/dashboard" class="dashboard-btn">Return to Dashboard</a>
  </div>
</body>
</html>
  `);
});

// Generate dashboard HTML with oil price cards
function generateDashboardHtml(data) {
  const cards = data.data.map((item) => {
    const isUp = item.change >= 0;
    return `
    <div class="card">
      <div class="card-header">
        <span class="symbol">${item.symbol}</span>
        <span class="change-badge ${isUp ? 'up' : 'down'}">${isUp ? '↑' : '↓'} ${Math.abs(item.change)}</span>
      </div>
      <div class="card-body">
        <p class="name">${item.name}</p>
        <p class="price">$${item.price.toFixed(2)} <span class="currency">${data.currency}</span></p>
      </div>
    </div>`;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.market} - Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
  <link href="/css/dashboard.css" rel="stylesheet">
</head>
<body>
  <div class="container">
    <header>
      <h1>${data.market}</h1>
      <div class="meta">
        ${data.currency}<span>•</span> Updated: ${new Date(data.last_updated).toLocaleString()}
      </div>
    </header>
    <div class="cards">${cards}</div>
    <footer class="footer">
      <span class="meta">Energy commodities • Live data</span>
      <a href="/logout" class="logout-btn">Log Out</a>
    </footer>
  </div>
</body>
</html>
  `;
}

app.listen(PORT, () => {
  console.log(`Server: http://localhost:${PORT}`);
});
