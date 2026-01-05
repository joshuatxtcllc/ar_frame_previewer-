# Jay’s Frames - Enterprise Business Automation Platform

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D16.0.0-green.svg)
![License](https://img.shields.io/badge/license-MIT-orange.svg)

> **Transform your custom framing business with AI-powered automation and intelligent scheduling**

A comprehensive, production-ready business automation platform built specifically for Jay’s Frames, featuring smart scheduling, workload management, customer intelligence, referral tracking, and AR frame preview capabilities.

-----

## 🌟 Key Features

### 🗓️ Smart Calendar & Production Scheduling

- **Intelligent Workload Management**: Automatically schedules orders based on complexity, deadline, and current capacity
- **Complex Project Blocking**: Reserves dedicated time blocks for intricate custom work
- **Auto-Optimization**: Continuously analyzes and reorganizes schedule for maximum efficiency
- **Conflict Prevention**: Real-time detection and resolution of scheduling conflicts
- **8-Hour Workload Grouping**: Automatically groups orders into manageable daily batches

### 📅 Workload-Aware Appointment Booking

- **Capacity Analysis**: Checks daily workload before offering appointment slots
- **Smart Recommendations**: Prioritizes lighter days for better customer service
- **Visual Indicators**: Shows customers workload levels (🟢 Light, 🔵 Normal, 🟠 Busy, 🔴 Very Busy)
- **Multi-Type Support**: Consultations, pickups, deliveries, frame fittings
- **Automated Reminders**: Email, SMS, and Discord notifications

### 🎁 Customer Referral & Rewards System

- **Automated Referral Codes**: Unique codes generated for each customer (e.g., JF8A9C2D)
- **Tiered Rewards Program**:
  - 🥉 Bronze (1+ referrals): 5% discount
  - 🥈 Silver (3+ referrals): 10% discount + priority scheduling
  - 🥇 Gold (5+ referrals): 15% discount + priority + free consultation
  - 💎 Platinum (10+ referrals): 20% discount + VIP perks
- **Milestone Bonuses**: Special rewards at 3, 5, 10, 25 successful referrals
- **Automatic Tracking**: Referrals complete when first order is placed

### 🧠 Customer Behavior Intelligence

- **Purchase Prediction**: Predicts next purchase date with probability score
- **Personalized Recommendations**: AI-driven frame suggestions based on:
  - Previous style preferences
  - Color choices
  - Price range history
  - Artwork type patterns
- **Customer Segmentation**: Automatic classification (Premium, Frequent, At-Risk, etc.)
- **Lifetime Value Calculation**: Predicts long-term customer value

### 🔍 AR Frame Preview

- **Virtual Try-On**: See how framed artwork looks on your wall
- **Real-Time Manipulation**: Drag, resize, rotate frames in preview
- **Multiple Frame Styles**: Try different frames instantly
- **Camera or Upload**: Use device camera or upload wall photos
- **Save & Share**: Export previews for customer records

-----

## 🚀 Quick Start

### Prerequisites

- Node.js >= 16.0.0
- MySQL >= 8.0
- npm >= 8.0.0

### Installation

```bash
# Clone the repository
git clone ttps://github.com/yourusername/jays-frames.git](https://github.com/joshuatxtcllc/ar_frame_previewer-.git
cd ar_frame_previewer

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
npm run migrate

# Start the server
npm start
```

The API will be available at `http://localhost:3000`

-----

## 📦 Project Structure

```
jays-frames/
├── server/
│   ├── services/
│   │   ├── SmartScheduler.js              # Production scheduling engine
│   │   ├── AppointmentBookingService.js   # Appointment management
│   │   ├── ReferralRewardsService.js      # Referral tracking system
│   │   └── CustomerBehaviorService.js     # AI recommendation engine
│   ├── routes/
│   │   ├── scheduling.js                   # Scheduling API endpoints
│   │   ├── referrals.js                    # Referral API endpoints
│   │   └── recommendations.js              # Recommendation API endpoints
│   └── index.js                            # Express server setup
├── migrations/
│   ├── 001_create_scheduling_tables.js
│   ├── 002_create_referral_tables.js
│   └── 003_create_behavior_tables.js
├── client/
│   └── components/
│       └── ARFramePreview.jsx              # AR preview React component
├── tests/
│   ├── scheduler.test.js
│   ├── appointments.test.js
│   ├── referrals.test.js
│   └── recommendations.test.js
├── .env.example
├── package.json
├── railway.json                            # Railway deployment config
├── Dockerfile                              # Docker configuration
└── README.md
```

-----

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Database Configuration
DB_HOST=your_database_host
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_NAME=jays_frames
DB_PORT=3306

# Server Configuration
PORT=3000
NODE_ENV=production

# Security
JWT_SECRET=your_super_secret_jwt_key_change_this

# Email Notifications (Gmail example)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_specific_password

# SMS Notifications (Twilio)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+15551234567

# Discord Notifications
DISCORD_WEBHOOK_URL=your_discord_webhook_url

# AWS S3 (for image storage)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_S3_BUCKET=jays-frames-images
AWS_REGION=us-east-1

# Business Settings
BUSINESS_TIMEZONE=America/Chicago
WORKING_HOURS_START=08:00
WORKING_HOURS_END=17:00
MAX_DAILY_HOURS=8
```

### Scheduler Configuration

```javascript
{
  timezone: 'America/Chicago',
  workingHours: { start: '08:00', end: '17:00' },
  workingDays: [1, 2, 3, 4, 5], // Monday-Friday
  maxDailyHours: 8,
  bufferTime: 30 // minutes between tasks
}
```

-----

## 📡 API Reference

### Base URL

```
Production: https://your-app.railway.app/api
Development: http://localhost:3000/api
```

### Authentication

All requests require JWT token in header:

```javascript
headers: {
  'Authorization': 'Bearer YOUR_JWT_TOKEN',
  'Content-Type': 'application/json'
}
```

### Key Endpoints

#### Scheduling

```http
POST   /api/scheduling/schedule/order          # Schedule new order
GET    /api/scheduling/appointments/available  # Get available slots
POST   /api/scheduling/appointments/book       # Book appointment
PUT    /api/scheduling/appointments/:id        # Reschedule appointment
GET    /api/scheduling/analytics/schedule      # Schedule analytics
```

#### Referrals

```http
POST   /api/referrals/referral/generate        # Generate referral code
POST   /api/referrals/referral/process         # Process new referral
GET    /api/referrals/customer/:id/rewards     # Get customer rewards
POST   /api/referrals/reward/apply             # Apply reward to order
GET    /api/referrals/analytics/referrals      # Referral analytics
```

#### Recommendations

```http
GET    /api/recommendations/customer/:id/behavior        # Customer analysis
GET    /api/recommendations/customer/:id/recommendations # Get recommendations
GET    /api/recommendations/customer/:id/insights        # Behavior insights
POST   /api/recommendations/inquiry                      # Track inquiry
```

**Full API documentation**: See [API.md](docs/API.md)

-----

## 🎯 Usage Examples

### Schedule an Order

```javascript
const response = await fetch('/api/scheduling/schedule/order', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    orderId: 'ORD-12345',
    complexity: 'complex',
    estimatedHours: 6,
    priority: 1,
    deadline: '2025-11-15T17:00:00Z',
    customMolding: true,
    oversized: true
  })
});

