// backend/routes/units.js
const express = require('express');
const router = express.Router();
const unitController = require('../controllers/unitController');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

// Public: list units
router.get('/', unitController.listUnits);

// Protected: list with managers (IT only)
router.get('/with-managers', verifyToken, requireRole('it_admin'), unitController.listUnitsWithManagers);

// Public: get unit by id
router.get('/:id', unitController.getUnit);

// Protected: create/update/delete units (IT only)
router.post('/', verifyToken, requireRole('it_admin'), unitController.createUnit);
router.patch('/:id', verifyToken, requireRole('it_admin'), unitController.updateUnit);
router.delete('/:id', verifyToken, requireRole('it_admin'), unitController.deleteUnit);

module.exports = router;
