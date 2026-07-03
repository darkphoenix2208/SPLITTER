// Helper to get token from memory/local state
// Since we need to access this globally or pass it around,
// a simple approach is to export a setter and getter.

let token = null;

export const setToken = (newToken) => {
  token = newToken;
};

export const getToken = () => {
  return token;
};

export const apiFetch = async (url, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error((errorData && errorData.error) || 'An error occurred');
  }

  return response.json();
};
