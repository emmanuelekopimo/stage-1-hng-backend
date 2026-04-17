const express = require('express');
const cors = require('cors');
const profilesRouter = require('./routes/profiles');

const app = express();

// CORS - allow all origins (required for grading script)
app.use(cors({ origin: '*' }));

app.use(express.json());

// Routes
app.use('/api/profiles', profilesRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ status: 'error', message: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  const statusCode = err.status || 500;
  res.status(statusCode).json({ status: 'error', message: err.message });
});

module.exports = app;
