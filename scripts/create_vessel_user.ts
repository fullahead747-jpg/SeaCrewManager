import { db } from '../server/db';
import { users, vessels } from '../shared/schema';
import { hashPassword } from '../server/auth';
import { eq, sql } from 'drizzle-orm';

async function run() {
  console.log('🔄 Updating DB schema for users.assigned_vessel_id if needed...');
  try {
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_vessel_id VARCHAR REFERENCES vessels(id);`);
    console.log('✅ Database schema updated successfully.');
  } catch (err) {
    console.error('⚠️ Error adding column (may already exist):', err);
  }

  // Find WORLD LEGACY vessel
  console.log('🔍 Looking up WORLD LEGACY vessel...');
  const allVessels = await db.select().from(vessels);
  const worldLegacy = allVessels.find(v => v.name.toUpperCase().includes('WORLD LEGACY'));

  if (!worldLegacy) {
    console.error('❌ Could not find vessel "WORLD LEGACY" in database. Vessels found:', allVessels.map(v => v.name));
    process.exit(1);
  }

  console.log(`✅ Found vessel "WORLD LEGACY" (ID: ${worldLegacy.id})`);

  const targetUsername = 'cruise@fullahead.in';
  const targetPassword = 'Cruise@1234!';
  const hashedPassword = await hashPassword(targetPassword);

  const existingUser = await db.select().from(users).where(eq(users.username, targetUsername));

  if (existingUser.length > 0) {
    console.log(`Updating existing user ${targetUsername}...`);
    await db.update(users)
      .set({
        password: hashedPassword,
        email: targetUsername,
        name: 'World Legacy Manager',
        role: 'vessel_user',
        assignedVesselId: worldLegacy.id,
      })
      .where(eq(users.username, targetUsername));
    console.log(`✅ User ${targetUsername} updated successfully!`);
  } else {
    console.log(`Creating new user ${targetUsername}...`);
    await db.insert(users).values({
      username: targetUsername,
      email: targetUsername,
      name: 'World Legacy Manager',
      password: hashedPassword,
      role: 'vessel_user',
      assignedVesselId: worldLegacy.id,
    });
    console.log(`✅ User ${targetUsername} created successfully!`);
  }

  console.log('Done!');
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
