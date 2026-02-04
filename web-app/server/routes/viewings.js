const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Schedule viewing
router.post('/', async (req, res) => {
  try {
    const { propertyId, clientId, viewingDate } = req.body;

    const [result] = await db.query(
      'INSERT INTO viewings (property_id, client_id, viewing_date, status) VALUES (?, ?, ?, ?)',
      [propertyId, clientId, viewingDate, 'scheduled']
    );

    res.status(201).json({ viewingId: result.insertId, message: 'Viewing scheduled successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get viewings for a client
router.get('/client/:clientId', async (req, res) => {
  try {
    const [viewings] = await db.query(`
      SELECT v.*, p.address, p.city, p.property_type 
      FROM viewings v
      JOIN properties p ON v.property_id = p.property_id
      WHERE v.client_id = ?
      ORDER BY v.viewing_date DESC
    `, [req.params.clientId]);

    res.json(viewings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
