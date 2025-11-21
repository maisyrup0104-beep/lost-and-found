// backend/routes/found.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const foundController = require('../controllers/foundController');
const { verifyToken } = require('../middleware/auth');   // matches your auth.js
const { requireRole } = require('../middleware/roles');   // matches your roles.js

// Ensure uploads directory exists (same location as server's UPLOAD_DIR)
// We resolve to backend/uploads (server.js created/joined __dirname + '/uploads')
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log(`Created upload directory at ${UPLOAD_DIR}`);
}

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // keep original ext, create a unique filename
    const ext = path.extname(file.originalname) || '';
    const base = path.basename(file.originalname, ext).replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_]/g, '');
    const unique = `${base}-${Date.now()}${Math.floor(Math.random() * 9000 + 1000)}${ext}`;
    cb(null, unique);
  }
});

const upload = multer({ storage });

// Helper middleware: if multer put a file, attach a photo_url to req.body so controller can use it
function attachFileUrl(req, res, next) {
  if (req.file) {
    // store a URL path that the frontend can request: /uploads/<filename>
    // If you want absolute URL, frontend can prefix with the API origin.
    req.body.photo_url = `/uploads/${req.file.filename}`;
  }
  next();
}

// PUBLIC — list published items
router.get('/public', foundController.listPublic);

// AUTHENTICATED — create found item
// accept an optional file field named 'photo' (multipart/form-data)
router.post('/', verifyToken, upload.single('photo'), attachFileUrl, foundController.createFound);

// MANAGER inbox (requires role 'manager')
router.get('/manager/inbox', verifyToken, requireRole('manager'), foundController.managerInbox);

// MANAGER actions
router.post('/:id/verify', verifyToken, requireRole('manager'), foundController.verifyItem);
router.post('/:id/publish', verifyToken, requireRole('manager'), foundController.publishToPublic);

module.exports = router;
