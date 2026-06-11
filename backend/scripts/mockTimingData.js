const bcrypt = require('bcrypt');
const db = require('../src/config/db');

const donorSeed = {
  name: 'Timing Demo Donor',
  email: 'timing-demo-donor@sfs.com',
  password: 'timingdemo123',
  role: 'donor',
  phone: '0700000001',
  location: 'Timing Demo Kitchen',
  notification_mode: 'whatsapp'
};

const recipientSeeds = [
  {
    name: 'Timing Demo Recipient 1',
    email: 'timing-demo-recipient-1@sfs.com',
    password: 'timingdemo123',
    role: 'recipient',
    phone: '0700000002',
    location: 'Timing Demo Area 1',
    notification_mode: 'whatsapp'
  },
  {
    name: 'Timing Demo Recipient 2',
    email: 'timing-demo-recipient-2@sfs.com',
    password: 'timingdemo123',
    role: 'recipient',
    phone: '0700000003',
    location: 'Timing Demo Area 2',
    notification_mode: 'whatsapp'
  },
  {
    name: 'Timing Demo Recipient 3',
    email: 'timing-demo-recipient-3@sfs.com',
    password: 'timingdemo123',
    role: 'recipient',
    phone: '0700000004',
    location: 'Timing Demo Area 3',
    notification_mode: 'whatsapp'
  }
];

const scenarioName = (process.argv[2] || 'morning').toLowerCase();

function makeTimestamp(daysAgo, hour, minute = 0) {
  const value = new Date();
  value.setDate(value.getDate() - daysAgo);
  value.setHours(hour, minute, 0, 0);
  return value;
}

function buildScenario(name) {
  if (name === 'afternoon') {
    return [
      { food_type: 'Morning fruit packs', quantity: 4, location: 'Campus canteen', is_discounted: false, discount_price: null, postHour: 8, delayMinutes: 210, claimed: true, recipientIndex: 0, daysAgo: 6 },
      { food_type: 'Morning sandwich boxes', quantity: 5, location: 'North gate', is_discounted: false, discount_price: null, postHour: 9, delayMinutes: 180, claimed: true, recipientIndex: 1, daysAgo: 6 },
      { food_type: 'Late breakfast muffins', quantity: 3, location: 'Library entrance', is_discounted: true, discount_price: 1.2, postHour: 10, delayMinutes: 160, claimed: true, recipientIndex: 2, daysAgo: 5 },
      { food_type: 'Lunch rice trays', quantity: 6, location: 'Dorm block A', is_discounted: false, discount_price: null, postHour: 12, delayMinutes: 30, claimed: true, recipientIndex: 0, daysAgo: 5 },
      { food_type: 'Discounted pasta bowls', quantity: 4, location: 'Dorm block B', is_discounted: true, discount_price: 1.5, postHour: 13, delayMinutes: 20, claimed: true, recipientIndex: 1, daysAgo: 4 },
      { food_type: 'Discounted soup pots', quantity: 5, location: 'Student centre', is_discounted: true, discount_price: 1.4, postHour: 14, delayMinutes: 15, claimed: true, recipientIndex: 2, daysAgo: 4 },
      { food_type: 'Afternoon stew packs', quantity: 5, location: 'East hall', is_discounted: false, discount_price: null, postHour: 15, delayMinutes: 25, claimed: true, recipientIndex: 0, daysAgo: 3 },
      { food_type: 'Discounted snack boxes', quantity: 4, location: 'Sports centre', is_discounted: true, discount_price: 1.1, postHour: 16, delayMinutes: 12, claimed: true, recipientIndex: 1, daysAgo: 3 },
      { food_type: 'Evening leftovers', quantity: 4, location: 'West gate', is_discounted: false, discount_price: null, postHour: 18, delayMinutes: null, claimed: false, recipientIndex: null, daysAgo: 2 },
      { food_type: 'Night bread bundles', quantity: 3, location: 'Main road', is_discounted: false, discount_price: null, postHour: 19, delayMinutes: null, claimed: false, recipientIndex: null, daysAgo: 2 }
    ];
  }

  return [
    { food_type: 'Early rice trays', quantity: 5, location: 'Campus canteen', is_discounted: false, discount_price: null, postHour: 8, delayMinutes: 18, claimed: true, recipientIndex: 0, daysAgo: 6 },
    { food_type: 'Discounted breakfast wraps', quantity: 4, location: 'North gate', is_discounted: true, discount_price: 1.1, postHour: 9, delayMinutes: 12, claimed: true, recipientIndex: 1, daysAgo: 6 },
    { food_type: 'Fresh fruit packs', quantity: 4, location: 'Library entrance', is_discounted: false, discount_price: null, postHour: 10, delayMinutes: 20, claimed: true, recipientIndex: 2, daysAgo: 5 },
    { food_type: 'Discounted muffins', quantity: 6, location: 'Dorm block A', is_discounted: true, discount_price: 1.3, postHour: 11, delayMinutes: 15, claimed: true, recipientIndex: 0, daysAgo: 5 },
    { food_type: 'Soup trays', quantity: 5, location: 'Student centre', is_discounted: false, discount_price: null, postHour: 13, delayMinutes: null, claimed: false, recipientIndex: null, daysAgo: 4 },
    { food_type: 'Bread bundles', quantity: 4, location: 'East hall', is_discounted: false, discount_price: null, postHour: 14, delayMinutes: null, claimed: false, recipientIndex: null, daysAgo: 4 },
    { food_type: 'Discounted pasta boxes', quantity: 5, location: 'Sports centre', is_discounted: true, discount_price: 1.4, postHour: 16, delayMinutes: 140, claimed: true, recipientIndex: 1, daysAgo: 3 },
    { food_type: 'Evening stew packs', quantity: 4, location: 'West gate', is_discounted: false, discount_price: null, postHour: 17, delayMinutes: 150, claimed: true, recipientIndex: 2, daysAgo: 3 },
    { food_type: 'Late night leftovers', quantity: 3, location: 'Main road', is_discounted: false, discount_price: null, postHour: 19, delayMinutes: null, claimed: false, recipientIndex: null, daysAgo: 2 },
    { food_type: 'Closing time snacks', quantity: 3, location: 'Gate 2', is_discounted: true, discount_price: 1.0, postHour: 20, delayMinutes: null, claimed: false, recipientIndex: null, daysAgo: 2 }
  ];
}

