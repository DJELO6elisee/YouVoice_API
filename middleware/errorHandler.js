module.exports = (err, req, res, next) => {
    console.error(err.stack);
  
    // Validation errors
    if (err.name === 'SequelizeValidationError') {
      const errors = err.errors.map(e => ({
        field: e.path,
        message: e.message
      }));
      return res.status(400).json({ errors });
    }
  
    // Unique constraint errors
    if (err.name === 'SequelizeUniqueConstraintError') {
      const errors = err.errors.map(e => ({
        field: e.path,
        message: `${e.path} already exists`
      }));
      return res.status(400).json({ errors });
    }
  
    // JWT errors
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
  
    // Multer file upload errors
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    }
    if (err.message === 'File type not allowed') {
      return res.status(400).json({ error: 'Only audio files are allowed' });
    }
  
    // Default error
    res.status(500).json({ error: 'Something went wrong' });
  };