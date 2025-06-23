document.addEventListener('DOMContentLoaded', function() {
  const addTodoForm = document.getElementById('add-todo-form');
  const todoTitleInput = document.getElementById('todo-title');
  const todoList = document.getElementById('todo-list');
  
  addTodoForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const title = todoTitleInput.value.trim();
    if (!title) return;
    
    fetch('/todos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title })
    })
    .then(response => response.json())
    .then(todo => {
      todoTitleInput.value = '';
      
      const noTodosMessage = todoList.querySelector('.list-group-item.text-center');
      if (noTodosMessage) {
        todoList.removeChild(noTodosMessage);
      }
      
      const li = createTodoElement(todo);
      todoList.prepend(li);
    })
    .catch(error => {
      console.error('Error adding todo:', error);
      alert('Failed to add todo. Please try again.');
    });
  });
  
  todoList.addEventListener('change', function(e) {
    if (e.target.classList.contains('todo-checkbox')) {
      const li = e.target.closest('li');
      const todoId = li.dataset.id;
      const label = li.querySelector('.form-check-label');
      
      fetch(`/todos/${todoId}/toggle`, {
        method: 'PUT'
      })
      .then(response => response.json())
      .then(data => {
        if (data.completed) {
          label.classList.add('text-decoration-line-through');
        } else {
          label.classList.remove('text-decoration-line-through');
        }
      })
      .catch(error => {
        console.error('Error toggling todo:', error);
        e.target.checked = !e.target.checked;
        alert('Failed to update todo. Please try again.');
      });
    }
  });
  
  todoList.addEventListener('click', function(e) {
    if (e.target.classList.contains('delete-todo')) {
      const li = e.target.closest('li');
      const todoId = li.dataset.id;
      
      fetch(`/todos/${todoId}`, {
        method: 'DELETE'
      })
      .then(response => response.json())
      .then(data => {
        if (data.deleted) {
          li.remove();
          
          if (todoList.children.length === 0) {
            const noTodosMessage = document.createElement('li');
            noTodosMessage.className = 'list-group-item text-center';
            noTodosMessage.textContent = 'No todos yet. Add one above!';
            todoList.appendChild(noTodosMessage);
          }
        }
      })
      .catch(error => {
        console.error('Error deleting todo:', error);
        alert('Failed to delete todo. Please try again.');
      });
    }
  });
  
  function createTodoElement(todo) {
    const li = document.createElement('li');
    li.className = 'list-group-item d-flex justify-content-between align-items-center';
    li.dataset.id = todo.id;
    
    li.innerHTML = `
      <div class="form-check">
        <input class="form-check-input todo-checkbox" type="checkbox" value="" id="todo-${todo.id}" 
          ${todo.completed ? 'checked' : ''}>
        <label class="form-check-label ${todo.completed ? 'text-decoration-line-through' : ''}" 
          for="todo-${todo.id}">
          ${escapeHtml(todo.title)}
        </label>
      </div>
      <button class="btn btn-sm btn-danger delete-todo">Delete</button>
    `;
    
    return li;
  }
  
  function escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
});
