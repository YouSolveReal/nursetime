// ============================================================
// AUTHENTICATION  (Firebase Email/Password)
// ============================================================

const Auth = (() => {

  // ── Sign Up ───────────────────────────────────────────────
  async function signUp(email, password) {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    return cred.user;
  }

  // ── Sign In ───────────────────────────────────────────────
  async function signIn(email, password) {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    return cred.user;
  }

  // ── Sign Out ──────────────────────────────────────────────
  async function signOut() {
    await auth.signOut();
  }

  // ── Password Reset ────────────────────────────────────────
  async function sendPasswordReset(email) {
    await auth.sendPasswordResetEmail(email);
  }

  // ── Auth State Listener ───────────────────────────────────
  /**
   * Called once on app init.
   * Toggles between the login screen and the main app.
   */
  function initAuthListener() {
    auth.onAuthStateChanged(async user => {
      if (user) {
        // Load settings into global cache before showing app
        try {
          const settings = await DB.getSettings();
          window.appSettings = settings;
        } catch (e) {
          window.appSettings = { ...ShiftUtils.DEFAULTS };
        }
        showApp();
      } else {
        window.appSettings = { ...ShiftUtils.DEFAULTS };
        showLogin();
      }
    });
  }

  function showApp() {
    document.getElementById('loginScreen').classList.add('d-none');
    document.getElementById('appShell').classList.remove('d-none');
    // Trigger clock tab initialization
    if (typeof ClockTab !== 'undefined') ClockTab.init();
  }

  function showLogin() {
    document.getElementById('appShell').classList.add('d-none');
    document.getElementById('loginScreen').classList.remove('d-none');
    // Stop any running timers
    if (typeof ClockTab !== 'undefined') ClockTab.destroy();
  }

  // ── Public API ────────────────────────────────────────────
  return { signUp, signIn, signOut, sendPasswordReset, initAuthListener };
})();
