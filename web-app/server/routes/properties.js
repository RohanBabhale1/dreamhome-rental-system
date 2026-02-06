const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Get all properties
router.get('/', async (req, res) => {
  try {
    const { city, type, minRent, maxRent, bedrooms } = req.query;
    
    let query = 'SELECT * FROM properties WHERE status = "available"';
    const params = [];

    if (city) {
      query += ' AND city = ?';
      params.push(city);
    }
    if (type) {
      query += ' AND property_type = ?';
      params.push(type);
    }
    if (minRent) {
      query += ' AND rent_amount >= ?';
      params.push(minRent);
    }
    if (maxRent) {
      query += ' AND rent_amount <= ?';
      params.push(maxRent);
    }
    if (bedrooms) {
      query += ' AND bedrooms >= ?';
      params.push(bedrooms);
    }

    const [properties] = await db.query(query, params);
    res.json(properties);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get property by ID
router.get('/:id', async (req, res) => {
  try {
    const [properties] = await db.query('SELECT * FROM properties WHERE property_id = ?', [req.params.id]);
    
    if (properties.length === 0) {
      return res.status(404).json({ message: 'Property not found' });
    }

    res.json(properties[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/all', async (req, res) => {
  try {
    const [properties] = await db.query('SELECT * FROM properties ORDER BY created_at DESC');
    res.json(properties);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update property - Staff only
router.put('/:id', async (req, res) => {
  try {
    const { address, city, state, propertyType, bedrooms, bathrooms, rentAmount, status } = req.body;
    
    await db.query(
      `UPDATE properties SET address = ?, city = ?, state = ?, property_type = ?, 
       bedrooms = ?, bathrooms = ?, rent_amount = ?, status = ? WHERE property_id = ?`,
      [address, city, state, propertyType, bedrooms, bathrooms, rentAmount, status, req.params.id]
    );
    
    res.json({ message: 'Property updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add new property - Staff only
router.post('/', async (req, res) => {
  try {
    const { address, city, state, propertyType, bedrooms, bathrooms, rentAmount } = req.body;
    
    const [result] = await db.query(
      `INSERT INTO properties (address, city, state, property_type, bedrooms, bathrooms, rent_amount, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'available')`,
      [address, city, state, propertyType, bedrooms, bathrooms, rentAmount]
    );
    
    res.status(201).json({ propertyId: result.insertId, message: 'Property added successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete property - Staff only
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM properties WHERE property_id = ?', [req.params.id]);
    res.json({ message: 'Property deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;