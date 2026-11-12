/* Cadra's website and mobile apps use the same Supabase Auth project. */
(() => {
  'use strict';

  const projectUrl = 'https://yljlzafmerojiipwbvhq.supabase.co';
  const publishableKey = 'sb_publishable_ojmAeyCbOYMyLxUYz0Vibg_K7nYbNC5';
  const client = window.supabase.createClient(projectUrl, publishableKey, {
    auth: {
      storageKey: 'cadra-runner-web-session',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  });
  let recovery = null;
  let attemptNumber = 0;

  function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
  }

  function failure(error, fallback) {
    const code = error?.code;
    if (code === 'invalid_credentials' || code === 'user_not_found') return new Error('Check your email address and password and try again.');
    if (code === 'email_not_confirmed') return new Error('Confirm your email address using the email from Cadra, then sign in again.');
    if (code === 'otp_expired' || code === 'otp_disabled') return new Error('This code is invalid or has expired. Request a new code and use the latest email.');
    if (code === 'weak_password' || code === 'same_password') return new Error('Choose a different, stronger password with at least 8 characters.');
    if (error?.status === 429 || code?.includes('rate_limit')) return new Error('Too many attempts. Wait a minute and try again.');
    if (code === 'email_address_not_authorized') return new Error('Reset email is unavailable for this address. Contact Cadra support.');
    if (!error?.status || error?.status >= 500) return new Error('Could not reach Cadra. Check your connection and try again.');
    return new Error(fallback);
  }

  async function currentUser() {
    const { data: stored, error: storageError } = await client.auth.getSession();
    if (storageError) throw failure(storageError, 'Your session could not be restored. Please sign in again.');
    if (!stored.session) return null;
    const { data, error } = await client.auth.getUser();
    if (error) {
      if (error.status === 401 || error.status === 403 || error.code === 'session_not_found') {
        await client.auth.signOut({ scope: 'local' });
        return null;
      }
      throw failure(error, 'Your session could not be verified. Try again.');
    }
    return data.user;
  }

  async function signIn(email, password) {
    const { data, error } = await client.auth.signInWithPassword({ email: normalizeEmail(email), password });
    if (error || !data?.user) throw failure(error, 'Could not sign in. Check your email and password and try again.');
    return data.user;
  }

  async function signOut() {
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) throw failure(error, 'Sign-out did not finish. Try again.');
  }

  function onChange(callback) {
    let active = true;
    const { data } = client.auth.onAuthStateChange((event, session) => {
      // Leave the SDK's auth lock before UI callbacks perform further SDK reads.
      setTimeout(() => { if (active) callback(event, session?.user || null); }, 0);
    });
    return () => { active = false; data.subscription.unsubscribe(); };
  }

  function cancelRecovery() {
    const attempt = recovery;
    recovery = null;
    if (attempt) {
      // The reset session is only in memory and never enters the dashboard client.
      void attempt.client.auth.signOut({ scope: 'local' }).catch(() => {});
      void attempt.client.auth.stopAutoRefresh();
    }
  }

  async function requestRecovery(value) {
    cancelRecovery();
    const email = normalizeEmail(value);
    const resetClient = window.supabase.createClient(projectUrl, publishableKey, {
      auth: {
        storageKey: 'cadra-runner-recovery-' + (++attemptNumber),
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }
    });
    const attempt = { client: resetClient, email, verified: false };
    recovery = attempt;
    const { error } = await resetClient.auth.resetPasswordForEmail(email);
    assertCurrent(attempt);
    if (error) {
      cancelRecovery();
      throw failure(error, 'Could not request a reset code. Try again or contact Cadra support.');
    }
  }

  function assertCurrent(attempt) {
    if (!attempt || recovery !== attempt) throw new Error('Request a new reset code to continue.');
  }

  async function resetPassword(email, code, password) {
    const attempt = recovery;
    assertCurrent(attempt);
    if (normalizeEmail(email) !== attempt.email) throw new Error('Use the email address you requested the code for.');
    if (typeof password !== 'string' || password.length < 8) throw new Error('Choose a password with at least 8 characters.');
    if (!attempt.verified) {
      const token = String(code || '').replace(/\s/g, '');
      if (!/^\d{6,10}$/.test(token)) throw new Error('Enter the complete numeric code from your latest email.');
      const { data, error } = await attempt.client.auth.verifyOtp({ email: attempt.email, token, type: 'recovery' });
      if (recovery !== attempt) {
        await attempt.client.auth.signOut({ scope: 'local' });
        assertCurrent(attempt);
      }
      if (error) throw failure(error, 'This code is invalid or has expired. Request a new code and use the latest email.');
      if (!data?.session?.user?.id || normalizeEmail(data.session.user.email) !== attempt.email) {
        cancelRecovery();
        throw new Error('Could not verify this account. Request a new code.');
      }
      attempt.verified = true;
    }
    // A rejected password does not consume the code a second time.
    const { error } = await attempt.client.auth.updateUser({ password });
    assertCurrent(attempt);
    if (error) throw failure(error, 'The password could not be updated. Try again.');
    cancelRecovery();
  }

  window.CadraAuth = Object.freeze({ client, currentUser, signIn, signOut, onChange, requestRecovery, resetPassword, cancelRecovery });
})();
