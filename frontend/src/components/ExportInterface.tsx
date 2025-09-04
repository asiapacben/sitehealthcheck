import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  Switch,
  Divider,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Download as DownloadIcon,
  PictureAsPdf as PdfIcon,
  TableChart as CsvIcon,
  Code as JsonIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
import { AnalysisResults, ExportRequest } from '../../../shared/types';

interface ExportInterfaceProps {
  results: AnalysisResults[];
  onExport: (exportRequest: ExportRequest) => Promise<void>;
  loading?: boolean;
  error?: string | null;
}

export const ExportInterface: React.FC<ExportInterfaceProps> = ({
  results,
  onExport,
  loading = false,
  error = null
}) => {
  const [format, setFormat] = useState<'pdf' | 'csv' | 'json'>('pdf');
  const [includeDetails, setIncludeDetails] = useState(true);
  const [customNotes, setCustomNotes] = useState('');
  const [branding, setBranding] = useState({
    companyName: '',
    colors: {
      primary: '#1976d2',
      secondary: '#dc004e'
    }
  });

  const formatOptions = [
    {
      value: 'pdf',
      label: 'PDF Report',
      description: 'Comprehensive report with charts and visualizations',
      icon: <PdfIcon />
    },
    {
      value: 'csv',
      label: 'CSV Data',
      description: 'Raw data for analysis and tracking',
      icon: <CsvIcon />
    },
    {
      value: 'json',
      label: 'JSON Export',
      description: 'Complete data for API integration',
      icon: <JsonIcon />
    }
  ];

  const handleExport = async () => {
    const exportRequest: ExportRequest = {
      format,
      results,
      includeDetails,
      customNotes: customNotes.trim() || undefined,
      branding: branding.companyName ? branding : undefined
    };

    await onExport(exportRequest);
  };

  const selectedFormat = formatOptions.find(option => option.value === format);

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Export Results
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Export your analysis results in various formats for sharing and further analysis
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Format Selection */}
      <FormControl component="fieldset" sx={{ mb: 3 }}>
        <FormLabel component="legend">Export Format</FormLabel>
        <RadioGroup
          value={format}
          onChange={(e) => setFormat(e.target.value as 'pdf' | 'csv' | 'json')}
        >
          {formatOptions.map((option) => (
            <FormControlLabel
              key={option.value}
              value={option.value}
              control={<Radio />}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {option.icon}
                  <Box>
                    <Typography variant="body1">{option.label}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {option.description}
                    </Typography>
                  </Box>
                </Box>
              }
            />
          ))}
        </RadioGroup>
      </FormControl>

      <Divider sx={{ my: 3 }} />

      {/* Export Options */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Export Options
        </Typography>
        
        <FormControlLabel
          control={
            <Switch
              checked={includeDetails}
              onChange={(e) => setIncludeDetails(e.target.checked)}
            />
          }
          label="Include detailed technical information"
        />
        
        <TextField
          fullWidth
          label="Custom Notes (Optional)"
          multiline
          rows={3}
          value={customNotes}
          onChange={(e) => setCustomNotes(e.target.value)}
          placeholder="Add any custom notes or observations to include in the report..."
          sx={{ mt: 2 }}
        />
      </Box>

      {/* Branding Options (PDF only) */}
      {format === 'pdf' && (
        <Accordion sx={{ mb: 3 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">
              Branding Options (Optional)
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <TextField
              fullWidth
              label="Company Name"
              value={branding.companyName}
              onChange={(e) => setBranding({
                ...branding,
                companyName: e.target.value
              })}
              sx={{ mb: 2 }}
            />
            
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Primary Color"
                type="color"
                value={branding.colors.primary}
                onChange={(e) => setBranding({
                  ...branding,
                  colors: { ...branding.colors, primary: e.target.value }
                })}
                sx={{ width: 120 }}
              />
              <TextField
                label="Secondary Color"
                type="color"
                value={branding.colors.secondary}
                onChange={(e) => setBranding({
                  ...branding,
                  colors: { ...branding.colors, secondary: e.target.value }
                })}
                sx={{ width: 120 }}
              />
            </Box>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Export Summary */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}>
        <Typography variant="subtitle2" gutterBottom>
          Export Summary
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Format: {selectedFormat?.label}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          URLs: {results.length} analyzed pages
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Details: {includeDetails ? 'Included' : 'Summary only'}
        </Typography>
        {customNotes && (
          <Typography variant="body2" color="text.secondary">
            Custom notes: {customNotes.length} characters
          </Typography>
        )}
      </Paper>

      {/* Export Button */}
      <Button
        variant="contained"
        size="large"
        fullWidth
        onClick={handleExport}
        disabled={loading || results.length === 0}
        startIcon={loading ? <CircularProgress size={20} /> : <DownloadIcon />}
      >
        {loading ? 'Generating Export...' : `Export as ${selectedFormat?.label}`}
      </Button>
    </Paper>
  );
};