// shared fetch wrapper — injects JWT auth header on every request
export const authFetch = (url, options = {}) => {
  const token = localStorage.getItem('bm_token');
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });
};
