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
  markAllNotificationsRead: () => request('/notifications/read-all', { method: 'PATCH' }),
  attendanceRoster: (params) => request(`/attendance/roster${queryString(params)}`),
  markAttendance: (data) => request('/attendance/sessions', { method: 'POST', body: JSON.stringify(data) }),
  examRoster: (id) => request(`/exams/${id}/roster`),
  saveExamResults: (id, data) => request(`/exams/${id}/results`, { method: 'PUT', body: JSON.stringify(data) }),
  publishExam: (id) => request(`/exams/${id}/publish`, { method: 'POST' }),
  gpa: (studentId = 'me', params = {}) => request(`/gpa/${studentId}${queryString(params)}`),
  reports: (type, params = {}) => request(`/reports/${type}${queryString(params)}`),
  createFeeStructure: (data) => request('/fees/structures', { method: 'POST', body: JSON.stringify(data) }),
  createGradeScale: (data) => request('/grades/scale', { method: 'POST', body: JSON.stringify(data) }),
  importCsv: (entity, csv) => request(`/imports/${entity}`, {
    method: 'POST', body: csv, headers: { 'Content-Type': 'text/csv' }
  }),
  exportCsv: async (report, params = {}) => {
    let response;
    try {
      response = await fetch(`${baseUrl}/exports/${report}${queryString(params)}`, { credentials: 'include' });
    } catch (cause) {
      const error = new Error('Unable to reach the API. Check that the backend is running.');
      error.cause = cause;
      throw error;
    }
    if (!response.ok) {
      let payload;
      try { payload = await response.json(); } catch { payload = null; }
      throw new Error(payload?.message || `Export failed (${response.status}).`);
    }
    return response.blob();
  }
};
