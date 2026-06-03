// shared fetch wrapper — injects JWT and auto-logs out on 401 (expired/invalid token)
export const authFetch = async (url, options = {}) => {
  const token = localStorage.getItem('bm_token');
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });
  if (res.status === 401) {
    localStorage.removeItem('bm_token');
    window.location.href = '/login';
  }
  return res;
};
