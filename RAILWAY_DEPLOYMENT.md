# Railway Deployment Guide

This guide will help you deploy the Jay's Frames API to Railway.

## Prerequisites

- Railway account (sign up at https://railway.app)
- GitHub account with this repository
- MySQL database (can be provisioned on Railway)

## Quick Deploy

### Option 1: Deploy from GitHub (Recommended)

1. **Login to Railway**
   - Go to https://railway.app
   - Click "Login" and authenticate with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose this repository: `joshuatxtcllc/ar_frame_previewer-`
   - Railway will automatically detect the configuration

3. **Add MySQL Database**
   - In your project, click "New"
   - Select "Database" → "Add MySQL"
   - Railway will automatically provision a MySQL database
   - The environment variables will be automatically set

4. **Configure Environment Variables**

   Railway auto-sets these database variables:
   - `MYSQLHOST`
   - `MYSQLPORT`
   - `MYSQLDATABASE`
   - `MYSQLUSER`
   - `MYSQLPASSWORD`

   You need to manually add these optional variables:

   ```bash
   NODE_ENV=production
   PORT=3000  # Railway will override this with its own PORT

   # Optional: Business Settings
   BUSINESS_TIMEZONE=America/Chicago
   WORKING_HOURS_START=08:00
   WORKING_HOURS_END=17:00
   MAX_DAILY_HOURS=8

   # Optional: JWT (if using authentication)
   JWT_SECRET=your_secure_random_string_here

   # Optional: Email Notifications
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your_email@gmail.com
   SMTP_PASSWORD=your_app_password

   # Optional: SMS (Twilio)
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_PHONE_NUMBER=+15551234567

   # Optional: Discord
   DISCORD_WEBHOOK_URL=your_webhook_url

   # Optional: AWS S3
   AWS_ACCESS_KEY_ID=your_access_key
   AWS_SECRET_ACCESS_KEY=your_secret_key
   AWS_S3_BUCKET=your_bucket_name
   AWS_REGION=us-east-1
   ```

5. **Deploy**
   - Railway will automatically build and deploy
   - Watch the build logs for any errors
   - Once deployed, you'll get a URL like: `https://your-app.railway.app`

6. **Run Database Migrations**

   After first deployment:
   - Go to your project in Railway
   - Click on your service
   - Go to "Settings" → "Deploy"
   - Add a "One-off Command": `npm run migrate`
   - Or use Railway CLI (see below)

### Option 2: Deploy with Railway CLI

1. **Install Railway CLI**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login**
   ```bash
   railway login
   ```

3. **Initialize Project**
   ```bash
   railway init
   ```

4. **Link to Existing Project (optional)**
   ```bash
   railway link
   ```

5. **Add MySQL Database**
   ```bash
   railway add --database mysql
   ```

6. **Set Environment Variables**
   ```bash
   # Business settings
   railway variables set BUSINESS_TIMEZONE=America/Chicago
   railway variables set WORKING_HOURS_START=08:00
   railway variables set WORKING_HOURS_END=17:00
   railway variables set MAX_DAILY_HOURS=8

   # JWT (if needed)
   railway variables set JWT_SECRET=$(openssl rand -base64 32)

   # Add other variables as needed
   ```

7. **Run Migrations**
   ```bash
   railway run npm run migrate
   ```

8. **Deploy**
   ```bash
   railway up
   ```

9. **Open in Browser**
   ```bash
   railway open
   ```

## Configuration Files

This project includes the following Railway-specific files:

### `railway.json`
Main Railway configuration:
- Build: Uses Nixpacks builder with `npm ci`
- Deploy: Runs `npm start`
- Health Check: `/health` endpoint
- Auto-restart on failure (max 10 retries)

### `nixpacks.toml`
Build configuration:
- Node.js 20.x
- Uses `npm ci` for faster, reliable installs
- No build step (API only)

### `.railwayignore`
Excludes from deployment:
- `.git` directory
- `node_modules`
- `.env` file
- Log files
- `.DS_Store`

### `Procfile`
Fallback start command:
```
web: npm start
```

## Database Setup

The server automatically connects to Railway's MySQL using these environment variables:

```javascript
MYSQLHOST      → DB_HOST
MYSQLUSER      → DB_USER
MYSQLPASSWORD  → DB_PASSWORD
MYSQLDATABASE  → DB_NAME
MYSQLPORT      → DB_PORT
```

### Running Migrations

**Via Railway CLI:**
```bash
railway run npm run migrate
```

**Via Railway Dashboard:**
1. Go to your service
2. Click "Settings"
3. Scroll to "Custom Start Command"
4. Temporarily set to: `npm run migrate && npm start`
5. Deploy
6. Revert to: `npm start`

**Via Manual Connection:**
```bash
# Get database credentials from Railway dashboard
mysql -h [MYSQLHOST] -u [MYSQLUSER] -p[MYSQLPASSWORD] [MYSQLDATABASE]

# Then run migration SQL manually
```

## Health Monitoring

### Health Check Endpoint

```bash
curl https://your-app.railway.app/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-01-18T12:00:00.000Z",
  "uptime": 3600,
  "environment": "production",
  "database": "connected"
}
```

### Monitoring Best Practices

1. **Set up Railway Monitoring**
   - Railway provides built-in metrics
   - CPU, Memory, Network usage tracked automatically

2. **Configure Alerts**
   - Set up alerts for high CPU/memory usage
   - Monitor database connection errors in logs

3. **Log Monitoring**
   - View logs in Railway dashboard
   - Look for database connection issues
   - Monitor API errors

## Environment Variables Reference

### Required (Auto-set by Railway MySQL)
- `MYSQLHOST` - Database host
- `MYSQLPORT` - Database port (usually 3306)
- `MYSQLDATABASE` - Database name
- `MYSQLUSER` - Database user
- `MYSQLPASSWORD` - Database password

### Optional but Recommended
- `NODE_ENV` - Set to `production`
- `BUSINESS_TIMEZONE` - Your business timezone (default: America/Chicago)
- `WORKING_HOURS_START` - Business hours start (default: 08:00)
- `WORKING_HOURS_END` - Business hours end (default: 17:00)
- `MAX_DAILY_HOURS` - Max hours per day (default: 8)

### Optional Integrations
- `JWT_SECRET` - For authentication
- `SMTP_*` - For email notifications
- `TWILIO_*` - For SMS notifications
- `DISCORD_WEBHOOK_URL` - For Discord alerts
- `AWS_*` - For S3 image storage

## Troubleshooting

### Build Fails

**Issue:** `npm ci` fails
```bash
# Solution: Check package-lock.json is committed
git add package-lock.json
git commit -m "Add package-lock.json"
git push
```

**Issue:** Node version mismatch
```bash
# Solution: Check nixpacks.toml uses correct Node version
# Current: nodejs-20_x
```

### Database Connection Fails

**Issue:** "Database connection failed"

1. Check database is provisioned:
   ```bash
   railway variables
   ```

2. Verify MySQL service is running:
   - Check Railway dashboard
   - Look for MySQL service status

3. Check environment variables are set:
   - `MYSQLHOST`, `MYSQLUSER`, `MYSQLPASSWORD`, etc.

4. Test connection manually:
   ```bash
   railway run node -e "const knex = require('knex')({client:'mysql2',connection:{host:process.env.MYSQLHOST,user:process.env.MYSQLUSER,password:process.env.MYSQLPASSWORD,database:process.env.MYSQLDATABASE}});knex.raw('SELECT 1').then(()=>console.log('OK')).catch(console.error)"
   ```

### Migrations Not Running

**Issue:** Tables don't exist

```bash
# Run migrations manually
railway run npm run migrate

# Or connect and run SQL directly
railway connect mysql
# Then paste migration SQL
```

### App Crashes on Startup

1. **Check logs:**
   ```bash
   railway logs
   ```

2. **Common issues:**
   - Missing environment variables
   - Database not accessible
   - Port conflicts (Railway sets PORT automatically)

3. **Verify health check:**
   ```bash
   curl https://your-app.railway.app/health
   ```

### Static Files Not Serving

**Issue:** AR Preview page (index.html) not loading

The server serves static files from `public/` directory:
```javascript
app.use(express.static('public'));
```

Verify:
1. `public/index.html` exists
2. Access root URL: `https://your-app.railway.app/`
3. Check logs for static file errors

## Deployment Checklist

- [ ] Railway account created
- [ ] GitHub repository connected
- [ ] MySQL database provisioned
- [ ] Required environment variables set
- [ ] Application deployed successfully
- [ ] Database migrations run
- [ ] Health check endpoint responding
- [ ] API endpoints accessible
- [ ] Static files (AR Preview) loading
- [ ] Database connections working
- [ ] Logs showing no errors

## Custom Domain (Optional)

1. Go to your Railway project
2. Click "Settings"
3. Scroll to "Domains"
4. Click "Add Custom Domain"
5. Enter your domain: `api.jaysframes.com`
6. Add DNS records as instructed by Railway
7. Wait for DNS propagation

## Continuous Deployment

Railway automatically deploys when you push to your connected branch:

```bash
git add .
git commit -m "Update feature"
git push origin main
```

Railway will:
1. Detect the push
2. Build using nixpacks
3. Run health checks
4. Deploy new version
5. Zero-downtime rollout

## Rollback

If deployment fails:

1. **Via Dashboard:**
   - Go to Deployments
   - Click on previous successful deployment
   - Click "Redeploy"

2. **Via Git:**
   ```bash
   git revert HEAD
   git push origin main
   ```

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- This Project Issues: https://github.com/joshuatxtcllc/ar_frame_previewer-/issues

## Cost Estimation

Railway Pricing (as of 2026):
- Free tier: $5 of usage/month
- Pro: $20/month + usage

Estimated usage for this app:
- Small traffic: ~$5-10/month (fits in free tier)
- Medium traffic: ~$20-30/month
- MySQL database: ~$5-10/month

**Total estimated cost: $5-40/month depending on traffic**

## Security Best Practices

1. **Never commit `.env` file**
   - Already in `.gitignore`
   - Use Railway variables instead

2. **Use strong JWT secret**
   ```bash
   railway variables set JWT_SECRET=$(openssl rand -base64 32)
   ```

3. **Enable Railway's security features**
   - Enable 2FA on Railway account
   - Use private networking for database

4. **Regular updates**
   ```bash
   npm audit
   npm audit fix
   ```

5. **Monitor logs for suspicious activity**

---

**Ready to deploy!** Follow the steps above and your app will be live on Railway in minutes.
