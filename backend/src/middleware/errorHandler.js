export function notFound(_req, res) {
  res.status(404).json({
    success: false,
    message: 'Route not found.',
    errors: []
  });
}

export function errorHandler(error, _req, res, _next) {
  if (res.headersSent) return;
  if (error.code === '23505') {
    return res.status(409).json({
      success: false,
      message: 'A record with that unique value already exists.',
      errors: []
    });
  }
  if (error.code === '23503' || error.code === '23514') {
    return res.status(409).json({
      success: false,
      message: 'The change conflicts with related records or database rules.',
      errors: []
    });
  }
  const status = Number.isInteger(error.status) ? error.status : 500;
  if (status >= 500) _req.log?.error({ err: error }, 'Request failed.');
  res.status(status).json({
    success: false,
    message: status >= 500 ? 'An unexpected server error occurred.' : error.message,
    errors: error.errors || []
  });
}
