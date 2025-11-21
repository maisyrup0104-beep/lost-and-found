// backend/controllers/authController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_fallback_secret_change_me';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';

function generateToken(user) {
  return jwt.sign(
    { id: String(user._id), role: user.role, unit_id: user.unit_id || null },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

exports.register = async (req, res) => {
  try {
    const {
      name,
      user_type,
      department,
      education_level,
      phone,
      email,
      password
    } = req.body;

    if (!name || !user_type || !phone || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const existing = await User.findOne({ phone });
    if (existing) return res.status(400).json({ error: 'Phone already registered' });

    if (education_level && user_type !== 'student') {
      return res.status(400).json({ error: 'education_level applies only to students' });
    }

    const validLevels = ['elementary', 'jhs', 'shs', 'college', 'other'];
    if (education_level && !validLevels.includes(education_level)) {
      return res.status(400).json({ error: 'Invalid education_level' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const userData = {
      name,
      user_type,
      department: department || null,
      phone,
      email: email || null,
      password_hash,
      education_level: user_type === 'student' ? (education_level || null) : null
    };

    const user = new User(userData);
    await user.save();

    const token = generateToken(user);

    // cookie options
    const cookieOpts = {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // match JWT_EXPIRY roughly
    };
    if (process.env.NODE_ENV === 'production') cookieOpts.secure = true;

    // set cookie AND return token in body
    res.cookie('token', token, cookieOpts);

    res.status(201).json({
      ok: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
        unit_id: user.unit_id,
        phone: user.phone,
        email: user.email
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.login = async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ error: 'Missing credentials' });
    }

    const user = await User.findOne({ phone });
    if (!user) return res.status(400).json({ error: 'Invalid phone or password' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(400).json({ error: 'Invalid phone or password' });

    const token = generateToken(user);

    const cookieOpts = {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    };
    if (process.env.NODE_ENV === 'production') cookieOpts.secure = true;

    res.cookie('token', token, cookieOpts);

    res.json({
      ok: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
        unit_id: user.unit_id,
        phone: user.phone,
        email: user.email
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// logout — clear cookie and respond ok
exports.logout = (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'lax'
    // secure true in prod
  });
  res.json({ ok: true });
};

exports.me = async (req, res) => {
  try {
    if (!req.user || !req.user.id) return res.status(401).json({ error: 'Not authenticated' });
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    delete user.password_hash;
    res.json({ user });
  } catch (err) {
    console.error('me error', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    if (!req.user || !req.user.id) return res.status(401).json({ error: 'Not authenticated' });

    const allowed = ['name', 'phone', 'email', 'department', 'education_level'];
    const updates = {};
    for (const k of allowed) {
      if (typeof req.body[k] !== 'undefined') updates[k] = req.body[k];
    }

    if (updates.phone) {
      const other = await User.findOne({ phone: updates.phone, _id: { $ne: req.user.id } });
      if (other) return res.status(400).json({ error: 'Phone already used by another account' });
    }

    if (typeof updates.education_level !== 'undefined' && updates.education_level !== null) {
      const validLevels = ['elementary', 'jhs', 'shs', 'college', 'other'];
      if (!validLevels.includes(updates.education_level)) {
        return res.status(400).json({ error: 'Invalid education_level' });
      }
    }

    const user = await User.findByIdAndUpdate(req.user.id, { $set: updates }, { new: true }).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    delete user.password_hash;
    res.json({ user });
  } catch (err) {
    console.error('updateProfile error', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.changePassword = async (req, res) => {
  try {
    if (!req.user || !req.user.id) return res.status(401).json({ error: 'Not authenticated' });

    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Both current_password and new_password are required' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const ok = await bcrypt.compare(current_password, user.password_hash);
    if (!ok) return res.status(400).json({ error: 'Current password is incorrect' });

    const newHash = await bcrypt.hash(new_password, SALT_ROUNDS);
    user.password_hash = newHash;
    await user.save();

    res.clearCookie('token', { httpOnly: true, sameSite: 'lax' });
    res.json({ ok: true, message: 'Password changed' });
  } catch (err) {
    console.error('changePassword error', err);
    res.status(500).json({ error: 'Server error' });
  }
};