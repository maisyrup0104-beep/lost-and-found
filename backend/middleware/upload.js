// backend/middleware/upload.js
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const basename = crypto.randomBytes(8).toString('hex');
    cb(null, `${Date.now()}-${basename}${ext}`);
  }
});

function fileFilter (req, file, cb) {
  // Accept images only (jpg/jpeg/png/webp)
  const allowed = /jpeg|jpg|png|webp/;
  const ext = (file.mimetype || '').toLowerCase();
  if (allowed.test(ext)) cb(null, true);
  else cb(new Error('Only image files are allowed (jpg, png, webp).'));
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

module.exports = upload;
