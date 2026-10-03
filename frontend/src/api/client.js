const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1').replace(/\/$/, '');

export async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers
      }
    });
  } catch (cause) {
    const error = new Error('Unable to reach the API. Check that the backend is running.');
    error.cause = cause;
    throw error;
  }

  if (response.status === 204) return null;
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error('The API returned an invalid response.');
  }
  if (!response.ok) {
    const error = new Error(payload.message || payload.error || `Request failed (${response.status}).`);
    error.status = response.status;
    error.errors = payload.errors || [];
    throw error;
  }
  return payload;
}
