# SEO & GEO Health Checker

A comprehensive tool for analyzing websites for both traditional Search Engine Optimization (SEO) and Generative Engine Optimization (GEO) factors.

## Features

- **SEO Analysis**: Technical SEO, content optimization, site structure, and accessibility
- **GEO Analysis**: AI readability, content credibility, and structured data for generative engines
- **Detailed Scoring**: Weighted scores with actionable recommendations
- **Multi-format Export**: PDF, CSV, and JSON export options
- **Batch Analysis**: Analyze multiple URLs from the same domain

## Technology Stack

### Backend
- Node.js with Express
- TypeScript for type safety
- Puppeteer for web scraping
- Lighthouse for performance analysis
- Cheerio for HTML parsing

### Frontend
- React with TypeScript
- Material-UI for components
- React Query for state management
- Recharts for data visualization

## 🚀 Quick Deploy

### One-Click Deployments

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/asiapacben/sitehealthcheck)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/asiapacben/sitehealthcheck)
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/asiapacben/sitehealthcheck)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/asiapacben/sitehealthcheck)

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone https://github.com/asiapacben/sitehealthcheck.git
cd sitehealthcheck
```

2. Install dependencies for all packages
```bash
npm run install:all
```

3. Set up environment variables
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your configuration
```

### Docker Deployment

```bash
# Quick start with Docker Compose
docker-compose up -d

# Or build and run individually
docker build -t seo-geo-app .
docker run -p 3001:3001 seo-geo-app
```

### Development

Start both frontend and backend in development mode:
```bash
npm run dev
```

Or start them separately:
```bash
# Backend (runs on port 3001)
npm run dev:backend

# Frontend (runs on port 3000)  
npm run dev:frontend
```

### Building for Production

```bash
npm run build
```

### Testing

Run all tests:
```bash
npm test
```

Run tests for specific package:
```bash
npm run test:backend
npm run test:frontend
```

## Project Structure

```
├── backend/                 # Node.js API server
│   ├── src/
│   │   ├── services/       # Analysis engines
│   │   ├── controllers/    # API controllers
│   │   ├── utils/          # Utilities and helpers
│   │   └── index.ts        # Server entry point
│   └── package.json
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom hooks
│   │   └── index.tsx       # App entry point
│   └── package.json
├── shared/                 # Shared TypeScript types
│   └── types/
└── package.json           # Root package.json
```

## API Endpoints

- `GET /health` - Health check
- `POST /api/analysis` - Start website analysis
- `GET /api/status/:jobId` - Check analysis status
- `POST /api/export` - Export results

## Configuration

The tool supports various configuration options:

- SEO analysis weights and thresholds
- GEO analysis parameters
- External API keys (Google PageSpeed Insights, etc.)
- Rate limiting and security settings

## Deployment

### Platform Options

| Platform | Frontend | Backend | Database | Cost |
|----------|----------|---------|----------|------|
| **Vercel** | ✅ Static | ✅ Serverless | ❌ | Free tier available |
| **Netlify + Railway** | ✅ Static | ✅ Container | ✅ PostgreSQL | Free tier available |
| **Railway** | ✅ Static | ✅ Container | ✅ PostgreSQL | $5/month |
| **Render** | ✅ Static | ✅ Container | ✅ PostgreSQL | Free tier available |
| **Docker** | ✅ Container | ✅ Container | ✅ Any | Self-hosted |

### Environment Variables

**Backend:**
```env
NODE_ENV=production
PORT=3001
GOOGLE_PAGESPEED_API_KEY=your_api_key
CORS_ORIGIN=https://your-frontend-domain.com
```

**Frontend:**
```env
REACT_APP_API_URL=https://your-backend-domain.com
```

For detailed deployment instructions, see [DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see LICENSE file for details