const { task } = await response.json();
console.log(`Scheduled for: ${task.startTime}`);
```

### Get Personalized Recommendations

```javascript
const response = await fetch(
  '/api/recommendations/customer/CUST-123/recommendations?artworkType=painting&size=24x36',
  {
    headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
  }
);

const { recommendations } = await response.json();

recommendations.forEach(rec => {
  console.log(`${rec.frameName}: ${rec.score} points`);
  console.log(`Why: ${rec.reasons.join(', ')}`);
});
```

### Process a Referral

```javascript
const response = await fetch('/api/referrals/referral/process', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    referralCode: 'JF8A9C2D',
    newCustomerData: {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com',
      phone: '555-0123'
    }
  })
});

const { referralId, rewards } = await response.json();
```

-----

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm test -- scheduler.test.js

# Watch mode for development
npm run test:watch
```

### Test Coverage Goals

- Unit Tests: > 80%
- Integration Tests: > 70%
- E2E Tests: Critical paths covered

-----

## 🚀 Deployment

### Deploy to Railway

1. **Connect your GitHub repository** to Railway
1. **Set environment variables** in Railway dashboard
1. **Deploy automatically** on git push

Or use Railway CLI:

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Add environment variables
railway variables set DB_HOST=your_host
railway variables set DB_USER=your_user
# ... set all required variables

