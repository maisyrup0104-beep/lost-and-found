// backend/controllers/claimController.js
const Claim = require('../models/Claim');
const FoundItem = require('../models/FoundItem');
const AuditLog = require('../models/AuditLog');

function pushClaimLog(claim, prev, curr, actor = null, note = null) {
  claim.status_log = claim.status_log || [];
  claim.status_log.push({
    previous_status: prev,
    current_status: curr,
    actor_id: actor,
    note,
    timestamp: new Date()
  });
}

exports.createClaim = async (req, res) => {
  try {
    // prefer uploaded file URL if available (routes attach req.file)
    // req.body.proof_url may already be set by attachFileUrl middleware, but check req.file directly too
    let { found_item_id, claimant_name, claimant_phone, proof_url, note } = req.body;

    if (req.file) {
      // If multer saved a file, construct the accessible URL path
      proof_url = `/uploads/${req.file.filename}`;
    }

    const claimant_id = req.user && req.user.id;
    if (!claimant_id) return res.status(401).json({ error: 'Not authenticated' });
    if (!found_item_id || !claimant_name) return res.status(400).json({ error: 'Missing required fields' });

    const item = await FoundItem.findById(found_item_id);
    if (!item) return res.status(404).json({ error: 'Found item not found' });

    // Only allow claims for items that are published to public.
    if (item.status !== 'public_unclaimed') {
      return res.status(400).json({ error: 'Item is not claimable at this time' });
    }

    // Create claim
    const claim = new Claim({
      found_item_id,
      claimant_id,
      claimant_name,
      claimant_phone: claimant_phone || null,
      proof_url: proof_url || null,
      note: note || null,
      status: 'pending_claim_review'
    });

    pushClaimLog(claim, null, 'pending_claim_review', claimant_id, 'Claim created by user');
    await claim.save();

    await AuditLog.create({
      actor_id: claimant_id,
      action: 'create_claim',
      target_type: 'Claim',
      target_id: claim._id,
      meta: { found_item_id, proof_url: claim.proof_url || null }
    });

    // IMPORTANT: Do NOT change the FoundItem.status here.
    // Keep item.status as-is (typically 'public_unclaimed') so it remains visible on the public list.
    // Append a status_log entry to record that a claim was submitted (optional, does not change visibility).
    if (item) {
      const prevItemStatus = item.status;
      item.status_log = item.status_log || [];
      item.status_log.push({
        previous_status: prevItemStatus,
        current_status: prevItemStatus, // no change to status
        actor_id: claimant_id,
        note: 'Claim submitted',
        timestamp: new Date()
      });
      await item.save();
    }

    res.status(201).json({ ok: true, claim });
  } catch (err) {
    console.error('createClaim error', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getUserClaims = async (req, res) => {
  try {
    const claimant_id = req.user && req.user.id;
    if (!claimant_id) return res.status(401).json({ error: 'Not authenticated' });

    const claims = await Claim.find({ claimant_id })
      .populate('found_item_id', 'item_name category status assigned_unit_id')
      .sort({ created_at: -1 })
      .lean();
    res.json({ claims });
  } catch (err) {
    console.error('getUserClaims error', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Manager: list pending claims for items assigned to their unit
exports.managerPendingClaims = async (req, res) => {
  try {
    if (!req.user || !req.user.unit_id) return res.status(400).json({ error: 'Manager has no unit assigned' });

    // Find claims where the found item's assigned_unit_id == manager.unit_id and claim.status == pending_claim_review
    const claims = await Claim.find({ status: 'pending_claim_review' })
      .populate({
        path: 'found_item_id',
        match: { assigned_unit_id: req.user.unit_id },
        select: 'item_name category description assigned_unit_id status'
      })
      .populate('claimant_id', 'name phone')
      .sort({ created_at: -1 })
      .lean();

    // filter out claims where found_item_id is null (populated but not matching unit)
    const filtered = claims.filter(c => c.found_item_id);
    res.json({ claims: filtered });
  } catch (err) {
    console.error('managerPendingClaims error', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Manager action: approve claim
exports.approveClaim = async (req, res) => {
  try {
    const { id } = req.params;
    const actor = req.user && req.user.id;
    const { manager_note } = req.body;

    const claim = await Claim.findById(id);
    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    if (claim.status !== 'pending_claim_review') return res.status(400).json({ error: 'Claim not in pending state' });

    // set claim approved
    const prev = claim.status;
    claim.status = 'approved';
    claim.manager_note = manager_note || null;
    pushClaimLog(claim, prev, 'approved', actor, manager_note || 'Approved by manager');
    await claim.save();

    // update found item status -> ready_for_pickup
    const item = await FoundItem.findById(claim.found_item_id);
    if (item) {
      const prevItemStatus = item.status;
      item.status = 'ready_for_pickup';
      item.status_log = item.status_log || [];
      item.status_log.push({
        previous_status: prevItemStatus,
        current_status: 'ready_for_pickup',
        actor_id: actor,
        note: 'Claim approved',
        timestamp: new Date()
      });
      await item.save();
    }

    await AuditLog.create({ actor_id: actor, action: 'approve_claim', target_type: 'Claim', target_id: claim._id });

    res.json({ ok: true, claim });
  } catch (err) {
    console.error('approveClaim error', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Manager action: reject claim
exports.rejectClaim = async (req, res) => {
  try {
    const { id } = req.params;
    const actor = req.user && req.user.id;
    const { manager_note } = req.body;

    const claim = await Claim.findById(id);
    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    if (claim.status !== 'pending_claim_review') return res.status(400).json({ error: 'Claim not in pending state' });

    const prev = claim.status;
    claim.status = 'rejected';
    claim.manager_note = manager_note || null;
    pushClaimLog(claim, prev, 'rejected', actor, manager_note || 'Rejected by manager');
    await claim.save();

    // optionally update found item back to public_unclaimed
    const item = await FoundItem.findById(claim.found_item_id);
    if (item) {
      const prevItemStatus = item.status;
      item.status = 'public_unclaimed';
      item.status_log = item.status_log || [];
      item.status_log.push({
        previous_status: prevItemStatus,
        current_status: 'public_unclaimed',
        actor_id: actor,
        note: 'Claim rejected',
        timestamp: new Date()
      });
      await item.save();
    }

    await AuditLog.create({ actor_id: actor, action: 'reject_claim', target_type: 'Claim', target_id: claim._id });

    res.json({ ok: true, claim });
  } catch (err) {
    console.error('rejectClaim error', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Optional: mark a claim as 'claimed' after owner picked up (manager)
exports.markClaimed = async (req, res) => {
  try {
    const { id } = req.params;
    const actor = req.user && req.user.id;

    const claim = await Claim.findById(id);
    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    if (!['approved','ready_for_pickup'].includes(claim.status)) {
      return res.status(400).json({ error: 'Claim not ready to mark as claimed' });
    }

    const prev = claim.status;
    claim.status = 'claimed';
    pushClaimLog(claim, prev, 'claimed', actor, 'Owner picked up item');
    await claim.save();

    // update found item status to claimed
    const item = await FoundItem.findById(claim.found_item_id);
    if (item) {
      const prevItem = item.status;
      item.status = 'claimed';
      item.status_log = item.status_log || [];
      item.status_log.push({
        previous_status: prevItem,
        current_status: 'claimed',
        actor_id: actor,
        note: 'Released to owner',
        timestamp: new Date()
      });
      await item.save();
    }

    await AuditLog.create({ actor_id: actor, action: 'mark_claimed', target_type: 'Claim', target_id: claim._id });

    res.json({ ok: true, claim });
  } catch (err) {
    console.error('markClaimed error', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Admin: list all claims (IT/admin)
exports.listAll = async (req, res) => {
  try {
    const claims = await Claim.find()
      .populate('found_item_id', 'item_name category assigned_unit_id')
      .populate('claimant_id', 'name phone email')
      .sort({ created_at: -1 })
      .lean();
    res.json({ claims });
  } catch (err) {
    console.error('listAll claims error', err);
    res.status(500).json({ error: 'Server error' });
  }
};