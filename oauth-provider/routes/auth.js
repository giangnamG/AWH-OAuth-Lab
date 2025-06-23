const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  res.redirect('/auth/login');
};

router.get('/login', (req, res) => {
  res.render('login', { error: null });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.render('login', { error: 'Username and password are required' });
  }

  req.app.locals.db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      console.error(err);
      return res.render('login', { error: 'An error occurred' });
    }

    if (!user) {
      return res.render('login', { error: 'Invalid username or password' });
    }

    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (err) {
        console.error(err);
        return res.render('login', { error: 'An error occurred' });
      }

      if (!isMatch) {
        return res.render('login', { error: 'Invalid username or password' });
      }

          const { password, ...userWithoutPassword } = user;
          req.session.user = userWithoutPassword;
          
          if (req.session.oauth) {
            const { client_id, redirect_uri, response_type, scope, state } = req.session.oauth;
            delete req.session.oauth; // Clear the OAuth request from session
            
            return res.redirect(`/oauth/authorize?client_id=${client_id}&redirect_uri=${redirect_uri}&response_type=${response_type}&scope=${scope || ''}&state=${state || ''}`);
          }
          
          res.redirect('/user/profile');
    });
  });
});

router.get('/register', (req, res) => {
  res.render('register', { error: null });
});

router.post('/register', (req, res) => {
  const { username, email, password, confirmPassword } = req.body;

  if (!username || !email || !password || !confirmPassword) {
    return res.render('register', { error: 'All fields are required' });
  }

  if (password !== confirmPassword) {
    return res.render('register', { error: 'Passwords do not match' });
  }

  req.app.locals.db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, email], (err, existingUser) => {
    if (err) {
      console.error(err);
      return res.render('register', { error: 'An error occurred' });
    }

    if (existingUser) {
      return res.render('register', { error: 'Username or email already exists' });
    }

    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) {
        console.error(err);
        return res.render('register', { error: 'An error occurred' });
      }

      req.app.locals.db.run(
        'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
        [username, email, hashedPassword],
        function(err) {
          if (err) {
            console.error(err);
            return res.render('register', { error: 'An error occurred' });
          }

          req.app.locals.db.get('SELECT * FROM users WHERE id = ?', [this.lastID], (err, user) => {
            if (err) {
              console.error(err);
              return res.render('register', { error: 'An error occurred' });
            }

            const { password, ...userWithoutPassword } = user;
            req.session.user = userWithoutPassword;
            
            if (req.session.oauth) {
              const { client_id, redirect_uri, response_type, scope, state } = req.session.oauth;
              delete req.session.oauth; // Clear the OAuth request from session
              
              return res.redirect(`/oauth/authorize?client_id=${client_id}&redirect_uri=${redirect_uri}&response_type=${response_type}&scope=${scope || ''}&state=${state || ''}`);
            }
            
            res.redirect('/user/profile');
          });
        }
      );
    });
  });
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

module.exports = router;
