import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { URLInput } from '../URLInput';
import { ValidationResult } from '../../../../shared/types';

describe('URLInput Component', () => {
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  it('renders URL input form', () => {
    render(<URLInput onSubmit={mockOnSubmit} />);
    
    expect(screen.getByLabelText(/website url/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start analysis/i })).toBeInTheDocument();
  });

  it('allows adding URLs', async () => {
    const user = userEvent.setup();
    render(<URLInput onSubmit={mockOnSubmit} />);
    
    const input = screen.getByLabelText(/website url/i);
    const addButton = screen.getByTestId('add-url-button');
    
    await user.type(input, 'https://example.com');
    await user.click(addButton);
    
    expect(screen.getByText('https://example.com')).toBeInTheDocument();
    expect(screen.getByText(/urls to analyze \(1\)/i)).toBeInTheDocument();
  });

  it('allows removing URLs', async () => {
    const user = userEvent.setup();
    render(<URLInput onSubmit={mockOnSubmit} />);
    
    const input = screen.getByLabelText(/website url/i);
    const addButton = screen.getByTestId('add-url-button');
    
    // Add URL
    await user.type(input, 'https://example.com');
    await user.click(addButton);
    
    // Remove URL
    const deleteButton = screen.getByTestId('delete-url-button');
    await user.click(deleteButton);
    
    expect(screen.queryByText('https://example.com')).not.toBeInTheDocument();
  });

  it('submits URLs when form is submitted', async () => {
    const user = userEvent.setup();
    render(<URLInput onSubmit={mockOnSubmit} />);
    
    const input = screen.getByLabelText(/website url/i);
    const addButton = screen.getByTestId('add-url-button');
    const submitButton = screen.getByRole('button', { name: /start analysis/i });
    
    await user.type(input, 'https://example.com');
    await user.click(addButton);
    await user.click(submitButton);
    
    expect(mockOnSubmit).toHaveBeenCalledWith(['https://example.com']);
  });

  it('adds URL on Enter key press', async () => {
    const user = userEvent.setup();
    render(<URLInput onSubmit={mockOnSubmit} />);
    
    const input = screen.getByLabelText(/website url/i);
    
    await user.type(input, 'https://example.com');
    await user.keyboard('{Enter}');
    
    expect(screen.getByText('https://example.com')).toBeInTheDocument();
  });

  it('displays validation errors', () => {
    const validationResult: ValidationResult = {
      valid: false,
      normalizedUrls: [],
      errors: [
        { url: 'invalid-url', message: 'Invalid URL format', code: 'INVALID_FORMAT' }
      ]
    };
    
    render(<URLInput onSubmit={mockOnSubmit} validationResult={validationResult} />);
    
    expect(screen.getByText(/validation errors/i)).toBeInTheDocument();
    expect(screen.getByText(/invalid url format/i)).toBeInTheDocument();
  });

  it('disables form when loading', () => {
    render(<URLInput onSubmit={mockOnSubmit} loading={true} />);
    
    const input = screen.getByLabelText(/website url/i);
    const submitButton = screen.getByRole('button', { name: /starting analysis/i });
    
    expect(input).toBeDisabled();
    expect(submitButton).toBeDisabled();
  });

  it('prevents submission with empty URLs', () => {
    render(<URLInput onSubmit={mockOnSubmit} />);
    
    const submitButton = screen.getByRole('button', { name: /start analysis/i });
    
    expect(submitButton).toBeDisabled();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });
});