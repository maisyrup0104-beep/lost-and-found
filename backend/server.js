require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { Server } = require('socket.io');

const { connect } = require('./db');

// Route modules
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const unitRoutes = require('./routes/units');
const foundRoutes = require('./routes/found');
const claimRoutes = require('./routes/claims');
const lostReportRoutes = require('./routes/lostReports'); // ensure filename matches!

const app = express();

/**
 * ------------------------------------------------------
 * Uploads directory (ensure exists)
 * ------------------------------------------------------
 */
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log(`Created upload directory at ${UPLOAD_DIR}`);
}

/**
 * ------------------------------------------------------
 * CORS & parsers (CORS must be registered before routes/static)
 * ------------------------------------------------------
 */
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
    credentials: true
  })
);

// parse application/json
app.use(bodyParser.json());
// allow urlencoded for form posts (useful for some multipart fallbacks)
app.use(bodyParser.urlencoded({ extended: true }));

app.use(cookieParser());

/**
 * ------------------------------------------------------
 * Serve uploaded files (static)
 * ------------------------------------------------------
 * Files will be available at: http://<host>:<port>/uploads/<filename>
 * Keeping this after CORS ensures static responses get CORS headers.
 */
app.use('/uploads', express.static(UPLOAD_DIR));

/**
 * Health check
 */
app.get('/', (req, res) => res.send('Lost & Found API running'));

/**
 * API Routes
 */
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/found-items', foundRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/lost-reports', lostReportRoutes);

/**
 * 404 fallback for unknown API routes
 */
app.use((req, res) => {
  console.warn(`⚠️  404 Not Found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: 'Not Found' });
});

/**
 * Start server after DB connects and attach Socket.IO
 */
const PORT = process.env.PORT || 4000;

connect()
  .then(() => {
    // create http server and attach socket.io
    const httpServer = http.createServer(app);

    const io = new Server(httpServer, {
      cors: {
        origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
        credentials: true
      }
    });

    // expose io to controllers via app (controllers can use req.app.get('io'))
    app.set('io', io);

    io.on('connection', (socket) => {
      console.log('Socket connected:', socket.id);

      // Optional: you can add authentication/rooms here.
      // Example placeholder:
      // socket.on('authenticate', (token) => { ... })

      socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', socket.id, reason);
      });
    });

    httpServer.listen(PORT, () => {
      console.log(`🔥 Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Failed to connect to DB', err);
    process.exit(1);
  });