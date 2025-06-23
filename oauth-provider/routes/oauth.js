const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  res.redirect('/auth/login');
};

router.get('/authorize', (req, res) => {
  const { client_id, redirect_uri, response_type, scope, state } = req.query;

  if (!client_id || !redirect_uri || !response_type) {
    return res.render('error', { message: 'Invalid OAuth request: Missing required parameters' });
  }

  if (response_type !== 'code') {
    return res.render('error', { message: 'Invalid OAuth request: Unsupported response type' });
  }

  req.app.locals.db.get(
    'SELECT * FROM oauth_clients WHERE client_id = ?',
    [client_id],
    (err, client) => {
      if (err) {
        console.error(err);
        return res.render('error', { message: 'An error occurred' });
      }

      if (!client) {
        return res.render('error', { message: 'Invalid OAuth request: Unknown client' });
      }

      // const allowedRedirectUris = client.redirect_uri.split(' ');
      // if (!allowedRedirectUris.includes(redirect_uri)) {
      //   return res.render('error', { message: 'Invalid OAuth request: Redirect URI mismatch' });
      // }

      if (!req.session.user) {
        req.session.oauth = { client_id, redirect_uri, response_type, scope, state };
        return res.redirect('/auth/login');
      }

      res.render('consent', {
        client: client,
        user: req.session.user,
        redirect_uri: redirect_uri,
        scope: scope || '',
        state: state || ''
      });
    }
  );
});

router.post('/authorize', isAuthenticated, (req, res) => {
  try {
    const { client_id, redirect_uri, state, scope, consent } = req.body;

    if (consent !== 'allow') {
      try {
        const redirectUrl = new URL(redirect_uri);
        redirectUrl.searchParams.append('error', 'access_denied');
        if (state) redirectUrl.searchParams.append('state', state);
        return res.redirect(redirectUrl.toString());
      } catch (urlErr) {
        console.error(urlErr);
        return res.render('error', { message: 'Invalid redirect URI' });
      }
    }

    req.app.locals.db.get(
      'SELECT * FROM oauth_clients WHERE client_id = ?',
      [client_id],
      (err, client) => {
        try {
          if (err) {
            console.error(err);
            return res.render('error', { message: 'An error occurred' });
          }

          if (!client) {
            return res.render('error', { message: 'Invalid OAuth request: Unknown client' });
          }

          const code = uuidv4();
          const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

          req.app.locals.db.run(
            'INSERT INTO oauth_codes (code, client_id, user_id, expires_at) VALUES (?, ?, ?, ?)',
            [code, client_id, req.session.user.id, expiresAt.toISOString()],
            (err) => {
              try {
                if (err) {
                  console.error(err);
                  return res.render('error', { message: 'An error occurred' });
                }

                try {
                  const redirectUrl = new URL(redirect_uri);
                  redirectUrl.searchParams.append('code', code);
                  if (state) redirectUrl.searchParams.append('state', state);
                  res.redirect(redirectUrl.toString());
                } catch (urlErr) {
                  console.error(urlErr);
                  return res.render('error', { message: 'Invalid redirect URI' });
                }
              } catch (innerErr) {
                console.error(innerErr);
                return res.render('error', { message: 'An error occurred' });
              }
            }
          );
        } catch (innerErr) {
          console.error(innerErr);
          return res.render('error', { message: 'An error occurred' });
        }
      }
    );
  } catch (outerErr) {
    console.error(outerErr);
    return res.render('error', { message: 'An error occurred' });
  }
});


