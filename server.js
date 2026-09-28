const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static frontend files from current directory
app.use(express.static(__dirname));

// Ensure data folder and db.json exist
function initDB() {
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(DB_PATH)) {
    const initialData = {
      users: {},
      transactions: [],
      goals: [],
      budget: {},
      notifications: []
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2), 'utf8');
  }
}

// Helper: Read DB
function readDB() {
  try {
    initDB();
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading database:', err);
    return { users: {}, transactions: [], goals: [], budget: {}, notifications: [] };
  }
}

// Helper: Write DB
function writeDB(data) {
  try {
    initDB();
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing database:', err);
    return false;
  }
}

/* ------------------- REST API ENDPOINTS ------------------- */

// Healthcheck / Status
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'SpendWise Backend API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Full Sync endpoint (Bi-directional / Push)
app.post('/api/sync', (req, res) => {
  const { action, payload, userEmail } = req.body;
  const db = readDB();

  if (action === 'sync_all' && payload) {
    if (payload.users) db.users = { ...db.users, ...payload.users };
    if (payload.transactions && Array.isArray(payload.transactions)) {
      // Merge unique transactions by id
      const existingIds = new Set(db.transactions.map(t => t.id));
      payload.transactions.forEach(t => {
        if (!existingIds.has(t.id)) {
          db.transactions.push(t);
        }
      });
    }
    if (payload.goals && Array.isArray(payload.goals)) {
      db.goals = payload.goals;
    }
    if (payload.budget) {
      if (userEmail) db.budget[userEmail] = payload.budget;
      else db.budget = payload.budget;
    }
    writeDB(db);
    return res.json({ status: 'success', message: 'All data synchronized successfully' });
  }

  if (action === 'add_transaction' && payload) {
    db.transactions.unshift(payload);
    writeDB(db);
    return res.json({ status: 'success', message: 'Transaction saved' });
  }

  if (action === 'add_user' && payload) {
    if (payload.email) {
      db.users[payload.email] = payload;
      writeDB(db);
    }
    return res.json({ status: 'success', message: 'User updated' });
  }

  if (action === 'add_goal' && payload) {
    db.goals.push(payload);
    writeDB(db);
    return res.json({ status: 'success', message: 'Goal added' });
  }

  return res.status(400).json({ status: 'error', message: 'Unknown or missing sync action' });
});

// Get all DB data
app.get('/api/data', (req, res) => {
  const db = readDB();
  res.json({ status: 'success', data: db });
});

// User Auth Signup
app.post('/api/auth/signup', (req, res) => {
  const { name, email, passHash } = req.body;
  if (!email || !passHash) {
    return res.status(400).json({ status: 'error', message: 'Email and password hash required' });
  }

  const db = readDB();
  if (db.users[email]) {
    return res.status(400).json({ status: 'error', message: 'User already exists' });
  }

  const newUser = { email, name: name || 'User', passHash, createdAt: new Date().toISOString() };
  db.users[email] = newUser;
  writeDB(db);

  res.json({ status: 'success', user: newUser });
});

// User Auth Login
app.post('/api/auth/login', (req, res) => {
  const { email, passHash } = req.body;
  const db = readDB();
  const user = db.users[email];

  if (!user || user.passHash !== passHash) {
    return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
  }

  res.json({ status: 'success', user: { email: user.email, name: user.name } });
});

// Get Transactions
app.get('/api/transactions', (req, res) => {
  const { userEmail } = req.query;
  const db = readDB();
  let list = db.transactions;
  if (userEmail) {
    list = list.filter(t => t.userEmail === userEmail || !t.userEmail);
  }
  res.json({ status: 'success', transactions: list });
});

// Add Transaction
app.post('/api/transactions', (req, res) => {
  const tx = req.body;
  if (!tx.id || !tx.amt || !tx.desc) {
    return res.status(400).json({ status: 'error', message: 'Missing transaction fields' });
  }

  const db = readDB();
  db.transactions.unshift(tx);
  writeDB(db);
  res.json({ status: 'success', transaction: tx });
});

// Delete Transaction
app.delete('/api/transactions/:id', (req, res) => {
  const { id } = req.params;
  const db = readDB();
  db.transactions = db.transactions.filter(t => t.id !== id);
  writeDB(db);
  res.json({ status: 'success', message: `Transaction ${id} deleted` });
});

// Get Goals
app.get('/api/goals', (req, res) => {
  const db = readDB();
  res.json({ status: 'success', goals: db.goals });
});

// Save Goals
app.post('/api/goals', (req, res) => {
  const goals = req.body;
  const db = readDB();
  db.goals = goals;
  writeDB(db);
  res.json({ status: 'success', goals: db.goals });
});

// Get Budget
app.get('/api/budget', (req, res) => {
  const db = readDB();
  res.json({ status: 'success', budget: db.budget });
});

// Save Budget
app.post('/api/budget', (req, res) => {
  const { userEmail, budget } = req.body;
  const db = readDB();
  if (userEmail) {
    db.budget[userEmail] = budget;
  } else {
    db.budget = budget;
  }
  writeDB(db);
  res.json({ status: 'success', message: 'Budget updated' });
});

// Fallback route to serve index.html for single page application routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  initDB();
  console.log(`================================================`);
  console.log(`🚀 SpendWise Node.js Backend Server is running!`);
  console.log(`📡 Local API URL: http://localhost:${PORT}`);
  console.log(`📁 Data Storage: ${DB_PATH}`);
  console.log(`================================================`);
});
