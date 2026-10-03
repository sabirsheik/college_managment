import { request } from '../api/client.js';

function queryString(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  });
  const text = query.toString();
  return text ? `?${text}` : '';
}

export const api = {
  dashboard: () => request('/dashboard'),
  me: () => request('/auth/me'),
  login: (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  list: (resource, params) => request(`/${resource}${queryString(params)}`),
  get: (resource, id) => request(`/${resource}/${id}`),
  create: (resource, data) => request(`/${resource}`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  update: (resource, id, data) => request(`/${resource}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),
  remove: (resource, id) => request(`/${resource}/${id}`, { method: 'DELETE' }),
  resetPassword: (id, password) => request(`/users/${id}/reset-password`, {
    method: 'POST', body: JSON.stringify({ password })
  }),
  settings: () => request('/college-settings'),
  updateSettings: (data) => request('/college-settings', {
    method: 'PATCH', body: JSON.stringify(data)
  }),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => request('/notifications/read-all', { method: 'PATCH' })
};
