const express = require('express');
const axios = require('axios');
const router = express.Router();

const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  res.redirect('/');
};

const ensureValidToken = async (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/');
  }

  const user = req.session.user;
  const now = new Date();
  const tokenExpiresAt = new Date(user.token_expires_at);

  if (tokenExpiresAt > now) {
    return next();
  }

  try {
    const refreshResponse = await axios.post(req.app.locals.oauthConfig.token_endpoint, {
      grant_type: 'refresh_token',
      refresh_token: user.refresh_token,
      client_id: req.app.locals.oauthConfig.client_id,
      client_secret: req.app.locals.oauthConfig.client_secret
    });

    const { access_token, refresh_token, expires_in } = refreshResponse.data;
    const newExpiresAt = new Date(Date.now() + expires_in * 1000);

    req.app.locals.db.run(
      'UPDATE users SET access_token = ?, refresh_token = ?, token_expires_at = ? WHERE id = ?',
      [access_token, refresh_token, newExpiresAt.toISOString(), user.id],
      function(err) {
        if (err) {
          console.error('Failed to update token:', err);
          req.session.destroy();
          return res.redirect('/');
        }

        user.access_token = access_token;
        user.refresh_token = refresh_token;
        user.token_expires_at = newExpiresAt.toISOString();
        req.session.user = user;

        next();
      }
    );
  } catch (error) {
    console.error('Token refresh failed:', error.response?.data || error.message);
    req.session.destroy();
    res.redirect('/');
  }
};

router.get('/profile', isAuthenticated, ensureValidToken, async (req, res) => {
  try {
    const userInfoResponse = await axios.get(req.app.locals.oauthConfig.userinfo_endpoint, {
      headers: {
        'Authorization': `Bearer ${req.session.user.access_token}`
      }
    });

    const userInfo = userInfoResponse.data;

    req.app.locals.db.run(
      'UPDATE users SET username = ?, email = ?, name = ?, profile_picture = ? WHERE id = ?',
      [
        userInfo.username,
        userInfo.email,
        userInfo.name,
        userInfo.profile_picture,
        req.session.user.id
      ],
      function(err) {
        if (err) {
          console.error('Failed to update user info:', err);
          return res.render('error', { message: 'Failed to update user information' });
        }

        req.app.locals.db.get('SELECT * FROM users WHERE id = ?', [req.session.user.id], (err, user) => {
          if (err) {
            console.error(err);
            return res.render('error', { message: 'Database error' });
          }

          req.session.user = user;

          res.render('profile', { user: user });
        });
      }
    );
  } catch (error) {
    console.error('Failed to get user info:', error.response?.data || error.message);
    res.render('error', { message: 'Failed to get user information from provider' });
  }
});

module.exports = router;