async function upsertUser(client, seed) {
  const existing = await client.query('SELECT * FROM users WHERE email = $1', [seed.email]);
  if (existing.rows[0]) {
    return existing.rows[0];
  }

  const hashedPassword = await bcrypt.hash(seed.password, 10);
  const result = await client.query(
    `INSERT INTO users (
      name,
      email,
      password,
      role,
      phone,
      location,
      notification_mode,
      verification_status,
      is_verified
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`,
    [
      seed.name,
      seed.email,
      hashedPassword,
      seed.role,
      seed.phone,
      seed.location,
      seed.notification_mode,
      seed.role === 'donor' ? 'verified' : 'unverified',
      seed.role === 'donor'
    ]
  );

  return result.rows[0];
}

async function clearExistingSeedData(client, donorId) {
  const foodIds = await client.query('SELECT id FROM food_items WHERE donor_id = $1', [donorId]);
  const ids = foodIds.rows.map((row) => row.id);

  if (ids.length > 0) {
    await client.query('DELETE FROM transactions WHERE food_id = ANY($1::int[])', [ids]);
    await client.query('DELETE FROM claims WHERE food_id = ANY($1::int[])', [ids]);
    await client.query('DELETE FROM food_items WHERE id = ANY($1::int[])', [ids]);
  }
}

async function seedScenario(client, donorId, recipients, scenarioRows) {
  for (const row of scenarioRows) {
    const createdAt = makeTimestamp(row.daysAgo, row.postHour);
    const insertedFood = await client.query(
      `INSERT INTO food_items (
        donor_id,
        food_type,
        quantity,
        location,
        expiry_time,
        status,
        is_discounted,
        discount_price,
        claimed_by,
        pickup_status,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id`,
      [
        donorId,
        row.food_type,
        row.quantity,
        row.location,
        new Date(createdAt.getTime() + 24 * 60 * 60 * 1000),
        row.claimed ? 'claimed' : 'available',
        row.is_discounted,
        row.discount_price,
        row.claimed ? recipients[row.recipientIndex].id : null,
        row.claimed ? 'picked_up' : 'not_picked',
        createdAt
      ]
    );

    if (row.claimed) {
      const claimedAt = new Date(createdAt.getTime() + row.delayMinutes * 60 * 1000);
      await client.query(
        `INSERT INTO claims (
          food_id,
          recipient_id,
          quantity,
          status,
          reservation_fee_paid,
          created_at
        ) VALUES ($1, $2, $3, 'picked_up', true, $4)`,
        [
          insertedFood.rows[0].id,
          recipients[row.recipientIndex].id,
          row.quantity,
          claimedAt
        ]
      );

      await client.query(
        `UPDATE food_items
         SET quantity = 0,
             status = 'claimed',
             claimed_by = $2,
             pickup_status = 'picked_up'
         WHERE id = $1`,
        [insertedFood.rows[0].id, recipients[row.recipientIndex].id]
      );
    }
  }
}

async function main() {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const donor = await upsertUser(client, donorSeed);
    const recipients = [];

    for (const recipientSeed of recipientSeeds) {
      recipients.push(await upsertUser(client, recipientSeed));
    }

    await clearExistingSeedData(client, donor.id);

    const scenarioRows = buildScenario(scenarioName);
    await seedScenario(client, donor.id, recipients, scenarioRows);

    await client.query('COMMIT');

    console.log(`Seeded timing demo data for scenario: ${scenarioName}`);
    console.log(`Donor: ${donor.email}`);
    console.log('Recipients: ' + recipients.map((recipient) => recipient.email).join(', '));
    console.log('Use the donor analytics endpoint to confirm the recommendation changes.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Timing mock data seed failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  buildScenario,
  makeTimestamp
};
