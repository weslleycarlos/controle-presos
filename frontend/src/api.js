import axios from 'axios';

const AUTH_TOKEN_KEY = 'auth_token';

const defaultApiBaseURL =
  typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : 'http://127.0.0.1:8000';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || defaultApiBaseURL,
  withCredentials: true,
});

export function setAuthToken(token) {
  if (token) {
    sessionStorage.setItem(AUTH_TOKEN_KEY, token);
  }
}

export function clearAuthToken() {
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
}

export function getAuthToken() {
  return sessionStorage.getItem(AUTH_TOKEN_KEY);
}

function getCookieValue(name) {
  const cookie = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.split('=')[1]) : null;
}

api.interceptors.request.use((config) => {
  const bearerToken = getAuthToken();
  if (bearerToken) {
    config.headers = config.headers || {};
    if (!config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${bearerToken}`;
    }
  }

  const method = (config.method || 'get').toLowerCase();
  if (["post", "put", "patch", "delete"].includes(method)) {
    const csrfToken = getCookieValue('csrf_token');
    if (csrfToken) {
      config.headers = config.headers || {};
      config.headers['X-CSRF-Token'] = csrfToken;
    }
  }
  return config;
});

// O backend renova a sessão enquanto há atividade e devolve o token novo
// neste cabeçalho. Guardá-lo mantém o usuário logado sem novo login.
const REFRESHED_TOKEN_HEADER = 'x-refreshed-token';

api.interceptors.response.use(
  (response) => {
    const tokenRenovado = response.headers?.[REFRESHED_TOKEN_HEADER];
    if (tokenRenovado) {
      setAuthToken(tokenRenovado);
    }
    return response;
  },
  (error) => {
    // Sessão expirada ou encerrada (ex.: senha trocada): limpa o estado local
    // e leva de volta ao login, em vez de deixar a tela quebrada.
    const status = error?.response?.status;
    const url = error?.config?.url || '';
    const jaEstaNoLogin = window.location.pathname === '/login';

    // Estas chamadas fazem parte da verificação inicial de sessão: um 401 nelas
    // é o caso normal de "ainda não logado" e quem trata é o AuthContext.
    const ehRotaDeAutenticacao = ['/api/token', '/api/users/me', '/api/csrf-token']
      .some((rota) => url.includes(rota));

    if (status === 401 && !jaEstaNoLogin && !ehRotaDeAutenticacao) {
      clearAuthToken();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
