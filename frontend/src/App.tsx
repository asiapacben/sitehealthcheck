import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Container, AppBar, Toolbar, Typography, Box, IconButton } from '@mui/material';
import { Home as HomeIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { Home } from './pages/Home';
import { Analysis } from './pages/Analysis';
import { Results } from './pages/Results';
import { useResponsive } from './hooks/useResponsive';

function App() {
  const navigate = useNavigate();
  const { isMobile } = useResponsive();

  return (
    <Box sx={{ flexGrow: 1, minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static" elevation={1}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => navigate('/')}
            sx={{ mr: 2 }}
          >
            <HomeIcon />
          </IconButton>
          <Typography 
            variant={isMobile ? "h6" : "h5"} 
            component="div" 
            sx={{ 
              flexGrow: 1,
              cursor: 'pointer',
              '&:hover': { opacity: 0.8 }
            }}
            onClick={() => navigate('/')}
          >
            {isMobile ? 'SEO & GEO Checker' : 'SEO & GEO Health Checker'}
          </Typography>
        </Toolbar>
      </AppBar>
      
      <Container 
        maxWidth="xl" 
        sx={{ 
          mt: { xs: 2, md: 4 }, 
          mb: { xs: 2, md: 4 },
          px: { xs: 2, md: 3 }
        }}
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/analysis" element={<Analysis />} />
          <Route path="/results/:jobId" element={<Results />} />
        </Routes>
      </Container>
    </Box>
  );
}

export default App;