// backend/scripts/seed-found.js
require('dotenv').config();
const { connect } = require('../db');
const Unit = require('../models/Unit');
const FoundItem = require('../models/FoundItem');

async function run(){
  await connect();

  const lib = await Unit.findOne({ code: 'LIB' });
  const cent = await Unit.findOne({ code: 'CENT' });
  const gate = await Unit.findOne({ code: 'GATE' });

  const samples = [
    {
      item_name:'Black Jacket',
      category:'Clothing',
      description:'Small black jacket with hood',
      found_location_general: lib ? lib._id : (cent ? cent._id : null),
      found_location_details:'Left-side tables',
      custody:'B',
      assigned_unit_id: lib ? lib._id : (cent ? cent._id : null),
      status:'public_unclaimed'
    },
    {
      item_name:'iPhone (black)',
      category:'Electronics',
      description:'Black iPhone with floral case',
      found_location_general: gate ? gate._id : (cent ? cent._id : null),
      found_location_details:'Main Gate steps',
      custody:'B',
      assigned_unit_id: gate ? gate._id : (cent ? cent._id : null),
      status:'secured_unclaimed'
    },
    {
      item_name:'Blue Umbrella',
      category:'Personal Items',
      description:'Blue umbrella with wooden handle',
      found_location_general: cent ? cent._id : null,
      found_location_details:'Central Lost & Found counter',
      custody:'C',
      assigned_unit_id: cent ? cent._id : null,
      status:'pending_verification'
    }
  ];

  for (const s of samples) {
    await FoundItem.updateOne(
      { item_name: s.item_name, assigned_unit_id: s.assigned_unit_id },
      { $set: s },
      { upsert: true }
    );
  }

  console.log('Found samples seeded ✅');
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
