const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const authService = {
  async login(email: string, password: string) {
    const resp = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!resp.ok) throw new Error('Login failed');
    const data = await resp.json();
    localStorage.setItem('token', data.access_token);
  },
  logout() {
    localStorage.removeItem('token');
  },
  getToken() {
    return localStorage.getItem('token');
  },
};
