import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportInterface } from '../ExportInterface';
import { AnalysisResults, ExportRequest } from '../../../../shared/types';

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
    recommendations: [],
    technicalDetails: {
      loadTime: 2500,
      pageSize: 1024000,
      requests: 25,
      statusCode: 200,
      redirects: 0
    }
  }
];

describe('ExportInterface Component', () => {
  const mockOnExport = jest.fn();

  beforeEach(() => {
    mockOnExport.mockClear();
  });

  it('renders export format options', () => {
    render(<ExportInterface results={mockResults} onExport={mockOnExport} />);
    
    expect(screen.getByText('Export Results')).toBeInTheDocument();
    expect(screen.getByText('PDF Report')).toBeInTheDocument();
    expect(screen.getByText('CSV Data')).toBeInTheDocument();
    expect(screen.getByText('JSON Export')).toBeInTheDocument();
  });

  it('allows selecting different export formats', async () => {
    const user = userEvent.setup();
    render(<ExportInterface results={mockResults} onExport={mockOnExport} />);
    
    // Select CSV format
    await user.click(screen.getByLabelText(/csv data/i));
    
    const exportButton = screen.getByRole('button', { name: /export as csv data/i });
    expect(exportButton).toBeInTheDocument();
  });

  it('shows export options', () => {
    render(<ExportInterface results={mockResults} onExport={mockOnExport} />);
    
    expect(screen.getByText('Export Options')).toBeInTheDocument();
    expect(screen.getByLabelText(/include detailed technical information/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/custom notes/i)).toBeInTheDocument();
  });

  it('allows toggling detailed information option', async () => {
    const user = userEvent.setup();
    render(<ExportInterface results={mockResults} onExport={mockOnExport} />);
    
    const detailsToggle = screen.getByLabelText(/include detailed technical information/i);
    expect(detailsToggle).toBeChecked();
    
    await user.click(detailsToggle);
    expect(detailsToggle).not.toBeChecked();
  });

  it('allows adding custom notes', async () => {
    const user = userEvent.setup();
    render(<ExportInterface results={mockResults} onExport={mockOnExport} />);
    
    const notesField = screen.getByLabelText(/custom notes/i);
    await user.type(notesField, 'This is a test note');
    
    expect(notesField).toHaveValue('This is a test note');
  });

  it('shows branding options for PDF format', async () => {
    const user = userEvent.setup();
    render(<ExportInterface results={mockResults} onExport={mockOnExport} />);
    
    // PDF should be selected by default
    const brandingAccordion = screen.getByText('Branding Options (Optional)');
    await user.click(brandingAccordion);
    
    expect(screen.getByLabelText(/company name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/primary color/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/secondary color/i)).toBeInTheDocument();
  });

  it('hides branding options for non-PDF formats', async () => {
    const user = userEvent.setup();
    render(<ExportInterface results={mockResults} onExport={mockOnExport} />);
    
    // Select CSV format
    await user.click(screen.getByLabelText(/csv data/i));
    
    expect(screen.queryByText('Branding Options (Optional)')).not.toBeInTheDocument();
  });

  it('displays export summary', () => {
    render(<ExportInterface results={mockResults} onExport={mockOnExport} />);
    
    expect(screen.getByText('Export Summary')).toBeInTheDocument();
    expect(screen.getByText(/format: pdf report/i)).toBeInTheDocument();
    expect(screen.getByText(/urls: 1 analyzed pages/i)).toBeInTheDocument();
    expect(screen.getByText(/details: included/i)).toBeInTheDocument();
  });

  it('calls onExport with correct parameters', async () => {
    const user = userEvent.setup();
    render(<ExportInterface results={mockResults} onExport={mockOnExport} />);
    
    const exportButton = screen.getByRole('button', { name: /export as pdf report/i });
    await user.click(exportButton);
    
    expect(mockOnExport).toHaveBeenCalledWith({
      format: 'pdf',
      results: mockResults,
      includeDetails: true,
      customNotes: undefined,
      branding: undefined
    });
  });

  it('includes custom notes in export request', async () => {
    const user = userEvent.setup();
    render(<ExportInterface results={mockResults} onExport={mockOnExport} />);
    
    const notesField = screen.getByLabelText(/custom notes/i);
    await user.type(notesField, 'Test notes');
    
    const exportButton = screen.getByRole('button', { name: /export as pdf report/i });
    await user.click(exportButton);
    
    expect(mockOnExport).toHaveBeenCalledWith(
      expect.objectContaining({
        customNotes: 'Test notes'
      })
    );
  });

  it('includes branding information when provided', async () => {
    const user = userEvent.setup();
    render(<ExportInterface results={mockResults} onExport={mockOnExport} />);
    
    // Open branding options
    const brandingAccordion = screen.getByText('Branding Options (Optional)');
    await user.click(brandingAccordion);
    
    // Add company name
    const companyField = screen.getByLabelText(/company name/i);
    await user.type(companyField, 'Test Company');
    
    const exportButton = screen.getByRole('button', { name: /export as pdf report/i });
    await user.click(exportButton);
    
    expect(mockOnExport).toHaveBeenCalledWith(
      expect.objectContaining({
        branding: expect.objectContaining({
          companyName: 'Test Company'
        })
      })
    );
  });

  it('disables export button when loading', () => {
    render(<ExportInterface results={mockResults} onExport={mockOnExport} loading={true} />);
    
    const exportButton = screen.getByRole('button', { name: /generating export/i });
    expect(exportButton).toBeDisabled();
  });

  it('shows error message when export fails', () => {
    render(<ExportInterface results={mockResults} onExport={mockOnExport} error="Export failed" />);
    
    expect(screen.getByText('Export failed')).toBeInTheDocument();
  });

  it('disables export button when no results', () => {
    render(<ExportInterface results={[]} onExport={mockOnExport} />);
    
    const exportButton = screen.getByRole('button', { name: /export as pdf report/i });
    expect(exportButton).toBeDisabled();
  });
});