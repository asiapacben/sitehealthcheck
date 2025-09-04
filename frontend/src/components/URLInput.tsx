import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  Chip,
  Alert,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { ValidationResult, ValidationError } from '../../../shared/types';

interface URLInputProps {
  onSubmit: (urls: string[]) => void;
  loading?: boolean;
  validationResult?: ValidationResult | null;
}

export const URLInput: React.FC<URLInputProps> = ({ 
  onSubmit, 
  loading = false, 
  validationResult 
}) => {
  const [urls, setUrls] = useState<string[]>(['']);
  const [currentUrl, setCurrentUrl] = useState('');

  const addUrl = () => {
    if (currentUrl.trim()) {
      setUrls([...urls.filter(url => url.trim()), currentUrl.trim()]);
      setCurrentUrl('');
    }
  };

  const removeUrl = (index: number) => {
    setUrls(urls.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validUrls = urls.filter(url => url.trim());
    if (validUrls.length > 0) {
      onSubmit(validUrls);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addUrl();
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Enter URLs for Analysis
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Add multiple URLs from the same domain for comprehensive analysis
      </Typography>

      <Box component="form" onSubmit={handleSubmit}>
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField
            fullWidth
            label="Website URL"
            value={currentUrl}
            onChange={(e) => setCurrentUrl(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="https://example.com/page"
            disabled={loading}
            size="small"
          />
          <IconButton 
            onClick={addUrl} 
            disabled={!currentUrl.trim() || loading}
            color="primary"
            data-testid="add-url-button"
          >
            <AddIcon />
          </IconButton>
        </Box>

        {urls.filter(url => url.trim()).length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              URLs to analyze ({urls.filter(url => url.trim()).length}):
            </Typography>
            <List dense>
              {urls.filter(url => url.trim()).map((url, index) => (
                <ListItem key={index} sx={{ py: 0.5 }}>
                  <ListItemText 
                    primary={url}
                    primaryTypographyProps={{ variant: 'body2' }}
                  />
                  <ListItemSecondaryAction>
                    <IconButton 
                      edge="end" 
                      onClick={() => removeUrl(index)}
                      disabled={loading}
                      size="small"
                      data-testid="delete-url-button"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {validationResult && !validationResult.valid && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Validation Errors:
            </Typography>
            {validationResult.errors.map((error: ValidationError, index: number) => (
              <Typography key={index} variant="body2">
                • {error.url}: {error.message}
              </Typography>
            ))}
          </Alert>
        )}

        <Button
          type="submit"
          variant="contained"
          disabled={urls.filter(url => url.trim()).length === 0 || loading}
          fullWidth
          size="large"
        >
          {loading ? 'Starting Analysis...' : 'Start Analysis'}
        </Button>
      </Box>
    </Paper>
  );
};