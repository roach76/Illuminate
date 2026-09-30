/* ========================================== */
/* AUTHENTICATION & SESSION MANAGEMENT        */
/* ========================================== */

function initAuthListeners() {
  $('#authSubmit').addEventListener('click', () => {
    const email = $('#email').value.trim().toLowerCase(); 
    if (!email || !$('#password').value) return; 
    
    if (signup) { 
        state.users[email] = { 
            name: email.split('@')[0], 
            email, 
            password: $('#password').value, 
            profile: null, 
            partner: null, 
            businessPartner: null,
            children: []
        }; 
    } else if (!state.users[email] || state.users[email].password !== $('#password').value) { 
        $('#authError').textContent = 'Invalid credentials.'; 
        return; 
    }
    
    state.active = email; 
    saveState(); 
    
    // go() is available globally via app.js
    if(typeof go === 'function') go(state.users[email].profile ? 'home' : 'intake');
  });

  $('#modeToggle').addEventListener('click', () => {
      signup = !signup;
      if(typeof updateAuthModeUI === 'function') updateAuthModeUI();
      if(typeof updateStaticLanguage === 'function') updateStaticLanguage();
  });

  // BUG FIX (reported: "unable to login when an existing account exist" / "unable to create new
  // account"): these two Welcome-screen buttons previously had no click handler of their own at all -
  // they relied entirely on a generic [data-go] listener (app.js) that only knows how to switch which
  // screen is showing, with no way to express "the user wants to sign IN" vs "the user wants to create
  // an account". `signup` (the flag that actually decides which of those two things Submit does) was
  // left however a previous visit happened to leave it. Each button now explicitly sets `signup` to
  // match its own, unambiguous intent before navigating, so the auth screen always does what the
  // button the user actually clicked promised.
  const btnCreateAcc = $('#btnCreateAcc');
  if (btnCreateAcc) btnCreateAcc.addEventListener('click', () => {
    signup = true;
    if (typeof updateAuthModeUI === 'function') updateAuthModeUI();
    if (typeof go === 'function') go('auth');
  });
  const btnSignIn = $('#btnSignIn');
  if (btnSignIn) btnSignIn.addEventListener('click', () => {
    signup = false;
    if (typeof updateAuthModeUI === 'function') updateAuthModeUI();
    if (typeof go === 'function') go('auth');
  });

  $('#signOut').addEventListener('click', () => { 
      state.active = null; 
      saveState(); 
      if(typeof go === 'function') go('welcome'); 
  });
}