const { AppError } = require('../utils/errors');

const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    console.error({
      message: err.message,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method
    });

    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message
    });
  }

  // Unknown errors - don't leak details
  console.error({
    message: err.message,
    stack: err.stack,
    path: req.path
  });

  res.status(500).json({
    status: 'error',
    message: 'Internal server error'
  });
};

module.exports = { errorHandler };
