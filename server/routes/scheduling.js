// server/routes/scheduling.js
const express = require(‘express’);
const router = express.Router();
const SmartScheduler = require(’../services/SmartScheduler’);
const AppointmentBookingService = require(’../services/AppointmentBookingService’);

module.exports = (db) => {
const scheduler = new SmartScheduler(db);
const appointmentService = new AppointmentBookingService(db, scheduler);

// Schedule a new order
router.post(’/schedule/order’, async (req, res) => {
try {
const scheduledTask = await scheduler.scheduleOrder(req.body);
res.json({ success: true, task: scheduledTask });
} catch (error) {
res.status(400).json({ success: false, error: error.message });
}
});

// Get available appointment slots
router.get(’/appointments/available’, async (req, res) => {
try {
const { type, date, daysAhead } = req.query;
const slots = await appointmentService.getAvailableSlots(
type,
date,
parseInt(daysAhead) || 14
);
res.json({ success: true, slots });
} catch (error) {
res.status(400).json({ success: false, error: error.message });
}
});

// Get optimal appointment times
router.get(’/appointments/optimal’, async (req, res) => {
try {
const { type, days } = req.query;
const optimalTimes = await appointmentService.getOptimalAppointmentTimes(
type,
parseInt(days) || 7
);
res.json({ success: true, optimalTimes });
} catch (error) {
res.status(400).json({ success: false, error: error.message });
}
});

// Book an appointment
router.post(’/appointments/book’, async (req, res) => {
try {
const result = await appointmentService.bookApointment(req.body);
res.json({ success: true, …result });
} catch (error) {
res.status(400).json({ success: false, error: error.message });
}
});

// Reschedule appointment
router.put(’/appointments/:id/reschedule’, async (req, res) => {
try {
const { newDatetime, reason } = req.body;
const result = await appointmentService.rescheduleAppointment(
req.params.id,
newDatetime,
reason
);
res.json({ success: true, …result });
} catch (error) {
res.status(400).json({ success: false, error: error.message });
}
});

// Get daily workload
router.get(’/workload/daily/:date’, async (req, res) => {
try {
const workload = await appointmentService.calculateDayWorkload(
moment(req.params.date)
);
res.json({ success: true, workload });
} catch (error) {
res.status(400).json({ success: false, error: error.message });
}
});

// Get schedule analytics
router.get(’/analytics/schedule’, async (req, res) => {
try {
const { startDate, endDate } = req.query;
const analytics = await scheduler.getScheduleAnalytics(startDate, endDate);
res.json({ success: true, analytics });
} catch (error) {
res.status(400).json({ success: false, error: error.message });
}
});

// Get appointment analytics
router.get(’/analytics/appointments’, async (req, res) => {
try {
const { startDate, endDate } = req.query;
const analytics = await appointmentService.getAppointmentAnalytics(
startDate,
endDate
);
res.json({ success: true, analytics });
} catch (error) {
res.status(400).json({ success: false, error: error.message });
}
});

// Update task progress
router.put(’/schedule/task/:orderId’, async (req, res) => {
try {
const { actualHours, status } = req.body;
await scheduler.updateTaskProgress(req.params.orderId, actualHours, status);
res.json({ success: true });
} catch (error) {
res.status(400).json({ success: false, error: error.message });
}
});

// Optimize schedule
router.post(’/schedule/optimize’, async (req, res) => {
try {
await scheduler.optimizeSchedule();
res.json({ success: true, message: ‘Schedule optimized’ });
} catch (error) {
res.status(400).json({ success: false, error: error.message });
}
});

return router;
};

// server/routes/referrals.js
const express = require(‘express’);
const router = express.Router();
const ReferralRewardsService = require(’../services/ReferralRewardsService’);

module.exports = (db) => {
const referralService = new ReferralRewardsService(db);

// Generate referral code for customer
router.post(’/referral/generate’, async (req, res) => {
try {
const { customerId, customCode } = req.body;
const code = await referralService.generateReferralCode(customerId, customCode);
res.json({ success: true, code });
} catch (error) {
res.status(400).json({ success: false, error: error.message });
}
});

// Process a new referral
router.post(’/referral/process’, async (req, res) => {
try {
const { referralCode, newCustomerData } = req.body;
const result = await referralService.processReferral(referralCode, newCustomerData);
res.json({ success: true, …result });
} catch (error) {
res.status(400).json({ success: false, error: error.message });
}
});

// Complete referral (when first order is placed)
router.post(’/referral/:id/complete’, async (req, res) => {
try {
const { firstOrderId } = req.body;
const referral = await referralService.completeReferral(
req.params.id,
firstOrderId
);
res.json({ success: true, referral });
} catch (error) {
res.status(400).json({ success: false, error: error.message });
}
});

// Get customer’s referral stats
router.get(’/customer/:id/referral-stats’, async (req, res) => {
try {
const stats = await referralService.getReferrerStats(req.params.id);
res.json({ success: true, stats });
} catch (error) {
res.status(400).json({ success: false, error: error.message });
}
});

// Get customer’s rewards
router.get(’/customer/:id/rewards’, async (req, res) => {
try {
const { status } = req.query;
const rewards = await referralService.getCustomerRewards(
req.params.id,
status || ‘active’
);
res.json({ success: true, rewards });
} catch (error) {
res.status(400).json({ success: false, error: error.message });
}
});

// Apply reward to order
router.post(’/reward/apply’, async (req, res) => {
try {
const { customerId, orderId, rewardId } = req.body;
const result = await referralService.applyRewardToOrder(
customerId,
orderId,
rewardId
);
res.json({ success: true, …result });
} catch (error) {
res.status(400).json({ success: false, error: error.message });
}
});

// Get referral analytics
router.get(’/analytics/referrals’, async (req, res) => {
try {
const { startDate, endDate } = req.query;
const analytics = await referralService.getReferralAnalytics(
startDate,
endDate
);
res.json({ success: true, analytics });
} catch (error) {
res.status(400).json({ success: false, error: error.message });
}
});

// Expire old rewards (cron job endpoint)
router.post(’/rewards/expire’, async (req, res) => {
try {
const expiredCount = await referralService.expireOldRewards();
res.json({ success: true, expiredCount });
} catch (error) {
res.status(400).json({ success: false, error: error.message });
}
});

return router;
};