router.post('/token', (req, res) => {
  const { grant_type, code, redirect_uri, client_id, client_secret } = req.body;

  if (!grant_type) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Missing grant_type parameter'
    });
  }

  if (grant_type === 'authorization_code') {
    if (!code || !redirect_uri || !client_id || !client_secret) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing required parameters'
      });
    }

    req.app.locals.db.get(
      'SELECT * FROM oauth_clients WHERE client_id = ? AND client_secret = ?',
      [client_id, client_secret],
      (err, client) => {
        if (err) {
          console.error(err);
          return res.status(500).json({
            error: 'server_error',
            error_description: 'An error occurred'
          });
        }

        if (!client) {
          return res.status(401).json({
            error: 'invalid_client',
            error_description: 'Invalid client credentials'
          });
        }

        const allowedRedirectUris = client.redirect_uri.split(' ');
        if (!allowedRedirectUris.includes(redirect_uri)) {
          return res.status(400).json({
            error: 'invalid_grant',
            error_description: 'Redirect URI mismatch'
          });
        }

        req.app.locals.db.get(
          'SELECT * FROM oauth_codes WHERE code = ? AND client_id = ?',
          [code, client_id],
          (err, authCode) => {
            if (err) {
              console.error(err);
              return res.status(500).json({
                error: 'server_error',
                error_description: 'An error occurred'
              });
            }

            if (!authCode) {
              return res.status(400).json({
                error: 'invalid_grant',
                error_description: 'Invalid authorization code'
              });
            }

            if (new Date(authCode.expires_at) < new Date()) {
              return res.status(400).json({
                error: 'invalid_grant',
                error_description: 'Authorization code has expired'
              });
            }

            const accessToken = uuidv4();
            const refreshToken = uuidv4();
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

            req.app.locals.db.run(
              'INSERT INTO oauth_tokens (access_token, refresh_token, client_id, user_id, expires_at) VALUES (?, ?, ?, ?, ?)',
              [accessToken, refreshToken, client_id, authCode.user_id, expiresAt.toISOString()],
              (err) => {
                if (err) {
                  console.error(err);
                  return res.status(500).json({
                    error: 'server_error',
                    error_description: 'An error occurred'
                  });
                }

                req.app.locals.db.run('DELETE FROM oauth_codes WHERE code = ?', [code]);
                res.json({
                  access_token: accessToken,
                  token_type: 'Bearer',
                  expires_in: 3600, // 1 hour in seconds
                  refresh_token: refreshToken
                });
              }
            );
          }
        );
      }
    );
  } else if (grant_type === 'refresh_token') {
    const { refresh_token, client_id, client_secret } = req.body;

    if (!refresh_token || !client_id || !client_secret) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing required parameters'
      });
    }

    req.app.locals.db.get(
      'SELECT * FROM oauth_clients WHERE client_id = ? AND client_secret = ?',
      [client_id, client_secret],
      (err, client) => {
        if (err) {
          console.error(err);
          return res.status(500).json({
            error: 'server_error',
            error_description: 'An error occurred'
          });
        }

        if (!client) {
          return res.status(401).json({
            error: 'invalid_client',
            error_description: 'Invalid client credentials'
          });
        }

        req.app.locals.db.get(
          'SELECT * FROM oauth_tokens WHERE refresh_token = ? AND client_id = ?',
          [refresh_token, client_id],
          (err, token) => {
            if (err) {
              console.error(err);
              return res.status(500).json({
                error: 'server_error',
                error_description: 'An error occurred'
              });
            }

            if (!token) {
              return res.status(400).json({
                error: 'invalid_grant',
                error_description: 'Invalid refresh token'
              });
            }

            const newAccessToken = uuidv4();
            const newRefreshToken = uuidv4();
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

            req.app.locals.db.run(
              'UPDATE oauth_tokens SET access_token = ?, refresh_token = ?, expires_at = ? WHERE refresh_token = ?',
              [newAccessToken, newRefreshToken, expiresAt.toISOString(), refresh_token],
              (err) => {
                if (err) {
                  console.error(err);
                  return res.status(500).json({
                    error: 'server_error',
                    error_description: 'An error occurred'
                  });
                }

                res.json({
                  access_token: newAccessToken,
                  token_type: 'Bearer',
                  expires_in: 3600, // 1 hour in seconds
                  refresh_token: newRefreshToken
                });
              }
            );
          }
        );
      }
    );
  } else {
    return res.status(400).json({
      error: 'unsupported_grant_type',
      error_description: 'Unsupported grant type'
    });
  }
});

router.get('/userinfo', (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'invalid_token',
      error_description: 'Missing or invalid token'
    });
  }

  const token = authHeader.substring(7);

  req.app.locals.db.get(
    'SELECT t.*, u.id as user_id, u.username, u.email, u.name, u.profile_picture FROM oauth_tokens t JOIN users u ON t.user_id = u.id WHERE t.access_token = ?',
    [token],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({
          error: 'server_error',
          error_description: 'An error occurred'
        });
      }

      if (!result) {
        return res.status(401).json({
          error: 'invalid_token',
          error_description: 'Invalid token'
        });
      }

      if (new Date(result.expires_at) < new Date()) {
        return res.status(401).json({
          error: 'invalid_token',
          error_description: 'Token has expired'
        });
      }

      res.json({
        user_id: result.user_id,
        username: result.username,
        email: result.email,
        name: result.name || '',
        profile_picture: result.profile_picture || ''
      });
    }
  );
});

module.exports = router;
