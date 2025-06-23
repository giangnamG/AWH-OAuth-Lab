document.addEventListener('DOMContentLoaded', function() {
  const loginButton = document.getElementById('oauth-login-button');
  const modalContainer = document.getElementById('oauth-modal-container');
  const modalIframe = document.getElementById('oauth-modal-iframe');
  const modalCloseButton = document.getElementById('oauth-modal-close');
  
  if (loginButton) {
    loginButton.addEventListener('click', function(e) {
      e.preventDefault();
      
      const state = Math.random().toString(36).substring(2, 15);
      localStorage.setItem('oauth_state', state);
      
      const authUrl = new URL('/auth/authorize-modal', window.location.origin);
      authUrl.searchParams.append('state', state);
      
      modalContainer.style.display = 'flex';
      modalIframe.src = authUrl.toString();
    });
  }
  
  if (modalCloseButton) {
    modalCloseButton.addEventListener('click', function() {
      modalContainer.style.display = 'none';
      modalIframe.src = 'about:blank';
    });
  }
  
  window.addEventListener('message', function(event) {
    if (event.origin !== window.location.origin) return;
    
    const data = event.data;
    
    if (data.type === 'oauth_success') {
      if (data.state !== localStorage.getItem('oauth_state')) {
        console.error('OAuth state mismatch');
        return;
      }
      
      localStorage.removeItem('oauth_state');
      modalContainer.style.display = 'none';
      modalIframe.src = 'about:blank';
      window.location.reload();
    } else if (data.type === 'oauth_error') {
      alert('Authentication failed: ' + data.error);
      modalContainer.style.display = 'none';
      modalIframe.src = 'about:blank';
    }
  });
});
