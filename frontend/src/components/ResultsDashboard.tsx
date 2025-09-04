import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  LinearProgress,
  Divider,
  Tab,
  Tabs
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  TrendingUp as TrendingUpIcon,
  Speed as SpeedIcon,
  Search as SearchIcon,
  Psychology as PsychologyIcon
} from '@mui/icons-material';
import { AnalysisResults, Recommendation } from '../../../shared/types';

interface ResultsDashboardProps {
  results: AnalysisResults[];
  onExport?: (format: string) => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div hidden={value !== index}>
    {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
  </div>
);

export const ResultsDashboard: React.FC<ResultsDashboardProps> = ({ 
  results, 
  onExport 
}) => {
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedUrl, setSelectedUrl] = useState(0);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'warning';
    return 'error';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Needs Improvement';
    return 'Poor';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'error';
      case 'Medium': return 'warning';
      case 'Low': return 'info';
      default: return 'default';
    }
  };

  const currentResult = results[selectedUrl];
  if (!currentResult) return null;

  const averageScore = results.reduce((sum, result) => sum + result.overallScore, 0) / results.length;

  return (
    <Box>
      {/* Overview Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <TrendingUpIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
              <Typography variant="h4" color={getScoreColor(averageScore)}>
                {Math.round(averageScore)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Average Score
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <SearchIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
              <Typography variant="h4">
                {Math.round(results.reduce((sum, r) => sum + r.seoScore.overall, 0) / results.length)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                SEO Score
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <PsychologyIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
              <Typography variant="h4">
                {Math.round(results.reduce((sum, r) => sum + r.geoScore.overall, 0) / results.length)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                GEO Score
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <SpeedIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
              <Typography variant="h4">
                {results.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                URLs Analyzed
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* URL Selection */}
      {results.length > 1 && (
        <Paper sx={{ mb: 3 }}>
          <Tabs 
            value={selectedUrl} 
            onChange={(_, newValue) => setSelectedUrl(newValue)}
            variant="scrollable"
            scrollButtons="auto"
          >
            {results.map((result, index) => (
              <Tab 
                key={index}
                label={
                  <Box sx={{ textAlign: 'left' }}>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                      {new URL(result.url).pathname || '/'}
                    </Typography>
                    <Chip 
                      label={Math.round(result.overallScore)} 
                      size="small" 
                      color={getScoreColor(result.overallScore)}
                    />
                  </Box>
                }
              />
            ))}
          </Tabs>
        </Paper>
      )}

      {/* Detailed Results */}
      <Paper sx={{ mb: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={selectedTab} onChange={(_, newValue) => setSelectedTab(newValue)}>
            <Tab label="Overview" />
            <Tab label="SEO Details" />
            <Tab label="GEO Details" />
            <Tab label="Recommendations" />
          </Tabs>
        </Box>

        <TabPanel value={selectedTab} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Overall Performance
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Overall Score</Typography>
                  <Typography variant="body2" color={getScoreColor(currentResult.overallScore)}>
                    {Math.round(currentResult.overallScore)} - {getScoreLabel(currentResult.overallScore)}
                  </Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={currentResult.overallScore} 
                  color={getScoreColor(currentResult.overallScore)}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                URL Information
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {currentResult.url}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Analyzed: {new Date(currentResult.timestamp).toLocaleString()}
              </Typography>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={selectedTab} index={1}>
          <Typography variant="h6" gutterBottom>
            SEO Analysis Details
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    Technical SEO
                  </Typography>
                  <Typography variant="h5" color={getScoreColor(currentResult.seoScore.technical)}>
                    {Math.round(currentResult.seoScore.technical)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    Content SEO
                  </Typography>
                  <Typography variant="h5" color={getScoreColor(currentResult.seoScore.content)}>
                    {Math.round(currentResult.seoScore.content)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    Structure
                  </Typography>
                  <Typography variant="h5" color={getScoreColor(currentResult.seoScore.structure)}>
                    {Math.round(currentResult.seoScore.structure)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    Page Speed
                  </Typography>
                  <Typography variant="h5" color={getScoreColor(currentResult.seoScore.details.pageSpeed)}>
                    {Math.round(currentResult.seoScore.details.pageSpeed)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={selectedTab} index={2}>
          <Typography variant="h6" gutterBottom>
            GEO Analysis Details
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    Readability
                  </Typography>
                  <Typography variant="h5" color={getScoreColor(currentResult.geoScore.readability)}>
                    {Math.round(currentResult.geoScore.readability)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    Credibility
                  </Typography>
                  <Typography variant="h5" color={getScoreColor(currentResult.geoScore.credibility)}>
                    {Math.round(currentResult.geoScore.credibility)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    Completeness
                  </Typography>
                  <Typography variant="h5" color={getScoreColor(currentResult.geoScore.completeness)}>
                    {Math.round(currentResult.geoScore.completeness)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary">
                    Structured Data
                  </Typography>
                  <Typography variant="h5" color={getScoreColor(currentResult.geoScore.structuredData)}>
                    {Math.round(currentResult.geoScore.structuredData)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={selectedTab} index={3}>
          <Typography variant="h6" gutterBottom>
            Recommendations ({currentResult.recommendations.length})
          </Typography>
          {currentResult.recommendations.map((recommendation: Recommendation, index: number) => (
            <Accordion key={recommendation.id || index}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                  <Chip 
                    label={recommendation.priority} 
                    size="small" 
                    color={getPriorityColor(recommendation.priority)}
                  />
                  <Chip 
                    label={recommendation.category} 
                    size="small" 
                    variant="outlined"
                  />
                  <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                    {recommendation.title}
                  </Typography>
                  <Chip 
                    label={`Impact: ${recommendation.impact}/10`} 
                    size="small" 
                    variant="outlined"
                  />
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" paragraph>
                  {recommendation.description}
                </Typography>
                <Typography variant="subtitle2" gutterBottom>
                  Action Steps:
                </Typography>
                <List dense>
                  {recommendation.actionSteps.map((step: string, stepIndex: number) => (
                    <ListItem key={stepIndex}>
                      <ListItemText 
                        primary={`${stepIndex + 1}. ${step}`}
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItem>
                  ))}
                </List>
                {recommendation.example && (
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Example:
                    </Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {recommendation.example}
                    </Typography>
                  </Box>
                )}
              </AccordionDetails>
            </Accordion>
          ))}
        </TabPanel>
      </Paper>
    </Box>
  );
};