# Deploy
railway up
```

### Deploy with Docker

```bash
# Build image
docker build -t jays-frames .

# Run container
docker run -p 3000:3000 --env-file .env jays-frames
```

### Deploy with PM2

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start server/index.js --name jays-frames

# Save PM2 configuration
pm2 save

# Setup startup script
pm2 startup
```

-----

## 📊 Monitoring & Analytics

### Health Check

```bash
curl https://your-app.railway.app/health
```

### Key Metrics Tracked

- ✅ Schedule efficiency and utilization
- ✅ Appointment booking conversion rates
- ✅ Referral program performance
- ✅ Customer prediction accuracy
- ✅ API response times
- ✅ Error rates and types

### Logging

All logs are written to:

- Console (development)
- File: `logs/application.log` (production)
- External service: Configurable (e.g., Datadog, LogDNA)

-----

## 🔒 Security

- ✅ **JWT Authentication**: All API endpoints protected
- ✅ **Helmet.js**: Security headers configured
- ✅ **Rate Limiting**: 100 requests per 15 minutes per IP
- ✅ **Input Validation**: Express-validator on all inputs
- ✅ **SQL Injection Protection**: Knex.js parameterized queries
- ✅ **CORS**: Configurable allowed origins
- ✅ **Environment Variables**: Sensitive data never committed

-----

## 🐛 Troubleshooting

### Common Issues

**Database Connection Failed**

```bash
# Check database credentials
echo $DB_HOST $DB_USER $DB_NAME

# Test connection
mysql -h $DB_HOST -u $DB_USER -p $DB_NAME
```

**Port Already in Use**

```bash
# Change PORT in .env file or
export PORT=3001
npm start
```

**Migration Errors**

```bash
# Rollback migrations
npm run migrate:rollback

# Re-run migrations
npm run migrate
```

**Schedule Conflicts Not Resolving**

- Check `bufferTime` configuration
- Verify `maxDailyHours` setting
- Review workload calculations in logs

-----

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
1. Create a feature branch (`git checkout -b feature/AmazingFeature`)
1. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
1. Push to the branch (`git push origin feature/AmazingFeature`)
1. Open a Pull Request

### Coding Standards

- ESLint configuration provided
- Follow existing code style
- Add tests for new features
- Update documentation as needed

-----

## 📝 Changelog

### v1.0.0 (2026-01-03)

- ✅ Initial release
- ✅ Smart scheduling system
- ✅ Workload-aware appointment booking
- ✅ Customer referral and rewards program
- ✅ AI-powered customer behavior analysis
- ✅ AR frame preview component
- ✅ Complete API with documentation
- ✅ Railway deployment support

-----

## 📄 License

This project is licensed under the MIT License - see the <LICENSE> file for details.

-----

## 👨‍💼 Author

**Jay’s Frames**

- Website: [jaysframes.com](https://jaysframes.com)
- Location: Houston, TX
- Email: contact@jaysframes.com

-----

## 🙏 Acknowledgments

- Built with Node.js, Express, and React
- TensorFlow.js for ML predictions
- Knex.js for database management
- Moment.js for timezone handling
- Tailwind CSS for UI components

-----

## 📞 Support

For support, email support@jaysframes.com or open an issue on GitHub.

-----

## 🎯 Roadmap

- [ ] Mobile app (React Native)
- [ ] Advanced analytics dashboard
- [ ] Multi-location support
- [ ] Inventory management integration
- [ ] Automated marketing campaigns
- [ ] Customer portal with order tracking
- [ ] Integration with popular frame suppliers
- [ ] Machine learning model improvements
- [ ] WhatsApp notification support
- [ ] Multi-language support

-----

## 💡 Business Model Potential

This platform is designed to be:

- **White-label ready** for other custom framing businesses
- **Scalable** to custom manufacturing industries (cabinets, signs, furniture)
- **Enterprise-ready** with proper documentation and support

**Estimated Market Value:**

- SaaS: $200-500/month per business
- Custom Implementation: $10,000-50,000 per client
- Total Addressable Market: 10,000+ custom framing shops in the US

-----

**Built with ❤️ in Houston, Texas**

-----

## ⭐ Star History

If you find this project useful, please consider giving it a star!

[![Star History Chart](https://api.star-history.com/svg?repos=yourusername/jays-frames&type=Date)](https://star-history.com/#yourusername/jays-frames&Date)
