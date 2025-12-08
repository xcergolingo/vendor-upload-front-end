import auth0 from 'auth0-js';
import { reactive, readonly } from 'vue';

const redirectUri =
  window.location.hostname === 'localhost'
    ? 'http://localhost:5173'
    : 'https://vendor.golingoapp.com';

const auth0Client = new auth0.WebAuth({
  domain: 'login.golingoapp.com',
  clientID: 'CAbDNnKwXbemnPuMqg6R7ElN4F77IRA3',
  responseType: 'token id_token',
  redirectUri
});

const internalState = reactive({
  isAuthenticated: false,
  loading: true,
  userEmail: '',
  error: ''
});

function setSession(authResult) {
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  localStorage.setItem('idToken', authResult.idToken);
  localStorage.setItem('expiresAt', JSON.stringify(expiresAt));
  const email = authResult.idTokenPayload?.email || '';
  if (email) {
    localStorage.setItem('userEmail', email);
  }
  internalState.userEmail = email;
  internalState.isAuthenticated = true;
  internalState.loading = false;
}

function clearSession() {
  localStorage.removeItem('idToken');
  localStorage.removeItem('expiresAt');
  localStorage.removeItem('userEmail');
  internalState.isAuthenticated = false;
  internalState.userEmail = '';
  internalState.loading = false;
}

export const authState = readonly(internalState);

export function initAuth() {
  return new Promise(resolve => {
    auth0Client.parseHash((err, authResult) => {
      if (err) {
        internalState.error = err.description || err.message || 'Auth error';
      }
      if (authResult?.accessToken && authResult.idToken) {
        setSession(authResult);
        window.location.hash = '';
        resolve();
        return;
      }

      try {
        const expiresAt = JSON.parse(localStorage.getItem('expiresAt') || '0');
        const stillValid = expiresAt && Date.now() < Number(expiresAt);
        if (stillValid) {
          internalState.isAuthenticated = true;
          internalState.userEmail = localStorage.getItem('userEmail') || '';
        } else {
          clearSession();
        }
      } catch (storageErr) {
        console.error('Failed to parse stored auth state', storageErr);
        clearSession();
      } finally {
        internalState.loading = false;
        resolve();
      }
    });
  });
}

export function login(email, password) {
  internalState.error = '';
  return new Promise((resolve, reject) => {
    auth0Client.login(
      {
        realm: 'Username-Password-Authentication',
        username: email,
        password,
        scope: 'openid profile email'
      },
      (err, authResult) => {
        if (err) {
          internalState.error = err.description || err.message || 'Login failed';
          reject(err);
          return;
        }
        setSession(authResult);
        resolve(authResult);
      }
    );
  });
}

export function register(email, password) {
  internalState.error = '';
  return new Promise((resolve, reject) => {
    auth0Client.signup(
      {
        connection: 'Username-Password-Authentication',
        email,
        password
      },
      err => {
        if (err) {
          internalState.error =
            err.description || err.message || 'Registration failed';
          reject(err);
          return;
        }
        resolve(true);
      }
    );
  });
}

export function logout() {
  clearSession();
}
