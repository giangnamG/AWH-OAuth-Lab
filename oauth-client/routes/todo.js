const express = require('express');
const router = express.Router();

const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  res.redirect('/auth/login');
};

router.get('/', isAuthenticated, (req, res) => {
  req.app.locals.db.all(
    'SELECT * FROM todos WHERE user_id = ? ORDER BY created_at DESC',
    [req.session.user.id],
    (err, todos) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to load todos' });
      }
      res.json(todos || []);
    }
  );
});

router.post('/', isAuthenticated, (req, res) => {
  const { title } = req.body;
  
  if (!title || title.trim() === '') {
    return res.status(400).json({ error: 'Todo title is required' });
  }
  
  req.app.locals.db.run(
    'INSERT INTO todos (user_id, title) VALUES (?, ?)',
    [req.session.user.id, title.trim()],
    function(err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to create todo' });
      }
      
      req.app.locals.db.get(
        'SELECT * FROM todos WHERE id = ?',
        [this.lastID],
        (err, todo) => {
          if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Failed to retrieve created todo' });
          }
          res.status(201).json(todo);
        }
      );
    }
  );
});

router.put('/:id/toggle', isAuthenticated, (req, res) => {
  const todoId = req.params.id;
  
  req.app.locals.db.get(
    'SELECT * FROM todos WHERE id = ? AND user_id = ?',
    [todoId, req.session.user.id],
    (err, todo) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to retrieve todo' });
      }
      
      if (!todo) {
        return res.status(404).json({ error: 'Todo not found or not owned by user' });
      }
      
      const newStatus = todo.completed ? 0 : 1;
      
      req.app.locals.db.run(
        'UPDATE todos SET completed = ? WHERE id = ?',
        [newStatus, todoId],
        function(err) {
          if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Failed to update todo' });
          }
          
          res.json({ id: todoId, completed: newStatus });
        }
      );
    }
  );
});

router.delete('/:id', isAuthenticated, (req, res) => {
  const todoId = req.params.id;
  
  req.app.locals.db.run(
    'DELETE FROM todos WHERE id = ? AND user_id = ?',
    [todoId, req.session.user.id],
    function(err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to delete todo' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Todo not found or not owned by user' });
      }
      
      res.json({ id: todoId, deleted: true });
    }
  );
});

module.exports = router;
