/**
 * Integration tests for frontend-backend communication
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import App from '../../App';
import { mockAnalysisResults } from '../../../backend/src/__tests__/e2e/test-data';

// Mock server for API responses
const server = setupServer(
  // URL validation endpoint
  rest.post('/api/validation/urls', (req, res, ctx) => {
    return res(
      ctx.json({
        valid: true,
        normalizedUrls: ['https://example.com/', 'https://example.com/about'],
        errors: []
      })
    );
  }),

  // Analysis start endpoint
  rest.post('/api/analysis/start', (req, res, ctx) => {
    return res(
      ctx.json({
        analysisId: 'test-analysis-123',
        status: 'started',
        message: 'Analysis started successfully'
      })
    );
  }),

  // Analysis status endpoint
  rest.get('/api/analysis/status/:id', (req, res, ctx) => {
    const { id } = req.params;
    return res(
      ctx.json({
        analysisId: id,
        status: 'completed',
        progress: 100,
        completedUrls: 2,
        totalUrls: 2
      })
    );
  }),

  // Analysis results endpoint
  rest.get('/api/analysis/results/:id', (req, res, ctx) => {
    const { id } = req.params;
    return res(
      ctx.json({
        analysisId: id,
        status: 'completed',
        results: [
          mockAnalysisResults['https://example-perfect-seo.com/'],
          {
            ...mockAnalysisResults['https://example-perfect-seo.com/'],
            url: 'https://example.com/about',
            overallScore: 88
          }
        ]
      })
    );
  }),

  // Export endpoints
  rest.post('/api/export/pdf', (req, res, ctx) => {
    return res(
      ctx.set('Content-Type', 'application/pdf'),
      ctx.body(new ArrayBuffer(1024)) // Mock PDF data
    );
  }),

  rest.post('/api/export/csv', (req, res, ctx) => {
    return res(
      ctx.set('Content-Type', 'text/csv'),
      ctx.text('URL,Overall Score,SEO Score,GEO Score\nhttps://example.com/,95,98,92')
    );
  }),

  rest.post('/api/export/json', (req, res, ctx) => {
    return res(
      ctx.json({
        results: [mockAnalysisResults['https://example-perfect-seo.com/']]
      })
    );
  }),

  // Configuration endpoints
  rest.get('/api/config/analysis', (req, res, ctx) => {
    return res(
      ctx.json({
        seoWeights: { technical: 0.4, content: 0.4, structure: 0.2 },
        geoWeights: { readability: 0.3, credibility: 0.3, completeness: 0.2, structuredData: 0.2 },
        thresholds: { pageSpeedMin: 70, contentLengthMin: 200, headingLevels: 3 }
      })
    );
  }),

  rest.put('/api/config/analysis', (req, res, ctx) => {
    return res(
      ctx.json({ message: 'Configuration updated successfully' })
    );
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Frontend-Backend Integration Tests', () => {
  describe('URL Input and Validation Flow', () => {
    it('should validate URLs and show feedback', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Find URL input
      const urlInput = screen.getByPlaceholderText(/enter urls/i);
      const submitButton = screen.getByRole('button', { name: /analyze/i });

      // Enter URLs
      await user.type(urlInput, 'https://example.com/\nhttps://example.com/about');
      await user.click(submitButton);

      // Should show validation success
      await waitFor(() => {
        expect(screen.getByText(/urls validated successfully/i)).toBeInTheDocument();
      });
    });

    it('should handle validation errors', async () => {
      server.use(
        rest.post('/api/validation/urls', (req, res, ctx) => {
          return res(
            ctx.status(400),
            ctx.json({
              error: 'URLs must belong to the same domain',
              details: ['Mixed domains detected']
            })
          );
        })
      );

      const user = userEvent.setup();
      render(<App />);

      const urlInput = screen.getByPlaceholderText(/enter urls/i);
      const submitButton = screen.getByRole('button', { name: /analyze/i });

      await user.type(urlInput, 'https://example.com/\nhttps://different.com/');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/urls must belong to the same domain/i)).toBeInTheDocument();
      });
    });
  });

  describe('Analysis Progress Flow', () => {
    it('should show analysis progress and completion', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Start analysis
      const urlInput = screen.getByPlaceholderText(/enter urls/i);
      const submitButton = screen.getByRole('button', { name: /analyze/i });

      await user.type(urlInput, 'https://example.com/');
      await user.click(submitButton);

      // Should show progress
      await waitFor(() => {
        expect(screen.getByText(/analysis started/i)).toBeInTheDocument();
      });

      // Should eventually show completion
      await waitFor(() => {
        expect(screen.getByText(/analysis completed/i)).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('should handle analysis errors gracefully', async () => {
      server.use(
        rest.post('/api/analysis/start', (req, res, ctx) => {
          return res(
            ctx.status(500),
            ctx.json({
              error: 'Analysis service temporarily unavailable'
            })
          );
        })
      );

      const user = userEvent.setup();
      render(<App />);

      const urlInput = screen.getByPlaceholderText(/enter urls/i);
      const submitButton = screen.getByRole('button', { name: /analyze/i });

      await user.type(urlInput, 'https://example.com/');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/analysis service temporarily unavailable/i)).toBeInTheDocument();
      });
    });
  });

  describe('Results Display Flow', () => {
    it('should display analysis results correctly', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Complete analysis flow
      const urlInput = screen.getByPlaceholderText(/enter urls/i);
      const submitButton = screen.getByRole('button', { name: /analyze/i });

      await user.type(urlInput, 'https://example.com/');
      await user.click(submitButton);

      // Wait for results
      await waitFor(() => {
        expect(screen.getByText(/overall score/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      // Check score display
      expect(screen.getByText('95')).toBeInTheDocument(); // Overall score
      expect(screen.getByText('98')).toBeInTheDocument(); // SEO score
      expect(screen.getByText('92')).toBeInTheDocument(); // GEO score

      // Check recommendations
      expect(screen.getByText(/recommendations/i)).toBeInTheDocument();
    });

    it('should handle multiple URL results', async () => {
      const user = userEvent.setup();
      render(<App />);

      const urlInput = screen.getByPlaceholderText(/enter urls/i);
      const submitButton = screen.getByRole('button', { name: /analyze/i });

      await user.type(urlInput, 'https://example.com/\nhttps://example.com/about');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getAllByText(/overall score/i)).toHaveLength(2);
      }, { timeout: 5000 });

      // Should show results for both URLs
      expect(screen.getByText('https://example-perfect-seo.com/')).toBeInTheDocument();
      expect(screen.getByText('https://example.com/about')).toBeInTheDocument();
    });
  });

  describe('Export Functionality Flow', () => {
    it('should export results in PDF format', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Complete analysis first
      const urlInput = screen.getByPlaceholderText(/enter urls/i);
      const submitButton = screen.getByRole('button', { name: /analyze/i });

      await user.type(urlInput, 'https://example.com/');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/overall score/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      // Find and click export button
      const exportButton = screen.getByRole('button', { name: /export pdf/i });
      await user.click(exportButton);

      // Should trigger download
      await waitFor(() => {
        expect(screen.getByText(/download started/i)).toBeInTheDocument();
      });
    });

    it('should export results in CSV format', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Complete analysis first
      const urlInput = screen.getByPlaceholderText(/enter urls/i);
      const submitButton = screen.getByRole('button', { name: /analyze/i });

      await user.type(urlInput, 'https://example.com/');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/overall score/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      // Find and click CSV export
      const csvButton = screen.getByRole('button', { name: /export csv/i });
      await user.click(csvButton);

      await waitFor(() => {
        expect(screen.getByText(/download started/i)).toBeInTheDocument();
      });
    });

    it('should handle export errors', async () => {
      server.use(
        rest.post('/api/export/pdf', (req, res, ctx) => {
          return res(
            ctx.status(500),
            ctx.json({ error: 'Export service unavailable' })
          );
        })
      );

      const user = userEvent.setup();
      render(<App />);

      // Complete analysis first
      const urlInput = screen.getByPlaceholderText(/enter urls/i);
      const submitButton = screen.getByRole('button', { name: /analyze/i });

      await user.type(urlInput, 'https://example.com/');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/overall score/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      const exportButton = screen.getByRole('button', { name: /export pdf/i });
      await user.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText(/export service unavailable/i)).toBeInTheDocument();
      });
    });
  });

  describe('Configuration Management Flow', () => {
    it('should load and display current configuration', async () => {
      render(<App />);

      // Navigate to settings
      const settingsButton = screen.getByRole('button', { name: /settings/i });
      fireEvent.click(settingsButton);

      await waitFor(() => {
        expect(screen.getByText(/analysis configuration/i)).toBeInTheDocument();
      });

      // Should show current weights
      expect(screen.getByDisplayValue('0.4')).toBeInTheDocument(); // Technical weight
    });

    it('should update configuration', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Navigate to settings
      const settingsButton = screen.getByRole('button', { name: /settings/i });
      await user.click(settingsButton);

      await waitFor(() => {
        expect(screen.getByText(/analysis configuration/i)).toBeInTheDocument();
      });

      // Update a weight value
      const technicalWeight = screen.getByLabelText(/technical weight/i);
      await user.clear(technicalWeight);
      await user.type(technicalWeight, '0.5');

      // Save configuration
      const saveButton = screen.getByRole('button', { name: /save configuration/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/configuration updated successfully/i)).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Updates Flow', () => {
    it('should show real-time progress updates', async () => {
      // Mock progressive status updates
      let callCount = 0;
      server.use(
        rest.get('/api/analysis/status/:id', (req, res, ctx) => {
          callCount++;
          const progress = Math.min(callCount * 25, 100);
          const status = progress === 100 ? 'completed' : 'in_progress';
          
          return res(
            ctx.json({
              analysisId: req.params.id,
              status,
              progress,
              completedUrls: Math.floor(progress / 50),
              totalUrls: 2
            })
          );
        })
      );

      const user = userEvent.setup();
      render(<App />);

      const urlInput = screen.getByPlaceholderText(/enter urls/i);
      const submitButton = screen.getByRole('button', { name: /analyze/i });

      await user.type(urlInput, 'https://example.com/\nhttps://example.com/about');
      await user.click(submitButton);

      // Should show progressive updates
      await waitFor(() => {
        expect(screen.getByText(/25%/)).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText(/50%/)).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText(/100%/)).toBeInTheDocument();
      });
    });
  });
});