import React from 'react';
import {
  Box,
  Paper,
  Typography,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Alert
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Error as ErrorIcon,
  PlayArrow as PlayArrowIcon
} from '@mui/icons-material';
import { AnalysisStatus } from '../../../shared/types';

interface AnalysisProgressProps {
  status: AnalysisStatus;
  onComplete?: (results: any) => void;
}

export const AnalysisProgress: React.FC<AnalysisProgressProps> = ({ 
  status, 
  onComplete 
}) => {
  const getStatusColor = (currentStatus: string) => {
    switch (currentStatus) {
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'running': return 'primary';
      default: return 'default';
    }
  };

  const getStatusIcon = (currentStatus: string) => {
    switch (currentStatus) {
      case 'completed': return <CheckCircleIcon color="success" />;
      case 'failed': return <ErrorIcon color="error" />;
      case 'running': return <PlayArrowIcon color="primary" />;
      default: return <ScheduleIcon color="disabled" />;
    }
  };

  React.useEffect(() => {
    if (status.status === 'completed' && status.results && onComplete) {
      onComplete(status.results);
    }
  }, [status.status, status.results, onComplete]);

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Typography variant="h6">
            Analysis Progress
          </Typography>
          <Chip 
            label={status.status.toUpperCase()} 
            color={getStatusColor(status.status)}
            size="small"
          />
        </Box>

        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Progress: {status.completedUrls} of {status.totalUrls} URLs
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {Math.round(status.progress)}%
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={status.progress} 
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>
      </Box>

      {status.error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="subtitle2">Analysis Failed</Typography>
          <Typography variant="body2">{status.error}</Typography>
        </Alert>
      )}

      {status.status === 'running' && (
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Current Status:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon>
                {getStatusIcon('running')}
              </ListItemIcon>
              <ListItemText 
                primary="Analyzing URLs..."
                secondary={`Processing ${status.completedUrls + 1} of ${status.totalUrls}`}
              />
            </ListItem>
          </List>
        </Box>
      )}

      {status.status === 'completed' && (
        <Alert severity="success">
          <Typography variant="subtitle2">Analysis Complete!</Typography>
          <Typography variant="body2">
            Successfully analyzed {status.completedUrls} URLs. 
            {status.results && ` View your results below.`}
          </Typography>
        </Alert>
      )}

      {status.status === 'pending' && (
        <Box>
          <Typography variant="body2" color="text.secondary">
            Analysis queued and will start shortly...
          </Typography>
        </Box>
      )}
    </Paper>
  );
};