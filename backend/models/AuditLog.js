// backend/models/AuditLog.js
const { Schema, model } = require('mongoose');

const auditSchema = new Schema({
  actor_id: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  action: { type: String, required: true },     // 'promote','create_manager','demote', etc.
  target_type: String,                           // 'User'|'FoundItem'|'Claim'...
  target_id: Schema.Types.ObjectId,
  meta: Schema.Types.Mixed,
  created_at: { type: Date, default: Date.now }
});

module.exports = model('AuditLog', auditSchema);
