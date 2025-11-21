// backend/controllers/foundController.js
const FoundItem = require('../models/FoundItem');
const Unit = require('../models/Unit');
const AuditLog = require('../models/AuditLog');

const CENTRAL_CODE = 'CENT';

/**
 * Helper: add status log
 */
function pushStatusLog(item, prev, curr, actor = null, note = null) {
  item.status_log = item.status_log || [];
  item.status_log.push({
    previous_status: prev,
    current_status: curr,
    actor_id: actor,
    note,
    timestamp: new Date()
  });
}

/**
 * -----------------------------------------
 * CREATE FOUND ITEM
 * - supports multipart/form-data uploads (req.file) or regular JSON (req.body.photo_url)
 * - if UPLOADs are stored under /uploads and BACKEND_URL is set, returned photo_url is absolute
 * -----------------------------------------
 */
exports.createFound = async (req, res) => {
  try {
    // Body may come from multipart/form-data (with multer) or application/json
    const {
      item_name,
      category,
      description,
      found_location_general,
      found_location_details,
      date_found,
      custody,
      photo_url, // may be provided as a string OR set by upload middleware
      finder_name,
      finder_phone
    } = req.body;

    // Build final photo URL:
    // - If multer placed a file in req.file, use that filename
    // - Otherwise use provided photo_url string (may be null)
    // Optionally prefix with BACKEND_URL so frontend can load across origins
    const BACKEND_URL = process.env.BACKEND_URL || '';
    const finalPhotoUrl = (req.file && req.file.filename)
      ? `${BACKEND_URL}/uploads/${req.file.filename}`
      : (photo_url || null);

    // required fields
    if (!item_name || !category || !description || !found_location_general || !custody) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate unit id (found_location_general may be an id string)
    let unit = null;
    try {
      unit = await Unit.findById(found_location_general);
    } catch (e) {
      unit = null;
    }
    if (!unit) {
      // fallback to central unit
      unit = await Unit.findOne({ code: CENTRAL_CODE });
    }

    const initialStatus =
      (custody === 'B' || custody === 'C')
        ? 'secured_unclaimed'
        : 'to_be_retrieved';

    const found = new FoundItem({
      item_name,
      category,
      description,
      found_location_general: unit ? unit._id : null,
      found_location_details: found_location_details || null,
      date_found: date_found || null,
      custody,
      photo_url: finalPhotoUrl,
      finder_name: finder_name || null,
      finder_phone: finder_phone || null,
      assigned_unit_id: unit ? unit._id : null,
      status: initialStatus
    });

    // initial status log
    pushStatusLog(found, null, initialStatus, req.user ? req.user.id : null, 'Created found item');

    await found.save();

    // create an audit log entry if AuditLog model is present
    if (AuditLog) {
      try {
        await AuditLog.create({
          actor_id: req.user ? req.user.id : null,
          action: 'create_found_item',
          target_type: 'FoundItem',
          target_id: found._id,
          meta: {
            assigned_unit_id: found.assigned_unit_id,
            custody
          }
        });
      } catch (e) {
        // do not fail creation if audit logging fails
        console.warn('createFound: failed to write audit log', e);
      }
    }

    // return created found item
    res.status(201).json({ ok: true, found });
  } catch (err) {
    console.error('createFound error', err);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * -----------------------------------------
 * PUBLIC LIST
 * - returns array of published found items
 * -----------------------------------------
 */
exports.listPublic = async (req, res) => {
  try {
    const items = await FoundItem.find({ status: 'public_unclaimed' })
      .select('item_name category photo_url date_found description assigned_unit_id')
      .populate('assigned_unit_id', 'name code')
      .sort({ created_at: -1 })
      .lean();

    res.json(items);
  } catch (err) {
    console.error('listPublic error', err);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * -----------------------------------------
 * MANAGER INBOX
 * - lists items assigned to manager's unit in relevant statuses
 * -----------------------------------------
 */
exports.managerInbox = async (req, res) => {
  try {
    if (!req.user || !req.user.unit_id) {
      return res.status(400).json({ error: 'Manager has no unit assigned' });
    }

    const unitId = req.user.unit_id;

    const items = await FoundItem.find({
      assigned_unit_id: unitId,
      status: {
        $in: [
          'to_be_retrieved',
          'secured_unclaimed',
          'pending_verification',
          'pending_claim_review'
        ]
      }
    })
      .populate('assigned_unit_id', 'name code')
      .sort({ created_at: -1 })
      .lean();

    res.json({ items });
  } catch (err) {
    console.error('managerInbox error', err);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * -----------------------------------------
 * MANAGER: VERIFY ITEM
 * - transitions item -> pending_verification and appends status log
 * -----------------------------------------
 */
exports.verifyItem = async (req, res) => {
  try {
    const { id } = req.params;
    const actor = req.user ? req.user.id : null;

    const item = await FoundItem.findById(id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    if (!['secured_unclaimed', 'to_be_retrieved'].includes(item.status)) {
      return res.status(400).json({ error: `Cannot verify item in status ${item.status}` });
    }

    const prev = item.status;
    item.status = 'pending_verification';

    pushStatusLog(item, prev, item.status, actor, 'Manager verified item');

    await item.save();

    if (AuditLog) {
      try {
        await AuditLog.create({
          actor_id: actor,
          action: 'verify_found_item',
          target_type: 'FoundItem',
          target_id: item._id
        });
      } catch (e) { console.warn('verifyItem audit log failed', e); }
    }

    res.json({ ok: true, item });
  } catch (err) {
    console.error('verifyItem error', err);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * -----------------------------------------
 * MANAGER: PUBLISH TO PUBLIC
 * - transitions item -> public_unclaimed and appends status log
 * -----------------------------------------
 */
exports.publishToPublic = async (req, res) => {
  try {
    const { id } = req.params;
    const actor = req.user ? req.user.id : null;

    const item = await FoundItem.findById(id);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    if (item.status !== 'pending_verification') {
      return res.status(400).json({ error: 'Item must be pending_verification before publishing' });
    }

    const prev = item.status;
    item.status = 'public_unclaimed';

    pushStatusLog(item, prev, item.status, actor, 'Item published to public');

    await item.save();

    if (AuditLog) {
      try {
        await AuditLog.create({
          actor_id: actor,
          action: 'publish_found_item',
          target_type: 'FoundItem',
          target_id: item._id
        });
      } catch (e) { console.warn('publishToPublic audit log failed', e); }
    }

    res.json({ ok: true, item });
  } catch (err) {
    console.error('publishToPublic error', err);
    res.status(500).json({ error: 'Server error' });
  }
};