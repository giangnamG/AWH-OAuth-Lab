const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const CLIENT_PORT = process.env.CLIENT_PORT || 3001;

const CLIENT_DOMAIN = process.env.CLIENT_DOMAIN || 'http://localhost:3001';
const OAUTH_PROVIDER_URL = process.env.PROVIDER_DOMAIN || 'http://localhost:3000';
const CLIENT_ID = process.env.CLIENT_ID || 'test-client-id';
const CLIENT_SECRET = process.env.CLIENT_SECRET || 'test-client-secret';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(session({
  secret: 'oauth-client-secret',
  resave: false,
  saveUninitialized: false
}));

const db = new sqlite3.Database(':memory:');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_user_id INTEGER UNIQUE NOT NULL,
      username TEXT NOT NULL,
      email TEXT,
      name TEXT,
      profile_picture TEXT,
      access_token TEXT,
      refresh_token TEXT,
      token_expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      completed BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);
});

const oauthConfig = {
  client_id: CLIENT_ID,
  client_secret: CLIENT_SECRET,
  redirect_uri: `${CLIENT_DOMAIN}/auth/callback`,
  modal_redirect_uri: `${CLIENT_DOMAIN}/auth/callback-modal`,
  authorization_endpoint: `${OAUTH_PROVIDER_URL}/oauth/authorize`,
  token_endpoint: `${OAUTH_PROVIDER_URL}/oauth/token`,
  userinfo_endpoint: `${OAUTH_PROVIDER_URL}/oauth/userinfo`
};

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const todoRoutes = require('./routes/todo');

app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/todos', todoRoutes);

app.get('/', (req, res) => {
  res.render('index', { user: req.session.user });
});

app.get('/dashboard', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/');
  }

  db.all('SELECT * FROM todos WHERE user_id = ? ORDER BY created_at DESC', [req.session.user.id], (err, todos) => {
    if (err) {
      console.error(err);
      return res.render('error', { message: 'Failed to load todos', user: req.session.user });
    }

    res.render('dashboard', {
      user: req.session.user,
      todos: todos || []
    });
  });
});

app.listen(CLIENT_PORT, () => {
  console.log(`OAuth Client running on ${CLIENT_DOMAIN}`);
});

app.locals.db = db;
app.locals.oauthConfig = oauthConfig;

module.exports = { app };
