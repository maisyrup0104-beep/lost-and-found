// backend/routes/claims.js
const express = require('express');
const router = express.Router();

const claimController = require('../controllers/claimController');
const { verifyToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists (same as server's UPLOAD_DIR)
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log(`Created upload directory at ${UPLOAD_DIR}`);
}

// ---------------------------
// Multer storage
// ---------------------------
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '';
    const base = path.basename(file.originalname, ext)
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9-_]/g, '');
    const unique = `${base}-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}${ext}`;
    cb(null, unique);
  }
});
const upload = multer({ storage });

// ---------------------------
// Helper: attach file path
// ---------------------------
function attachFileUrl(req, res, next) {
  if (req.file) {
    // frontend can request /uploads/<filename>
    req.body.proof_url = `/uploads/${req.file.filename}`;
  }
  next();
}

// ------------------------------------------------------------
// Create claim (authenticated user) + optional proof upload
// Accepts multipart/form-data with optional 'proof' file field
// ------------------------------------------------------------
router.post(
  '/',
  verifyToken,
  upload.single('proof'), // multipart support
  attachFileUrl,          // sets req.body.proof_url when file present
  claimController.createClaim
);

// ------------------------------------------------------------
// User: list own claims
// ------------------------------------------------------------
router.get('/me', verifyToken, claimController.getUserClaims);

// ------------------------------------------------------------
// Manager: pending claims (filtered by manager unit)
// ------------------------------------------------------------
router.get(
  '/manager/pending',
  verifyToken,
  requireRole('manager'),
  claimController.managerPendingClaims
);

// ------------------------------------------------------------
// Manager: approve / reject / mark as claimed
// ------------------------------------------------------------
router.post(
  '/:id/approve',
  verifyToken,
  requireRole('manager'),
  claimController.approveClaim
);

router.post(
  '/:id/reject',
  verifyToken,
  requireRole('manager'),
  claimController.rejectClaim
);

router.post(
  '/:id/claimed',
  verifyToken,
  requireRole('manager'),
  claimController.markClaimed
);

// ------------------------------------------------------------
// Admin: list all claims (IT/admin)
// ------------------------------------------------------------
router.get('/', verifyToken, requireRole('it_admin'), claimController.listAll);

module.exports = router;