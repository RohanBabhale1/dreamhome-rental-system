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

module.exports = router;