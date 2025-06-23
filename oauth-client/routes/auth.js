const express = require('express');
const axios = require('axios');
const router = express.Router();

router.get('/login', (req, res) => {
  const state = Math.random().toString(36).substring(2, 15);
  req.session.oauth_state = state;

  const authUrl = new URL(req.app.locals.oauthConfig.authorization_endpoint);
  authUrl.searchParams.append('client_id', req.app.locals.oauthConfig.client_id);
  authUrl.searchParams.append('redirect_uri', req.app.locals.oauthConfig.redirect_uri);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('state', state);
  authUrl.searchParams.append('scope', 'profile email');

  res.redirect(authUrl.toString());
});

// OAuth - Init the flow
router.get('/authorize-modal', (req, res) => {
  const { state } = req.query;
  res.render('oauth-modal', { 
    oauthConfig: req.app.locals.oauthConfig,
    modalRedirectUri: req.app.locals.oauthConfig.modal_redirect_uri,
    state: state
  });
});

// OAuth - Handle the callback
router.get('/callback-modal', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.render('oauth-callback', { 
      success: false, 
      error: error,
      state: state
    });
  }

  if (!code) {
    return res.render('oauth-callback', { 
      success: false, 
      error: 'No authorization code received',
      state: state
    });
  }

  try {
    // exchange code for token
    const tokenResponse = await axios.post(req.app.locals.oauthConfig.token_endpoint, {
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: req.app.locals.oauthConfig.modal_redirect_uri,
      client_id: req.app.locals.oauthConfig.client_id,
      client_secret: req.app.locals.oauthConfig.client_secret
    });

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    const userInfoResponse = await axios.get(req.app.locals.oauthConfig.userinfo_endpoint, {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });

    const userInfo = userInfoResponse.data;
    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000);

    req.app.locals.db.get('SELECT * FROM users WHERE provider_user_id = ?', [userInfo.user_id], (err, existingUser) => {
      if (err) {
        console.error(err);
        return res.render('oauth-callback', { 
          success: false, 
          error: 'Database error',
          state: state
        });
      }

      if (existingUser) {
        req.app.locals.db.run(
          'UPDATE users SET username = ?, email = ?, name = ?, profile_picture = ?, access_token = ?, refresh_token = ?, token_expires_at = ? WHERE provider_user_id = ?',
          [
            userInfo.username,
            userInfo.email,
            userInfo.name,
            userInfo.profile_picture,
            access_token,
            refresh_token,
            tokenExpiresAt.toISOString(),
            userInfo.user_id
          ],
          function(err) {
            if (err) {
              console.error(err);
              return res.render('oauth-callback', { 
                success: false, 
                error: 'Failed to update user',
                state: state
              });
            }

            req.app.locals.db.get('SELECT * FROM users WHERE id = ?', [existingUser.id], (err, user) => {
              if (err) {
                console.error(err);
                return res.render('oauth-callback', { 
                  success: false, 
                  error: 'Database error',
                  state: state
                });
              }

              req.session.user = user;
              res.render('oauth-callback', { 
                success: true,
                state: state
              });
            });
          }
        );
      } else {
        req.app.locals.db.run(
          'INSERT INTO users (provider_user_id, username, email, name, profile_picture, access_token, refresh_token, token_expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            userInfo.user_id,
            userInfo.username,
            userInfo.email,
            userInfo.name,
            userInfo.profile_picture,
            access_token,
            refresh_token,
            tokenExpiresAt.toISOString()
          ],
          function(err) {
            if (err) {
              console.error(err);
              return res.render('oauth-callback', { 
                success: false, 
                error: 'Failed to create user',
                state: state
              });
            }

            req.app.locals.db.get('SELECT * FROM users WHERE id = ?', [this.lastID], (err, user) => {
              if (err) {
                console.error(err);
                return res.render('oauth-callback', { 
                  success: false, 
                  error: 'Database error',
                  state: state
                });
              }

              req.session.user = user;
              res.render('oauth-callback', { 
                success: true,
                state: state
              });
            });
          }
        );
      }
    });
  } catch (error) {
    console.error('OAuth error:', error.response?.data || error.message);
    res.render('oauth-callback', { 
      success: false, 
      error: 'Failed to authenticate with OAuth provider',
      state: state
    });
  }
});

// OAuth callback
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.render('error', { message: `OAuth error: ${error}` });
  }

  if (!state || state !== req.session.oauth_state) {
    return res.render('error', { message: 'Invalid state parameter' });
  }

  delete req.session.oauth_state;

  if (!code) {
    return res.render('error', { message: 'No authorization code received' });
  }

  try {
    const tokenResponse = await axios.post(req.app.locals.oauthConfig.token_endpoint, {
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: req.app.locals.oauthConfig.redirect_uri,
      client_id: req.app.locals.oauthConfig.client_id,
      client_secret: req.app.locals.oauthConfig.client_secret
    });

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    const userInfoResponse = await axios.get(req.app.locals.oauthConfig.userinfo_endpoint, {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });

    const userInfo = userInfoResponse.data;

    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000);

    req.app.locals.db.get('SELECT * FROM users WHERE provider_user_id = ?', [userInfo.user_id], (err, existingUser) => {
      if (err) {
        console.error(err);
        return res.render('error', { message: 'Database error' });
      }

      if (existingUser) {
        req.app.locals.db.run(
          'UPDATE users SET username = ?, email = ?, name = ?, profile_picture = ?, access_token = ?, refresh_token = ?, token_expires_at = ? WHERE provider_user_id = ?',
          [
            userInfo.username,
            userInfo.email,
            userInfo.name,
            userInfo.profile_picture,
            access_token,
            refresh_token,
            tokenExpiresAt.toISOString(),
            userInfo.user_id
          ],
          function(err) {
            if (err) {
              console.error(err);
              return res.render('error', { message: 'Failed to update user' });
            }

            req.app.locals.db.get('SELECT * FROM users WHERE id = ?', [existingUser.id], (err, user) => {
              if (err) {
                console.error(err);
                return res.render('error', { message: 'Database error' });
              }

              req.session.user = user;
              res.redirect('/dashboard');
            });
          }
        );
      } else {
        req.app.locals.db.run(
          'INSERT INTO users (provider_user_id, username, email, name, profile_picture, access_token, refresh_token, token_expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            userInfo.user_id,
            userInfo.username,
            userInfo.email,
            userInfo.name,
            userInfo.profile_picture,
            access_token,
            refresh_token,
            tokenExpiresAt.toISOString()
          ],
          function(err) {
            if (err) {
              console.error(err);
              return res.render('error', { message: 'Failed to create user' });
            }

            req.app.locals.db.get('SELECT * FROM users WHERE id = ?', [this.lastID], (err, user) => {
              if (err) {
                console.error(err);
                return res.render('error', { message: 'Database error' });
              }

              req.session.user = user;
              res.redirect('/dashboard');
            });
          }
        );
      }
    });
  } catch (error) {
    console.error('OAuth error:', error.response?.data || error.message);
    res.render('error', { message: 'Failed to authenticate with OAuth provider' });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

module.exports = router;