// server/routes/recommendations.js
const express = require(‘express’);
const router = express.Router();
const CustomerBehaviorService = require(’../services/CustomerBehaviorService’);

module.exports = (db) => {
const behaviorService = new CustomerBehaviorService(db);

// Get customer behavior analysis
router.get(’/customer/:id/behavior’, async (req, res) => {
try {
const profile = await behaviorService.analyzeCustomerBehavior(req.params.id);
res.json({ success: true, profile });
} catch (error) {
res.status(400).json({ success: false, error: error.message });
}
});

// Get personalized recommendations
router.get(’/customer/:id/recommendations’, async (req, res) => {
try {
const context = req.query; // artworkType, size, etc.
const recommendations = await behaviorService.generateRecommendations(
req.params.id,
context
);
res.json({ success: true, recommendations });
} catch (error) {
res.status(400).json({ success: false, error: error.message });
}
});

// Get behavior insights
router.get(’/customer/:id/insights’, async (req, res) => {
try {
const insights = await behaviorService.getBehaviorInsights(req.params.id);
res.json({ success: true, …insights });
} catch (error) {
res.status(400).json({ success: false, error: error.message });
}
});

// Get customer segments
router.get(’/segments’, async (req, res) => {
try {
const segments = await db(‘customer_behavior_profiles’)
.select(‘customerId’, ‘segments’, ‘lastUpdated’)
.orderBy(‘lastUpdated’, ‘desc’)
.limit(100);

```
  res.json({ success: true, segments });
} catch (error) {
  res.status(400).json({ success: false, error: error.message });
}
```

});

// Track customer inquiry
router.post(’/inquiry’, async (req, res) => {
try {
const { customerId, type, message } = req.body;

```
  const inquiry = {
    id: require('uuid').v4(),
    customerId,
    type,
    message,
    status: 'open',
    createdAt: new Date().toISOString()
  };
  
  await db('customer_inquiries').insert(inquiry);
  res.json({ success: true, inquiry });
} catch (error) {
  res.status(400).json({ success: false, error: error.message });
}
```

});

// Update inquiry status (when responded/converted)
router.put(’/inquiry/:id/status’, async (req, res) => {
try {
const { status, orderId } = req.body;
const updates = { status };

```
  if (status === 'responded') {
    updates.respondedAt = new Date().toISOString();
  } else if (status === 'converted' && orderId) {
    updates.convertedAt = new Date().toISOString();
    updates.convertedOrderId = orderId;
  }
  
  await db('customer_inquiries')
    .where('id', req.params.id)
    .update(updates);
  
  res.json({ success: true });
} catch (error) {
  res.status(400).json({ success: false, error: error.message });
}
```

});

return router;
};

// server/index.js - Main server file
const express = require(‘express’);
const cors = require(‘cors’);
const helmet = require(‘helmet’);
const compression = require(‘compression’);
const morgan = require(‘morgan’);
const rateLimit = require(‘express-rate-limit’);
require(‘dotenv’).config();

const knex = require(‘knex’)({
client: ‘mysql2’,
connection: {
host: process.env.DB_HOST,
user: process.env.DB_USER,
password: process.env.DB_PASSWORD,
database: process.env.DB_NAME
}
});

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: ‘10mb’ }));
app.use(express.urlencoded({ extended: true, limit: ‘10mb’ }));
app.use(morgan(‘combined’));

// Rate limiting
const limiter = rateLimit({
windowMs: 15 * 60 * 1000, // 15 minutes
max: 100 // limit each IP to 100 requests per windowMs
});
app.use(’/api/’, limiter);

// Routes
app.use(’/api/scheduling’, require(’./routes/scheduling’)(knex));
app.use(’/api/referrals’, require(’./routes/referrals’)(knex));
app.use(’/api/recommendations’, require(’./routes/recommendations’)(knex));

// Health check
app.get(’/health’, (req, res) => {
res.json({ status: ‘ok’, timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
console.error(err.stack);
res.status(500).json({
success: false,
error: ‘Internal server error’
});
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
console.log(`Jay's Frames API Server running on port ${PORT}`);
});
