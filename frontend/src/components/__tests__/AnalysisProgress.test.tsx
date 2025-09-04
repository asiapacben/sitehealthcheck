import React from 'react';
import { render, screen } from '@testing-library/react';
import { AnalysisProgress } from '../AnalysisProgress';
import { AnalysisStatus } from '../../../../shared/types';

describe('AnalysisProgress Component', () => {
  const mockOnComplete = jest.fn();

  beforeEach(() => {
    mockOnComplete.mockClear();
  });

  it('renders progress information', () => {
    const status: AnalysisStatus = {
      jobId: 'test-job',
      status: 'running',
      progress: 50,
      completedUrls: 2,
      totalUrls: 4
    };

    render(<AnalysisProgress status={status} onComplete={mockOnComplete} />);
    
    expect(screen.getByText(/analysis progress/i)).toBeInTheDocument();
    expect(screen.getByText(/progress: 2 of 4 urls/i)).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('RUNNING')).toBeInTheDocument();
  });

  it('shows pending status', () => {
    const status: AnalysisStatus = {
      jobId: 'test-job',
      status: 'pending',
      progress: 0,
      completedUrls: 0,
      totalUrls: 3
    };

    render(<AnalysisProgress status={status} onComplete={mockOnComplete} />);
    
    expect(screen.getByText('PENDING')).toBeInTheDocument();
    expect(screen.getByText(/analysis queued and will start shortly/i)).toBeInTheDocument();
  });

  it('shows running status with current processing info', () => {
    const status: AnalysisStatus = {
      jobId: 'test-job',
      status: 'running',
      progress: 33,
      completedUrls: 1,
      totalUrls: 3
    };

    render(<AnalysisProgress status={status} onComplete={mockOnComplete} />);
    
    expect(screen.getByText('RUNNING')).toBeInTheDocument();
    expect(screen.getByText(/analyzing urls/i)).toBeInTheDocument();
    expect(screen.getByText(/processing 2 of 3/i)).toBeInTheDocument();
  });

  it('shows completed status', () => {
    const status: AnalysisStatus = {
      jobId: 'test-job',
      status: 'completed',
      progress: 100,
      completedUrls: 3,
      totalUrls: 3,
      results: []
    };

    render(<AnalysisProgress status={status} onComplete={mockOnComplete} />);
    
    expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    expect(screen.getByText(/analysis complete!/i)).toBeInTheDocument();
    expect(screen.getByText(/successfully analyzed 3 urls/i)).toBeInTheDocument();
  });

  it('shows error status', () => {
    const status: AnalysisStatus = {
      jobId: 'test-job',
      status: 'failed',
      progress: 25,
      completedUrls: 1,
      totalUrls: 4,
      error: 'Network timeout occurred'
    };

    render(<AnalysisProgress status={status} onComplete={mockOnComplete} />);
    
    expect(screen.getByText('FAILED')).toBeInTheDocument();
    expect(screen.getByText(/analysis failed/i)).toBeInTheDocument();
    expect(screen.getByText('Network timeout occurred')).toBeInTheDocument();
  });

  it('calls onComplete when analysis is finished', () => {
    const results = [{ url: 'https://example.com', overallScore: 85 }];
    const status: AnalysisStatus = {
      jobId: 'test-job',
      status: 'completed',
      progress: 100,
      completedUrls: 1,
      totalUrls: 1,
      results
    };

    render(<AnalysisProgress status={status} onComplete={mockOnComplete} />);
    
    expect(mockOnComplete).toHaveBeenCalledWith(results);
  });

  it('displays correct progress bar value', () => {
    const status: AnalysisStatus = {
      jobId: 'test-job',
      status: 'running',
      progress: 75,
      completedUrls: 3,
      totalUrls: 4
    };

    render(<AnalysisProgress status={status} onComplete={mockOnComplete} />);
    
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '75');
  });
});