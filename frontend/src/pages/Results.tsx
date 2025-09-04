import React, { useState, useEffect } from 'react';
import { Typography, Box, Alert, CircularProgress, Grid, Button } from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { ResultsDashboard } from '../components/ResultsDashboard';
import { ExportInterface } from '../components/ExportInterface';
import { apiService } from '../services/api';
import { AnalysisResults, ExportRequest } from '../../../shared/types';

export const Results: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [results, setResults] = useState<AnalysisResults[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    if (jobId) {
      loadResults();
    }
  }, [jobId]);

  const loadResults = async () => {
    if (!jobId) return;

    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.getAnalysisResults(jobId);
      
      if (response.success && response.results) {
        setResults(response.results);
      } else {
        throw new Error('No results found for this analysis');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load results');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (exportRequest: ExportRequest) => {
    try {
      setExportLoading(true);
      setExportError(null);
      
      await apiService.exportResults(exportRequest);
      
      // Show success message or handle download
      console.log('Export completed successfully');
    } catch (err: any) {
      setExportError(err.message || 'Failed to export results');
    } finally {
      setExportLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/analysis')}
        >
          Back to Analysis
        </Button>
      </Box>
    );
  }

  if (results.length === 0) {
    return (
      <Box>
        <Alert severity="info" sx={{ mb: 3 }}>
          No results found for this analysis.
        </Alert>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/analysis')}
        >
          Start New Analysis
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/analysis')}
        >
          New Analysis
        </Button>
        <Typography variant="h4" component="h1">
          Analysis Results
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <ResultsDashboard results={results} />
        </Grid>
        
        <Grid item xs={12} lg={4}>
          <ExportInterface
            results={results}
            onExport={handleExport}
            loading={exportLoading}
            error={exportError}
          />
        </Grid>
      </Grid>
    </Box>
  );
};