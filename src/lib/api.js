const API_BASE_URL = 'http://127.0.0.1:8000';

export class ApiHttpError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiHttpError';
    this.status = status;
  }
}

function errorMessage(data, status) {
  const detail = data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        const field = Array.isArray(item?.loc) ? item.loc.at(-1) : null;
        return `${field ? `${field}: ` : ''}${item?.msg || 'Neteisinga reikšmė'}`;
      })
      .join('; ');
  }
  if (detail && typeof detail === 'object') return JSON.stringify(detail);
  return `Serverio klaida (${status})`;
}

async function request(path, { method = 'GET', token, body } = {}) {
  const headers = { Accept: 'application/json' };

  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiHttpError('Nepavyko prisijungti prie KeyVault serverio', 0);
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { detail: text };
    }
  }

  if (!response.ok) {
    throw new ApiHttpError(errorMessage(data, response.status), response.status);
  }

  return data;
}

export function getAuthParameters(email) {
  return request(`/auth/params?email=${encodeURIComponent(email)}`);
}

export function registerAccount({ email, authSecret, cryptoSalt }) {
  return request('/auth/register', {
    method: 'POST',
    body: { email, auth_secret: authSecret, crypto_salt: cryptoSalt },
  });
}

export function loginAccount({ email, authSecret }) {
  return request('/auth/login', {
    method: 'POST',
    body: { email, auth_secret: authSecret },
  });
}

export function downloadVault(token) {
  return request('/vault', { token });
}

export function uploadVault(token, { ciphertext, iv, version }) {
  return request('/vault', {
    method: 'PUT',
    token,
    body: { ciphertext, iv, version },
  });
}

export function deleteRemoteAccount(token) {
  return request('/auth/account', { method: 'DELETE', token });
}
