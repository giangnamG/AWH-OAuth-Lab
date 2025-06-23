const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PROVIDER_PORT = process.env.PROVIDER_PORT || 3000;

const CLIENT_DOMAIN = process.env.CLIENT_DOMAIN || 'http://localhost:3001';
const PROVIDER_DOMAIN = process.env.PROVIDER_DOMAIN || 'http://localhost:3000';
const CLIENT_ID = process.env.CLIENT_ID || 'test-client-id';
const CLIENT_SECRET = process.env.CLIENT_SECRET || 'test-client-secret';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(session({
  secret: 'oauth-provider-secret',
  resave: false,
  saveUninitialized: false
}));

const db = new sqlite3.Database(':memory:');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT,
      profile_picture TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS oauth_clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id TEXT UNIQUE NOT NULL,
      client_secret TEXT NOT NULL,
      redirect_uri TEXT NOT NULL,
      name TEXT NOT NULL,
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS oauth_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      client_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS oauth_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      access_token TEXT UNIQUE NOT NULL,
      refresh_token TEXT UNIQUE,
      client_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  db.get('SELECT * FROM oauth_clients WHERE client_id = ?', [CLIENT_ID], (err, client) => {
    if (err) {
      console.error('Error checking for existing client:', err);
      return;
    }

    const redirectURIs = `${CLIENT_DOMAIN}/auth/callback ${CLIENT_DOMAIN}/auth/callback-modal`;

    if (client) {
      db.run(`
        UPDATE oauth_clients 
        SET redirect_uri = ? 
        WHERE client_id = ?
      `, [redirectURIs, CLIENT_ID]);
    } else {
      db.run(`
        INSERT INTO oauth_clients (client_id, client_secret, redirect_uri, name, user_id)
        VALUES (?, ?, ?, ?, ?)
      `, [CLIENT_ID, CLIENT_SECRET, redirectURIs, 'Test Client', null]);
    }
  });
});

app.locals.db = db;

app.get('/', (req, res) => {
  res.render('index', { user: req.session.user });
});

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const oauthRoutes = require('./routes/oauth');

app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/oauth', oauthRoutes);

app.listen(PROVIDER_PORT, () => {
  console.log(`OAuth Provider running on ${PROVIDER_DOMAIN}`);
});

module.exports = { app };
