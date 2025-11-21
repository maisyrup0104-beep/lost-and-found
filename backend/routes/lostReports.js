// backend/routes/lostReports.js
const express = require('express');
const router = express.Router();

const lostController = require('../controllers/lostController');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

// -----------------------------
// Multer Upload (local storage)
// -----------------------------
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads')); // /backend/uploads
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, unique + ext);
  }
});

const upload = multer({ storage });

// middleware: attach file URL to req.body.photo_url
function attachFileUrl(req, res, next) {
  if (req.file) {
    req.body.photo_url = `/uploads/${req.file.filename}`;
  }
  next();
}

// ----------------------------------------------------
// Create lost report (anonymous allowed)
// Supports optional photo upload
// ----------------------------------------------------
router.post(
  '/',
  upload.single('photo'),
  attachFileUrl,
  lostController.createLostReport
);

// ----------------------------------------------------
// Authenticated user: list own lost reports
// ----------------------------------------------------
router.get('/me', verifyToken, lostController.getMyReports);

// ----------------------------------------------------
// Optional: get matching found items for a lost report
// ----------------------------------------------------
router.get('/matches/:id', lostController.getMatches);

// Admin: list all lost reports (requires IT/admin)
router.get('/', verifyToken, requireRole('it_admin'), lostController.listAll);

module.exports = router;
