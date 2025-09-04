import React, { useState } from 'react';
import { Typography, Box, Grid, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { URLInput } from '../components/URLInput';
import { AnalysisProgress } from '../components/AnalysisProgress';
import { apiService } from '../services/api';
import { AnalysisStatus, ValidationResult } from '../../../shared/types';

export const Analysis: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUrlSubmit = async (urls: string[]) => {
    setLoading(true);
    setError(null);
    setValidationResult(null);

    try {
      // First validate URLs
      const validation = await apiService.validateUrls(urls);
      setValidationResult(validation);

      if (!validation.valid) {
        setLoading(false);
        return;
      }

      // Start analysis
      const response = await apiService.startAnalysis({
        urls: validation.normalizedUrls
      });

      if (response.success && response.jobId) {
        // Start polling for status
        pollAnalysisStatus(response.jobId);
      } else {
        throw new Error('Failed to start analysis');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start analysis');
      setLoading(false);
    }
  };

  const pollAnalysisStatus = async (jobId: string) => {
    try {
      const status = await apiService.getAnalysisStatus(jobId);
      setAnalysisStatus(status);

      if (status.status === 'running' || status.status === 'pending') {
        // Continue polling
        setTimeout(() => pollAnalysisStatus(jobId), 2000);
      } else {
        setLoading(false);
        if (status.status === 'completed') {
          // Navigate to results page
          setTimeout(() => navigate(`/results/${jobId}`), 1000);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to get analysis status');
      setLoading(false);
    }
  };

  const handleAnalysisComplete = (results: any) => {
    // Analysis completed, will navigate to results
    console.log('Analysis completed:', results);
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Website Analysis
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Enter multiple URLs from your domain to get comprehensive SEO and GEO analysis
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <URLInput
            onSubmit={handleUrlSubmit}
            loading={loading}
            validationResult={validationResult}
          />
        </Grid>
        
        {analysisStatus && (
          <Grid item xs={12} md={6}>
            <AnalysisProgress
              status={analysisStatus}
              onComplete={handleAnalysisComplete}
            />
          </Grid>
        )}
      </Grid>
    </Box>
  );
};