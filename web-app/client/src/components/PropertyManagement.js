import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';

function PropertyManagement() {
  const [properties, setProperties] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [currentProperty, setCurrentProperty] = useState(null);

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/properties/all');
      setProperties(response.data);
    } catch (error) {
      console.error('Error fetching properties:', error);
    }
  };

  const handleEdit = (property) => {
    setCurrentProperty(property);
    setOpenDialog(true);
  };

  const handleSave = async () => {
    try {
      if (currentProperty.property_id) {
        await axios.put(
          `http://localhost:5000/api/properties/${currentProperty.property_id}`,
          currentProperty
        );
      } else {
        await axios.post('http://localhost:5000/api/properties', currentProperty);
      }
      setOpenDialog(false);
      fetchProperties();
    } catch (error) {
      console.error('Error saving property:', error);
    }
  };

  return (
    <>
      <Button variant="contained" onClick={() => { setCurrentProperty({}); setOpenDialog(true); }}>
        Add New Property
      </Button>
      
      <TableContainer sx={{ mt: 2 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Address</TableCell>
              <TableCell>City</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Rent</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {properties.map((property) => (
              <TableRow key={property.property_id}>
                <TableCell>{property.address}</TableCell>
                <TableCell>{property.city}</TableCell>
                <TableCell>{property.property_type}</TableCell>
                <TableCell>${property.rent_amount}</TableCell>
                <TableCell>{property.status}</TableCell>
                <TableCell>
                  <Button onClick={() => handleEdit(property)}>Edit</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle>
          {currentProperty?.property_id ? 'Edit Property' : 'Add Property'}
        </DialogTitle>
        <DialogContent>
          {/* Add form fields here */}
          <TextField
            fullWidth
            margin="normal"
            label="Address"
            value={currentProperty?.address || ''}
            onChange={(e) => setCurrentProperty({...currentProperty, address: e.target.value})}
          />
          {/* Add more fields as needed */}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default PropertyManagement;