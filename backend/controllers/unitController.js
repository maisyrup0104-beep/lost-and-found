// backend/controllers/unitController.js
const Unit = require('../models/Unit');
const User = require('../models/User'); // to find assigned managers
const AuditLog = require('../models/AuditLog'); // optional

// helper to emit socket events if server has io attached
function emitIo(req, event, payload) {
  try {
    const io = req && req.app && req.app.get && req.app.get('io');
    if (io && typeof io.emit === 'function') {
      io.emit(event, payload);
    }
  } catch (e) {
    // don't let socket errors break the request
    console.warn('emitIo error', e);
  }
}

// List all units (public)
exports.listUnits = async (req, res) => {
  try {
    const units = await Unit.find().sort({ name: 1 }).lean();
    res.json(units);
  } catch (err) {
    console.error('listUnits error', err);
    res.status(500).json({ error: 'Failed to fetch units' });
  }
};

// List units with assigned manager(s) populated (IT-only endpoint)
exports.listUnitsWithManagers = async (req, res) => {
  try {
    // find units
    const units = await Unit.find().sort({ name: 1 }).lean();

    // find managers referencing these units
    const unitIds = units.map(u => u._id);
    const managers = await User.find({ role: 'manager', unit_id: { $in: unitIds } })
      .select('name phone unit_id')
      .lean();

    // build map unitId -> [managers]
    const map = {};
    managers.forEach(m => {
      const key = String(m.unit_id);
      map[key] = map[key] || [];
      map[key].push(m);
    });

    // attach managers array to each unit
    const result = units.map(u => ({
      ...u,
      managers: map[String(u._id)] || []
    }));

    res.json({ units: result });
  } catch (err) {
    console.error('listUnitsWithManagers error', err);
    res.status(500).json({ error: 'Failed to fetch units with managers' });
  }
};

exports.getUnit = async (req, res) => {
  try {
    const unit = await Unit.findById(req.params.id).lean();
    if (!unit) return res.status(404).json({ error: 'Unit not found' });
    res.json(unit);
  } catch (err) {
    console.error('getUnit error', err);
    res.status(500).json({ error: 'Failed to fetch unit' });
  }
};

exports.createUnit = async (req, res) => {
  try {
    const { name, code, type, aliases } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const unit = new Unit({
      name,
      code: code || null,
      type: type || 'facility',
      aliases: Array.isArray(aliases) ? aliases : (typeof aliases === 'string' && aliases ? aliases.split(',').map(s => s.trim()) : [])
    });

    await unit.save();

    if (AuditLog) {
      try {
        await AuditLog.create({ actor_id: req.user ? req.user.id : null, action: 'create_unit', target_type: 'Unit', target_id: unit._id });
      } catch (e) { /* ignore audit errors */ }
    }

    // emit socket event so clients can react in real-time
    emitIo(req, 'units:changed', { action: 'create', unit });

    res.status(201).json({ ok: true, unit });
  } catch (err) {
    console.error('createUnit error', err);
    res.status(500).json({ error: 'Failed to create unit' });
  }
};

exports.updateUnit = async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = ['name', 'code', 'type', 'aliases'];
    const updates = {};
    for (const k of allowed) {
      if (typeof req.body[k] !== 'undefined') updates[k] = req.body[k];
    }
    // normalize aliases
    if (updates.aliases && typeof updates.aliases === 'string') {
      updates.aliases = updates.aliases.split(',').map(s => s.trim()).filter(Boolean);
    }

    const unit = await Unit.findByIdAndUpdate(id, { $set: updates }, { new: true }).lean();
    if (!unit) return res.status(404).json({ error: 'Unit not found' });

    if (AuditLog) {
      try {
        await AuditLog.create({ actor_id: req.user ? req.user.id : null, action: 'update_unit', target_type: 'Unit', target_id: unit._id, meta: updates });
      } catch (e) { /* ignore */ }
    }

    // emit socket event so clients can react in real-time
    emitIo(req, 'units:changed', { action: 'update', unit });

    res.json({ ok: true, unit });
  } catch (err) {
    console.error('updateUnit error', err);
    res.status(500).json({ error: 'Failed to update unit' });
  }
};

exports.deleteUnit = async (req, res) => {
  try {
    const { id } = req.params;
    const unit = await Unit.findById(id);
    if (!unit) return res.status(404).json({ error: 'Unit not found' });

    // Prevent deleting if there are managers assigned — safer to require admin to demote first
    const assignedManagers = await User.findOne({ unit_id: unit._id, role: 'manager' }).lean();
    if (assignedManagers) {
      return res.status(400).json({ error: 'Unit has assigned manager(s) — remove or reassign before deleting' });
    }

    await Unit.deleteOne({ _id: unit._id });

    if (AuditLog) {
      try {
        await AuditLog.create({ actor_id: req.user ? req.user.id : null, action: 'delete_unit', target_type: 'Unit', target_id: unit._id });
      } catch (e) { /* ignore */ }
    }

    // emit socket event so clients can react in real-time
    emitIo(req, 'units:changed', { action: 'delete', unit_id: String(unit._id) });

    res.json({ ok: true });
  } catch (err) {
    console.error('deleteUnit error', err);
    res.status(500).json({ error: 'Failed to delete unit' });
  }
};