import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Container,
  Typography,
  Box,
  Tabs,
  Tab,
  Paper
} from '@mui/material';
import PropertyManagement from '../components/PropertyManagement';
import ViewingManagement from '../components/ViewingManagement';
import RentalManagement from '../components/RentalManagement';

function StaffDashboard() {
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Staff Dashboard
      </Typography>
      
      <Paper sx={{ mt: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Properties" />
          <Tab label="Viewings" />
          <Tab label="Rentals" />
        </Tabs>
        
        <Box sx={{ p: 3 }}>
          {tabValue === 0 && <PropertyManagement />}
          {tabValue === 1 && <ViewingManagement />}
          {tabValue === 2 && <RentalManagement />}
        </Box>
      </Paper>
    </Container>
  );
}

export default StaffDashboard;