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

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd seo-geo-health-checker
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

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see LICENSE file for details