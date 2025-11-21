// backend/controllers/adminController.js
const bcrypt = require('bcrypt');
const User = require('../models/User');
const Unit = require('../models/Unit');
const AuditLog = require('../models/AuditLog');

const SALT_ROUNDS = 10;

/**
 * Helper to emit socket events when server has io attached.
 * Uses req.app.get('io') (set in server.js).
 */
function emitIo(req, event, payload) {
  try {
    const io = req && req.app && typeof req.app.get === 'function' && req.app.get('io');
    if (io && typeof io.emit === 'function') {
      io.emit(event, payload);
    }
  } catch (e) {
    // don't let socket errors break the main flow
    console.warn('emitIo error', e);
  }
}

/**
 * List users with optional filters:
 *  - ?role=manager
 *  - ?q=phone|name
 *  - ?unit_id=<id>
 * Returns: { users: [...] }
 */
exports.listUsers = async (req, res) => {
  try {
    const { role, q, unit_id } = req.query;
    const filter = {};

    if (role) filter.role = role;
    if (unit_id) filter.unit_id = unit_id;
    if (q) filter.$or = [{ name: new RegExp(q, 'i') }, { phone: new RegExp(q, 'i') }];

    // populate unit info for convenient frontend use
    const users = await User.find(filter)
      .select('-password_hash')
      .populate('unit_id', 'name code')
      .lean();

    res.json({ users });
  } catch (err) {
    console.error('listUsers', err);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Promote existing user to manager (assign unit)
 * Body: { user_id, unit_id? }
 */
exports.promote = async (req, res) => {
  try {
    const actorId = req.user && req.user.id;
    const { user_id, unit_id } = req.body;

    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    const user = await User.findById(user_id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Validate unit if provided
    if (unit_id) {
      const unit = await Unit.findById(unit_id);
      if (!unit) return res.status(400).json({ error: 'Invalid unit_id' });
      user.unit_id = unit._id;
    }

    user.role = 'manager';
    user.promotion_requested = false; // clear request if any
    await user.save();

    // Populate unit for response
    const populated = await User.findById(user._id).select('-password_hash').populate('unit_id', 'name code').lean();

    try {
      await AuditLog.create({
        actor_id: actorId,
        action: 'promote_to_manager',
        target_type: 'User',
        target_id: user._id,
        meta: { unit_id: user.unit_id }
      });
    } catch (auditErr) {
      console.warn('audit create failed (promote)', auditErr);
    }

    // Emit socket events for real-time updates
    emitIo(req, 'staffs:changed', { action: 'promote', user: populated });
    emitIo(req, 'users:changed', { action: 'promote', user: populated });

    res.json({ ok: true, user: populated });
  } catch (err) {
    console.error('promote', err);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Create manager account (IT creates new manager with temp password)
 * Body: { name, phone, user_type?, department?, unit_id? }
 */
exports.createManager = async (req, res) => {
  try {
    const actorId = req.user && req.user.id;
    const { name, phone, user_type = 'teaching_staff', department, unit_id } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'name and phone required' });
    }

    const existing = await User.findOne({ phone });
    if (existing) {
      return res.status(400).json({ error: 'Phone already exists' });
    }

    // Validate unit if provided
    let unitRef = null;
    if (unit_id) {
      const unit = await Unit.findById(unit_id);
      if (!unit) return res.status(400).json({ error: 'Invalid unit_id' });
      unitRef = unit._id;
    }

    // generate a random temporary password
    const temp = Math.random().toString(36).slice(-8) + Math.floor(Math.random() * 90 + 10);
    const password_hash = await bcrypt.hash(temp, SALT_ROUNDS);

    const user = new User({
      name,
      user_type,
      department: department || null,
      phone,
      email: null,
      password_hash,
      role: 'manager',
      unit_id: unitRef || null
    });

    await user.save();

    try {
      await AuditLog.create({
        actor_id: actorId,
        action: 'create_manager',
        target_type: 'User',
        target_id: user._id,
        meta: { unit_id: user.unit_id, temp_password: '***shown_once***' }
      });
    } catch (auditErr) {
      console.warn('audit create failed (createManager)', auditErr);
    }

    // Return temp password once and populated user
    const populated = await User.findById(user._id).select('-password_hash').populate('unit_id', 'name code').lean();

    // Emit socket events
    emitIo(req, 'staffs:changed', { action: 'create', user: populated });
    emitIo(req, 'users:changed', { action: 'create', user: populated });

    res.status(201).json({
      ok: true,
      user: populated,
      temp_password: temp
    });
  } catch (err) {
    console.error('createManager', err);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * List promotion requests
 */
exports.listRequests = async (req, res) => {
  try {
    const requests = await User.find({ promotion_requested: true })
      .select('-password_hash')
      .populate('unit_id', 'name code')
      .lean();

    res.json({ requests });
  } catch (err) {
    console.error('listRequests', err);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * Demote manager back to normal user (optional)
 * Body: { user_id }
 */
exports.demote = async (req, res) => {
  try {
    const actorId = req.user && req.user.id;
    const { user_id } = req.body;

    if (!user_id) return res.status(400).json({ error: 'user_id required' });

    const user = await User.findById(user_id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.role = 'user';
    user.unit_id = null;
    await user.save();

    try {
      await AuditLog.create({
        actor_id: actorId,
        action: 'demote_from_manager',
        target_type: 'User',
        target_id: user._id
      });
    } catch (auditErr) {
      console.warn('audit create failed (demote)', auditErr);
    }

    // populated user for payload (role is now 'user')
    const populated = await User.findById(user._id).select('-password_hash').populate('unit_id', 'name code').lean();

    // Emit socket events
    emitIo(req, 'staffs:changed', { action: 'demote', user: populated });
    emitIo(req, 'users:changed', { action: 'demote', user: populated });

    res.json({ ok: true });
  } catch (err) {
    console.error('demote', err);
    res.status(500).json({ error: 'Server error' });
  }
};