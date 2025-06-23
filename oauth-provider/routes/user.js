const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadDir = path.join(__dirname, '../public/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function(req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  res.redirect('/auth/login');
};

router.get('/profile', isAuthenticated, (req, res) => {
  req.app.locals.db.get('SELECT * FROM users WHERE id = ?', [req.session.user.id], (err, user) => {
    if (err) {
      console.error(err);
      return res.render('error', { message: 'An error occurred' });
    }

    if (!user) {
      req.session.destroy();
      return res.redirect('/auth/login');
    }

    req.app.locals.db.all('SELECT * FROM oauth_clients WHERE user_id = ?', [user.id], (err, clients) => {
      if (err) {
        console.error(err);
        return res.render('error', { message: 'An error occurred' });
      }

      res.render('profile', { 
        user: user,
        clients: clients || [],
        error: null,
        success: null
      });
    });
  });
});

router.post('/profile', isAuthenticated, upload.single('profile_picture'), (req, res) => {
  const { name } = req.body;
  const userId = req.session.user.id;
  
  req.app.locals.db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      console.error(err);
      return res.render('error', { message: 'An error occurred' });
    }

    if (!user) {
      req.session.destroy();
      return res.redirect('/auth/login');
    }

    let profilePicture = user.profile_picture;
    if (req.file) {
      profilePicture = `/uploads/${req.file.filename}`;
    }

    req.app.locals.db.run(
      'UPDATE users SET name = ?, profile_picture = ? WHERE id = ?',
      [name, profilePicture, userId],
      function(err) {
        if (err) {
          console.error(err);
          return res.render('profile', { 
            user: user,
            clients: [],
            error: 'Failed to update profile',
            success: null
          });
        }

        req.app.locals.db.get('SELECT * FROM users WHERE id = ?', [userId], (err, updatedUser) => {
          if (err) {
            console.error(err);
            return res.render('error', { message: 'An error occurred' });
          }

          const { password, ...userWithoutPassword } = updatedUser;
          req.session.user = userWithoutPassword;

          req.app.locals.db.all('SELECT * FROM oauth_clients WHERE user_id = ?', [userId], (err, clients) => {
            if (err) {
              console.error(err);
              return res.render('error', { message: 'An error occurred' });
            }

            res.render('profile', { 
              user: updatedUser,
              clients: clients || [],
              error: null,
              success: 'Profile updated successfully'
            });
          });
        });
      }
    );
  });
});

router.post('/register-client', isAuthenticated, (req, res) => {
  const { name, redirect_uri } = req.body;
  const userId = req.session.user.id;

  if (!name || !redirect_uri) {
    return res.redirect('/user/profile?error=Missing required fields');
  }

  const client_id = `client_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  const client_secret = `secret_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

  req.app.locals.db.run(
    'INSERT INTO oauth_clients (client_id, client_secret, redirect_uri, name, user_id) VALUES (?, ?, ?, ?, ?)',
    [client_id, client_secret, redirect_uri, name, userId],
    function(err) {
      if (err) {
        console.error(err);
        return res.redirect('/user/profile?error=Failed to register client');
      }

      res.redirect('/user/profile?success=Client registered successfully');
    }
  );
});

module.exports = router;
