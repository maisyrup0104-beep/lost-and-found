// backend/controllers/lostController.js
const LostReport = require('../models/LostReport');
const FoundItem = require('../models/FoundItem');
const AuditLog = require('../models/AuditLog'); // if you have one
const Unit = require('../models/Unit');
const path = require('path');

function extractKeywords(text) {
  return (text || '').toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 2);
}

exports.createLostReport = async (req, res) => {
  try {
    // If multer attached a file, prefer it
    let photo_url = null;
    if (req.file) {
      // serve path from /uploads/<filename>
      photo_url = `/uploads/${req.file.filename}`;
    } else {
      photo_url = req.body.photo_url || null;
    }

    const {
      reporter_name, reporter_phone, reporter_email,
      item_name, category, description,
      last_seen_unit, last_seen_details, date_last_seen,
      education_level, department
    } = req.body;

    if (!reporter_name || !reporter_phone || !item_name || !category || !description) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const report = await LostReport.create({
      reporter_id: req.user ? req.user.id : null,
      reporter_name,
      reporter_phone,
      reporter_email,
      item_name,
      category,
      description,
      last_seen_unit: last_seen_unit || null,
      last_seen_details: last_seen_details || null,
      date_last_seen: date_last_seen || null,
      education_level: education_level || null,
      department: department || null,
      photo_url: photo_url || null
    });

    // simple auto-match logic (category + keyword + unit)
    const keywords = extractKeywords(item_name + ' ' + description);
    if (keywords.length) {
      const query = {
        status: { $in: ['public_unclaimed', 'secured_unclaimed', 'pending_verification'] },
        category
      };
      if (last_seen_unit) query.assigned_unit_id = last_seen_unit;

      const candidates = await FoundItem.find(query).lean();
      const scored = candidates.map(c => {
        let score = 0;
        try {
          if (last_seen_unit && c.assigned_unit_id && c.assigned_unit_id.toString() === (last_seen_unit.toString ? last_seen_unit.toString() : last_seen_unit)) score += 2;
        } catch (e) { /* ignore */ }
        keywords.forEach(k => {
          if (c.item_name && c.item_name.toLowerCase().includes(k)) score += 2;
          if (c.description && c.description.toLowerCase().includes(k)) score += 1;
        });
        return { item: c, score };
      }).filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);

      report.potential_matches = scored.map(s => s.item._id);
      await report.save();
    }

    if (AuditLog) {
      try {
        await AuditLog.create({
          actor_id: req.user ? req.user.id : null,
          action: 'create_lost_report',
          target_type: 'LostReport',
          target_id: report._id,
          meta: {}
        });
      } catch (e) { /* ignore audit errors */ }
    }

    res.status(201).json({ ok: true, report, matches_preview: report.potential_matches || [] });
  } catch (err) {
    console.error('createLostReport', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getMyReports = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const reports = await LostReport.find({ reporter_id: req.user.id }).sort({ created_at: -1 }).lean();
    res.json({ reports });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getMatches = async (req, res) => {
  try {
    const { id } = req.params;
    const report = await LostReport.findById(id).populate('potential_matches').lean();
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json({ matches: report.potential_matches || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Admin: list all lost reports (IT/admin only)
exports.listAll = async (req, res) => {
  try {
    const reports = await LostReport.find({}).sort({ created_at: -1 }).lean();
    res.json({ reports });
  } catch (err) {
    console.error('listAll lost reports', err);
    res.status(500).json({ error: 'Server error' });
  }
};