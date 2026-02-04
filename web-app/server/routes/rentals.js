const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Get rentals for a client
router.get('/client/:clientId', async (req, res) => {
  try {
    const [rentals] = await db.query(`
      SELECT r.*, p.address, p.city, p.property_type 
      FROM rentals r
      JOIN properties p ON r.property_id = p.property_id
      WHERE r.client_id = ?
      ORDER BY r.created_at DESC
    `, [req.params.clientId]);

    res.json(rentals);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;