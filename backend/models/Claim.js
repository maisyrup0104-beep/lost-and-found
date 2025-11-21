// backend/models/Claim.js
const { Schema, model } = require('mongoose');

const claimStatus = [
  'pending_claim_review', // user submitted claim, manager reviews
  'approved',             // manager approved claim (owner must pick up)
  'rejected',             // manager rejected claim
  'ready_for_pickup',     // (optional extra state; could be same as approved)
  'claimed'               // final: item released
];

const claimSchema = new Schema({
  found_item_id: { type: Schema.Types.ObjectId, ref: 'FoundItem', required: true },
  claimant_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  claimant_name: { type: String, required: true },
  claimant_phone: { type: String, default: null },
  proof_url: { type: String, default: null }, // claim proof (optional file URL)
  note: { type: String, default: null },      // claimant's short explanation
  status: { type: String, enum: claimStatus, default: 'pending_claim_review' },
  manager_note: { type: String, default: null },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  status_log: [{
    previous_status: String,
    current_status: String,
    actor_id: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    note: String,
    timestamp: { type: Date, default: Date.now }
  }]
});

claimSchema.pre('save', function(next){
  this.updated_at = Date.now();
  next();
});

module.exports = model('Claim', claimSchema);
module.exports.claimStatus = claimStatus;
