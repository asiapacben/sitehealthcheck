import React from 'react';
import { 
  Typography, 
  Paper, 
  Box, 
  Grid, 
  Card, 
  CardContent,
  Button
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';
import SpeedIcon from '@mui/icons-material/Speed';
import AssessmentIcon from '@mui/icons-material/Assessment';

export const Home: React.FC = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <SearchIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
      title: 'SEO Analysis',
      description: 'Comprehensive analysis of technical SEO, content optimization, and site structure'
    },
    {
      icon: <SpeedIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
      title: 'GEO Optimization',
      description: 'Generative Engine Optimization for AI-powered search engines and chatbots'
    },
    {
      icon: <AssessmentIcon sx={{ fontSize: 40, color: 'primary.main' }} />,
      title: 'Detailed Reports',
      description: 'Actionable recommendations with scoring and priority-based improvements'
    }
  ];

  return (
    <Box>
      <Paper elevation={3} sx={{ p: 4, mb: 4, textAlign: 'center' }}>
        <Typography variant="h2" component="h1" gutterBottom>
          SEO & GEO Health Checker
        </Typography>
        <Typography variant="h5" color="text.secondary" paragraph>
          Analyze your website for both traditional SEO and AI-powered search optimization
        </Typography>
        <Button 
          variant="contained" 
          size="large" 
          onClick={() => navigate('/analysis')}
          sx={{ mt: 2 }}
        >
          Start Analysis
        </Button>
      </Paper>

      <Grid container spacing={3}>
        {features.map((feature, index) => (
          <Grid item xs={12} md={4} key={index}>
            <Card sx={{ height: '100%', textAlign: 'center' }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ mb: 2 }}>
                  {feature.icon}
                </Box>
                <Typography variant="h6" component="h3" gutterBottom>
                  {feature.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {feature.description}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper elevation={1} sx={{ p: 3, mt: 4 }}>
        <Typography variant="h6" gutterBottom>
          How it works
        </Typography>
        <Typography variant="body1" paragraph>
          1. Enter multiple URLs from your domain for comprehensive analysis
        </Typography>
        <Typography variant="body1" paragraph>
          2. Our tool analyzes technical SEO, content quality, and GEO factors
        </Typography>
        <Typography variant="body1" paragraph>
          3. Receive detailed scores and actionable recommendations
        </Typography>
        <Typography variant="body1">
          4. Export results in multiple formats for team collaboration
        </Typography>
      </Paper>
    </Box>
  );
};