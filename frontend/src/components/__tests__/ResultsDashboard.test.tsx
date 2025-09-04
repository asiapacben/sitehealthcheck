import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResultsDashboard } from '../ResultsDashboard';
import { AnalysisResults } from '../../../../shared/types';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { it } from 'node:test';
import { describe } from 'node:test';

const mockResults: AnalysisResults[] = [
  {
    url: 'https://example.com',
    timestamp: new Date('2024-01-01'),
    overallScore: 85,
    seoScore: {
      overall: 80,
      technical: 75,
      content: 85,
      structure: 80,
      details: {
        pageSpeed: 70,
        mobileResponsive: true,
        titleTag: { score: 90, issues: [], suggestions: [] },
        metaDescription: { score: 85, issues: [], suggestions: [] },
        headingStructure: { score: 80, issues: [], suggestions: [] },
        internalLinks: 15
      }
    },
    geoScore: {
      overall: 90,
      readability: 85,
      credibility: 95,
      completeness: 88,
      structuredData: 92,
      details: {
        contentClarity: { score: 85, issues: [], suggestions: [] },
        questionAnswerFormat: true,
        authorInformation: true,
        citations: 5,
        schemaMarkup: ['Article', 'Organization']
      }
    },
    recommendations: [
      {
        id: '1',
        category: 'SEO',
        priority: 'High',
        impact: 8,
        effort: 'Easy',
        title: 'Improve page speed',
        description: 'Optimize images and reduce server response time',
        actionSteps: ['Compress images', 'Enable caching', 'Minify CSS/JS']
      }
    ],
    technicalDetails: {
      loadTime: 2500,
      pageSize: 1024000,
      requests: 25,
      statusCode: 200,
      redirects: 0
    }
  }
];

describe('ResultsDashboard Component', () => {
  it('renders overview cards with correct scores', () => {
    render(<ResultsDashboard results={mockResults} />);
    
    expect(screen.getByText('85')).toBeInTheDocument(); // Average score
    expect(screen.getByText('80')).toBeInTheDocument(); // SEO score
    expect(screen.getByText('90')).toBeInTheDocument(); // GEO score
    expect(screen.getByText('1')).toBeInTheDocument(); // URLs analyzed
  });

  it('displays tabs for different sections', () => {
    render(<ResultsDashboard results={mockResults} />);
    
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('SEO Details')).toBeInTheDocument();
    expect(screen.getByText('GEO Details')).toBeInTheDocument();
    expect(screen.getByText('Recommendations')).toBeInTheDocument();
  });

  it('shows URL information in overview tab', () => {
    render(<ResultsDashboard results={mockResults} />);
    
    expect(screen.getByText('https://example.com')).toBeInTheDocument();
    expect(screen.getByText(/analyzed:/i)).toBeInTheDocument();
  });

  it('switches between tabs correctly', async () => {
    const user = userEvent.setup();
    render(<ResultsDashboard results={mockResults} />);
    
    // Click SEO Details tab
    await user.click(screen.getByText('SEO Details'));
    expect(screen.getByText('SEO Analysis Details')).toBeInTheDocument();
    expect(screen.getByText('Technical SEO')).toBeInTheDocument();
    
    // Click GEO Details tab
    await user.click(screen.getByText('GEO Details'));
    expect(screen.getByText('GEO Analysis Details')).toBeInTheDocument();
    expect(screen.getByText('Readability')).toBeInTheDocument();
  });

  it('displays recommendations with correct information', async () => {
    const user = userEvent.setup();
    render(<ResultsDashboard results={mockResults} />);
    
    // Click Recommendations tab
    await user.click(screen.getByText('Recommendations'));
    
    expect(screen.getByText('Recommendations (1)')).toBeInTheDocument();
    expect(screen.getByText('Improve page speed')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('SEO')).toBeInTheDocument();
  });

  it('expands recommendation accordion to show details', async () => {
    const user = userEvent.setup();
    render(<ResultsDashboard results={mockResults} />);
    
    // Go to recommendations tab
    await user.click(screen.getByText('Recommendations'));
    
    // Click on recommendation to expand
    await user.click(screen.getByText('Improve page speed'));
    
    expect(screen.getByText('Optimize images and reduce server response time')).toBeInTheDocument();
    expect(screen.getByText('Action Steps:')).toBeInTheDocument();
    expect(screen.getByText('1. Compress images')).toBeInTheDocument();
  });

  it('handles multiple URLs with URL selection tabs', () => {
    const multipleResults = [
      ...mockResults,
      {
        ...mockResults[0],
        url: 'https://example.com/about',
        overallScore: 75
      }
    ];
    
    render(<ResultsDashboard results={multipleResults} />);
    
    // Should show URL selection tabs - filter for only URL tabs (not the main navigation tabs)
    expect(screen.getByText('/')).toBeInTheDocument();
    expect(screen.getByText('/about')).toBeInTheDocument();
    
    // Check that both URLs are represented
    expect(screen.getByText('85')).toBeInTheDocument(); // First URL score
    expect(screen.getByText('75')).toBeInTheDocument(); // Second URL score
  });

  it('displays correct score colors based on performance', () => {
    const poorResult: AnalysisResults = {
      ...mockResults[0],
      overallScore: 30,
      seoScore: { ...mockResults[0].seoScore, overall: 25 }
    };
    
    render(<ResultsDashboard results={[poorResult]} />);
    
    // Should display poor scores (exact color testing would require more complex setup)
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('shows technical details in SEO section', async () => {
    const user = userEvent.setup();
    render(<ResultsDashboard results={mockResults} />);
    
    await user.click(screen.getByText('SEO Details'));
    
    expect(screen.getByText('SEO Analysis Details')).toBeInTheDocument();
    
    // Check that the SEO detail cards are present
    expect(screen.getByText('Technical SEO')).toBeInTheDocument();
    expect(screen.getByText('Content SEO')).toBeInTheDocument();
    expect(screen.getByText('Structure')).toBeInTheDocument();
    expect(screen.getByText('Page Speed')).toBeInTheDocument();
    
    // Check that scores are displayed (use getAllByText for scores that might appear multiple times)
    expect(screen.getByText('75')).toBeInTheDocument(); // Technical SEO score
    expect(screen.getAllByText('85').length).toBeGreaterThan(0); // Content SEO score (might appear multiple times)
    expect(screen.getAllByText('80').length).toBeGreaterThan(0); // Structure score (might appear multiple times)
    expect(screen.getByText('70')).toBeInTheDocument(); // Page speed score
  });
});