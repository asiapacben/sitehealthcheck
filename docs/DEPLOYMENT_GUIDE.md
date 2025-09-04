# Deployment Guide

## Overview

This guide covers multiple deployment options for the SEO & GEO Health Checker application using GitHub as the source repository.

## Quick Deploy Options

### 1. 🚀 Vercel (Recommended - Full Stack)

**One-Click Deploy:**
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/asiapacben/sitehealthcheck)

**Manual Setup:**
1. Connect your GitHub repository to Vercel
2. Configure environment variables:
   ```
   NODE_ENV=production
   GOOGLE_PAGESPEED_API_KEY=your_api_key
   ```
3. Deploy automatically on push to main branch

**Features:**
- ✅ Automatic deployments from GitHub
- ✅ Serverless functions for backend
- ✅ Global CDN for frontend
- ✅ Built-in SSL certificates
- ✅ Preview deployments for PRs

### 2. 🌐 Netlify (Frontend) + Railway (Backend)

**Frontend on Netlify:**
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/asiapacben/sitehealthcheck)

1. Connect GitHub repository
2. Set build settings:
   - Build command: `cd frontend && npm run build`
   - Publish directory: `frontend/build`
3. Configure environment variables:
   ```
   REACT_APP_API_URL=https://your-backend.railway.app
   ```

**Backend on Railway:**
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/asiapacben/sitehealthcheck)

1. Connect GitHub repository
2. Select backend service
3. Configure environment variables
4. Deploy automatically

### 3. 🚂 Railway (Full Stack)

**One-Click Deploy:**
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/asiapacben/sitehealthcheck)

**Manual Setup:**
1. Create new project from GitHub repo
2. Add services for frontend and backend
3. Configure environment variables
4. Set up custom domains

### 4. 🎨 Render (Full Stack)

**One-Click Deploy:**
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/asiapacben/sitehealthcheck)

**Manual Setup:**
1. Connect GitHub repository
2. Create web services for frontend and backend
3. Configure build and start commands
4. Set environment variables

### 5. 🐳 Docker Deployment

**Using Docker Compose:**
```bash
git clone https://github.com/asiapacben/sitehealthcheck.git
cd sitehealthcheck
docker-compose up -d
```

**Individual Containers:**
```bash
# Build and run backend
docker build -t seo-geo-backend .
docker run -p 3001:3001 seo-geo-backend

# Build and run frontend
docker build -f Dockerfile.frontend -t seo-geo-frontend .
docker run -p 3000:80 seo-geo-frontend
```

## Environment Variables

### Backend Environment Variables

```env
# Required
NODE_ENV=production
PORT=3001

# API Keys (Optional but recommended)
GOOGLE_PAGESPEED_API_KEY=your_google_api_key
SCHEMA_VALIDATOR_API_KEY=your_schema_api_key

# Database (if using external database)
DATABASE_URL=your_database_url

# Redis (for caching)
REDIS_URL=your_redis_url

# Security
JWT_SECRET=your_jwt_secret
CORS_ORIGIN=https://your-frontend-domain.com
```

### Frontend Environment Variables

```env
# API Configuration
REACT_APP_API_URL=https://your-backend-domain.com

# Optional: Analytics
REACT_APP_GA_TRACKING_ID=your_google_analytics_id
```

## Platform-Specific Setup

### Vercel Setup

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Deploy:**
   ```bash
   vercel --prod
   ```

3. **Configure Environment Variables:**
   - Go to Vercel Dashboard → Project → Settings → Environment Variables
   - Add all required environment variables

### Netlify Setup

1. **Install Netlify CLI:**
   ```bash
   npm install -g netlify-cli
   ```

2. **Deploy:**
   ```bash
   netlify deploy --prod --dir=frontend/build
   ```

3. **Configure:**
   - Set build command: `cd frontend && npm run build`
   - Set publish directory: `frontend/build`

### Railway Setup

1. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Deploy:**
   ```bash
   railway login
   railway link
   railway up
   ```

3. **Configure Services:**
   - Backend: Node.js service with start command `cd backend && npm start`
   - Frontend: Static site with build command `cd frontend && npm run build`

