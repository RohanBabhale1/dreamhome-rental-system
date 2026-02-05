import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Container,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Button,
  TextField,
  Box,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

function Properties() {
  const [properties, setProperties] = useState([]);
  const [filters, setFilters] = useState({
    city: '',
    type: '',
    bedrooms: ''
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchProperties();
  }, [filters]);

  const fetchProperties = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/properties', {
        params: filters
      });
      setProperties(response.data);
    } catch (error) {
      console.error('Error fetching properties:', error);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Available Properties
      </Typography>

      <Box sx={{ mb: 4, display: 'flex', gap: 2 }}>
        <TextField
          label="City"
          value={filters.city}
          onChange={(e) => setFilters({ ...filters, city: e.target.value })}
        />
        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel>Property Type</InputLabel>
          <Select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="house">House</MenuItem>
            <MenuItem value="apartment">Apartment</MenuItem>
            <MenuItem value="condo">Condo</MenuItem>
          </Select>
        </FormControl>
        <TextField
          label="Min Bedrooms"
          type="number"
          value={filters.bedrooms}
          onChange={(e) => setFilters({ ...filters, bedrooms: e.target.value })}
        />
      </Box>

      <Grid container spacing={3}>
        {properties.map((property) => (
          <Grid item xs={12} sm={6} md={4} key={property.property_id}>
            <Card>
              <CardMedia
                component="img"
                height="200"
                image={property.image_url || 'https://via.placeholder.com/400x300'}
                alt={property.address}
              />
              <CardContent>
                <Typography variant="h6">{property.address}</Typography>
                <Typography color="text.secondary">
                  {property.city}, {property.state}
                </Typography>
                <Typography variant="body2">
                  {property.bedrooms} bed • {property.bathrooms} bath
                </Typography>
                <Typography variant="h5" color="primary" sx={{ mt: 1 }}>
                  ${property.rent_amount}/month
                </Typography>
                <Button
                  variant="contained"
                  fullWidth
                  sx={{ mt: 2 }}
                  onClick={() => navigate(`/properties/${property.property_id}`)}
                >
                  View Details
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}

export default Properties;