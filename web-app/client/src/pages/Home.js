import React from 'react';
import { Container, Typography, Button, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';

function Home() {
  const navigate = useNavigate();

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 8, textAlign: 'center' }}>
        <Typography variant="h2" component="h1" gutterBottom>
          Welcome to DreamHome
        </Typography>
        <Typography variant="h5" color="text.secondary" paragraph>
          Find your perfect rental property today
        </Typography>
        <Button 
          variant="contained" 
          size="large" 
          onClick={() => navigate('/properties')}
          sx={{ mt: 3 }}
        >
          Browse Properties
        </Button>
      </Box>
    </Container>
  );
}

export default Home;