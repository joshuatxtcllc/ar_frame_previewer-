// server/index.js - Main server file
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Database configuration - supports both Railway and custom env vars
const dbConfig = {
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
    user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'railway',
    port: process.env.DB_PORT || process.env.MYSQLPORT || 3306
  },
  pool: { min: 0, max: 7 }
};

console.log('Database configuration:', {
  host: dbConfig.connection.host,
  user: dbConfig.connection.user,
  database: dbConfig.connection.database,
  port: dbConfig.connection.port
});

const knex = require('knex')(dbConfig);

// Test database connection
knex.raw('SELECT 1')
  .then(() => {
    console.log('✓ Database connected successfully');

    // Mount routes after successful database connection
    app.use('/api/scheduling', require('./routes/scheduling')(knex));
    console.log('✓ Routes mounted');
  })
  .catch(err => {
    console.error('✗ Database connection failed:', err.message);
    console.error('  Connection details:', {
      host: dbConfig.connection.host,
      user: dbConfig.connection.user,
      database: dbConfig.connection.database
    });
    console.log('  Server will continue running but API routes may not work');

    // Mount routes anyway but they will fail with database errors
    app.use('/api/scheduling', require('./routes/scheduling')(knex));
  });

// Health check - always responds even if database is down
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  };

  // Check database connectivity
  try {
    await knex.raw('SELECT 1');
    health.database = 'connected';
  } catch (error) {
    health.database = 'disconnected';
    health.databaseError = error.message;
  }

  res.json(health);
});

app.get('/', (req, res) => {
  res.json({
    message: "Jay's Frames API Server",
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      api: '/api/scheduling'
    }
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Jay's Frames API Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
