// server/index.js - Main server file
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

console.log('=== Jay\'s Frames API Starting ===');
console.log('Node version:', process.version);
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Port:', process.env.PORT || 3000);

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline scripts for the AR preview
}));
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined'));

// Serve static files from public directory
app.use(express.static('public'));

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
    port: parseInt(process.env.DB_PORT || process.env.MYSQLPORT || '3306')
  },
  pool: { min: 0, max: 7 }
};

console.log('Database configuration:', {
  host: dbConfig.connection.host,
  user: dbConfig.connection.user,
  database: dbConfig.connection.database,
  port: dbConfig.connection.port,
  hasPassword: !!dbConfig.connection.password
});

let knex;
let dbConnected = false;

try {
  knex = require('knex')(dbConfig);
  console.log('✓ Knex initialized');

  // Test database connection (non-blocking)
  knex.raw('SELECT 1')
    .then(() => {
      console.log('✓ Database connected successfully');
      dbConnected = true;

      // Try to mount routes after successful database connection
      try {
        app.use('/api/scheduling', require('./routes/scheduling')(knex));
        console.log('✓ Scheduling routes mounted');
      } catch (error) {
        console.error('✗ Failed to mount scheduling routes:', error.message);
      }
    })
    .catch(err => {
      console.error('✗ Database connection failed:', err.message);
      console.error('  Connection details:', {
        host: dbConfig.connection.host,
        user: dbConfig.connection.user,
        database: dbConfig.connection.database
      });
      console.log('  Server will continue running without database routes');
    });
} catch (error) {
  console.error('✗ Failed to initialize database:', error.message);
  console.log('  Server will continue running without database');
}

// Health check - always responds
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: 'unknown'
  };

  // Check database connectivity if knex is available
  if (knex) {
    try {
      await knex.raw('SELECT 1');
      health.database = 'connected';
    } catch (error) {
      health.database = 'disconnected';
      health.databaseError = error.message;
    }
  } else {
    health.database = 'not initialized';
  }

  res.json(health);
});

// API info route (moved to /api to allow static files at root)
app.get('/api', (req, res) => {
  res.json({
    message: "Jay's Frames API Server",
    version: '1.0.0',
    status: 'running',
    database: dbConnected ? 'connected' : 'disconnected',
    endpoints: {
      health: '/health',
      api: '/api/scheduling'
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    availableEndpoints: ['/', '/health', '/api/scheduling']
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

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('✓ Server started successfully');
  console.log(`✓ Listening on port ${PORT}`);
  console.log(`✓ Health check: http://localhost:${PORT}/health`);
  console.log('=== Server Ready ===');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    if (knex) {
      knex.destroy().then(() => {
        console.log('Database connections closed');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  console.error('Stack:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
