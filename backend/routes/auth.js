const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

// public
router.post('/register', authController.register);
router.post('/login', authController.login);

// authenticated
router.post('/logout', verifyToken, authController.logout);
router.get('/me', verifyToken, authController.me);
router.patch('/me', verifyToken, authController.updateProfile);
router.post('/change-password', verifyToken, authController.changePassword);

module.exports = router;
