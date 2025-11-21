// backend/routes/admin.js
const express = require('express');
const router = express.Router();
const admin = require('../controllers/adminController');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

// All admin routes require a valid token and IT admin role
router.use(verifyToken);
router.use(requireRole('it_admin'));

// List users (supports ?role=manager, ?q=..., ?unit_id=...)
router.get('/users', admin.listUsers);

// Promote existing user to manager (body: { user_id, unit_id? })
router.post('/promote', admin.promote);

// Create manager (body: { name, phone, user_type?, department?, unit_id? })
router.post('/create-manager', admin.createManager);

// List promotion requests
router.get('/requests', admin.listRequests);

// Demote manager back to regular user (body: { user_id })
router.post('/demote', admin.demote);

module.exports = router;