### Render Setup

1. **Create Web Service:**
   - Runtime: Node.js
   - Build Command: `cd backend && npm install && npm run build`
   - Start Command: `cd backend && npm start`

2. **Create Static Site:**
   - Build Command: `cd frontend && npm install && npm run build`
   - Publish Directory: `frontend/build`

## CI/CD Pipeline

The repository includes GitHub Actions workflows for automated testing and deployment:

### Workflow Features:
- ✅ Automated testing on pull requests
- ✅ E2E test execution
- ✅ Multi-platform deployment
- ✅ Environment-specific configurations

### Setup GitHub Secrets:

For Vercel:
```
VERCEL_TOKEN=your_vercel_token
ORG_ID=your_vercel_org_id
PROJECT_ID=your_vercel_project_id
```

For Netlify:
```
NETLIFY_AUTH_TOKEN=your_netlify_token
NETLIFY_SITE_ID=your_site_id
```

For Railway:
```
RAILWAY_TOKEN=your_railway_token
```

## Performance Optimization

### Frontend Optimizations:
- Code splitting with React.lazy()
- Image optimization and lazy loading
- Service worker for caching
- Bundle analysis and optimization

### Backend Optimizations:
- Response caching with Redis
- Database query optimization
- API rate limiting
- Compression middleware

### CDN Configuration:
- Static asset caching
- Global content distribution
- Image optimization
- Gzip compression

## Monitoring and Logging

### Recommended Tools:
- **Error Tracking:** Sentry
- **Performance:** New Relic or DataDog
- **Uptime Monitoring:** Pingdom or UptimeRobot
- **Analytics:** Google Analytics

### Setup Example (Sentry):
```javascript
// Add to frontend
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: process.env.REACT_APP_SENTRY_DSN,
});

// Add to backend
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
});
```

## Security Considerations

### SSL/TLS:
- All platforms provide automatic SSL certificates
- Ensure HTTPS redirects are configured

### Environment Variables:
- Never commit sensitive data to repository
- Use platform-specific secret management
- Rotate API keys regularly

### CORS Configuration:
```javascript
// Backend CORS setup
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
```

## Scaling Considerations

### Horizontal Scaling:
- Use load balancers for multiple backend instances
- Implement session storage with Redis
- Database connection pooling

### Vertical Scaling:
- Monitor resource usage
- Optimize memory and CPU usage
- Use caching strategies

### Database Scaling:
- Read replicas for heavy read workloads
- Database indexing optimization
- Query performance monitoring

## Troubleshooting

### Common Issues:

1. **Build Failures:**
   - Check Node.js version compatibility
   - Verify all dependencies are installed
   - Review build logs for specific errors

2. **Environment Variables:**
   - Ensure all required variables are set
   - Check variable naming (REACT_APP_ prefix for frontend)
   - Verify variable values are correct

3. **CORS Issues:**
   - Configure backend CORS settings
   - Check frontend API URL configuration
   - Verify domain whitelist

4. **Performance Issues:**
   - Enable caching
   - Optimize database queries
   - Use CDN for static assets

### Debug Commands:

```bash
# Check build locally
npm run build:all

# Test production build
npm run start:backend
npm run start:frontend

# Run health checks
curl http://localhost:3001/health
```

## Cost Optimization

### Free Tier Limits:
- **Vercel:** 100GB bandwidth, 6000 build minutes
- **Netlify:** 100GB bandwidth, 300 build minutes
- **Railway:** $5 credit monthly
- **Render:** 750 hours free tier

### Cost-Effective Strategies:
- Use static site hosting for frontend
- Implement efficient caching
- Optimize image sizes and formats
- Monitor usage and set alerts

## Support and Maintenance

### Regular Tasks:
- Update dependencies monthly
- Monitor security vulnerabilities
- Review performance metrics
- Backup configuration and data

### Update Process:
1. Test updates in staging environment
2. Run full test suite
3. Deploy to production
4. Monitor for issues
5. Rollback if necessary

For additional support, refer to the platform-specific documentation or create an issue in the GitHub repository.