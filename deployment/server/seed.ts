import { db } from './db';
import { users, vessels, crewMembers, contracts, documents, emailSettings, crewRotations } from '@shared/schema';

async function seedDatabase() {
  console.log('🌱 Seeding database...');

  try {
    // Create users
    const [adminUser] = await db.insert(users).values([
      {
        username: 'admin',
        password: 'admin123',
        role: 'admin',
        email: 'admin@crewtrack.com',
        name: 'System Administrator',
      }
    ]).onConflictDoNothing().returning();

    const [officeUser] = await db.insert(users).values([
      {
        username: 'office',
        password: 'demo123',
        role: 'office_staff',
        email: 'office@crewtrack.com',
        name: 'Office Staff',
      }
    ]).onConflictDoNothing().returning();

    // Create vessels
    const vesselData = [
      { name: "MV Ocean Explorer", type: "Container Ship", imoNumber: "IMO1234567", flag: "Panama", status: "active" },
      { name: "MV Pacific Star", type: "Bulk Carrier", imoNumber: "IMO2345678", flag: "Marshall Islands", status: "active" },
      { name: "MV Atlantic Wave", type: "Tanker", imoNumber: "IMO3456789", flag: "Liberia", status: "in-port" },
      { name: "MV Nordic Breeze", type: "General Cargo", imoNumber: "IMO4567890", flag: "Norway", status: "maintenance" },
      { name: "MV Mediterranean", type: "Container Ship", imoNumber: "IMO5678901", flag: "Malta", status: "active" },
      { name: "MV Caribbean Dream", type: "Passenger", imoNumber: "IMO6789012", flag: "Bahamas", status: "inactive" }
    ];

    const insertedVessels = await db.insert(vessels).values(vesselData).onConflictDoNothing().returning();

    // Create crew members
    const crewData = [
      {
        firstName: "James",
        lastName: "Anderson",
        nationality: "United Kingdom",
        dateOfBirth: new Date("1980-05-15"),
        rank: "Captain",
        phoneNumber: "+44-20-1234-5678",
        emergencyContact: {
          name: "Sarah Anderson",
          relationship: "Spouse",
          phone: "+44-20-8765-4321",
          email: "sarah.anderson@email.com"
        },
        currentVesselId: insertedVessels[0]?.id || null,
        status: "active"
      },
      {
        firstName: "Miguel",
        lastName: "Santos",
        nationality: "Philippines",
        dateOfBirth: new Date("1985-08-22"),
        rank: "Chief Engineer",
        phoneNumber: "+63-2-987-6543",
        emergencyContact: {
          name: "Maria Santos",
          relationship: "Mother",
          phone: "+63-2-123-4567",
          email: "maria.santos@email.com"
        },
        currentVesselId: insertedVessels[1]?.id || null,
        status: "active"
      },
      {
        firstName: "Anna",
        lastName: "Petrov",
        nationality: "Ukraine",
        dateOfBirth: new Date("1990-03-10"),
        rank: "Second Officer",
        phoneNumber: "+380-44-555-0123",
        emergencyContact: {
          name: "Viktor Petrov",
          relationship: "Father",
          phone: "+380-44-555-0456",
          email: "viktor.petrov@email.com"
        },
        currentVesselId: insertedVessels[0]?.id || null,
        status: "active"
      },
      {
        firstName: "Carlos",
        lastName: "Rodriguez",
        nationality: "Spain",
        dateOfBirth: new Date("1982-11-28"),
        rank: "Bosun",
        phoneNumber: "+34-91-123-4567",
        emergencyContact: {
          name: "Elena Rodriguez",
          relationship: "Wife",
          phone: "+34-91-765-4321",
          email: "elena.rodriguez@email.com"
        },
        currentVesselId: insertedVessels[2]?.id || null,
        status: "active"
      },
      {
        firstName: "Sagar",
        lastName: "Rana",
        nationality: "India",
        dateOfBirth: new Date("1988-07-14"),
        rank: "Able Seaman",
        phoneNumber: "+91-22-9876-5432",
        emergencyContact: {
          name: "Priya Rana",
          relationship: "Wife",
          phone: "+91-22-1234-5678",
          email: "priya.rana@email.com"
        },
        currentVesselId: insertedVessels[0]?.id || null,
        status: "active"
      }
    ];

    const insertedCrew = await db.insert(crewMembers).values(crewData).onConflictDoNothing().returning();

    // Create active contracts for crew members with upcoming expirations
    if (insertedCrew.length > 0 && insertedVessels.length > 0) {
      const contractData = [
        {
          crewMemberId: insertedCrew[0].id,
          vesselId: insertedCrew[0].currentVesselId || insertedVessels[0].id,
          startDate: new Date("2024-01-01"),
          endDate: new Date("2025-08-18"), // Expiring in 4 days
          salary: 5000,
          currency: "USD",
          status: "active" as const
        },
        {
          crewMemberId: insertedCrew[1].id,
          vesselId: insertedCrew[1].currentVesselId || insertedVessels[1].id,
          startDate: new Date("2024-01-01"),
          endDate: new Date("2025-08-25"), // Expiring in 11 days
          salary: 5500,
          currency: "USD",
          status: "active" as const
        },
        ...insertedCrew.slice(2).map((crew, index) => ({
          crewMemberId: crew.id,
          vesselId: crew.currentVesselId || insertedVessels[(index + 2) % insertedVessels.length].id,
          startDate: new Date("2024-01-01"),
          endDate: new Date("2025-12-31"), // Long-term contracts
          salary: 5000 + (index * 500),
          currency: "USD",
          status: "active" as const
        }))
      ];

      await db.insert(contracts).values(contractData).onConflictDoNothing();
    }

    // Create sample documents with upcoming expirations
    if (insertedCrew.length > 0) {
      const documentData = [
        {
          crewMemberId: insertedCrew[0].id,
          type: "passport",
          documentNumber: "UK123456789",
          issueDate: new Date("2020-01-15"),
          expiryDate: new Date("2025-08-20"), // Expiring in 6 days
          issuingAuthority: "UK Passport Office",
          status: "expiring"
        },
        {
          crewMemberId: insertedCrew[1].id,
          type: "medical",
          documentNumber: "MED-2024-001",
          issueDate: new Date("2024-01-15"),
          expiryDate: new Date("2025-08-20"), // Expiring in 6 days
          issuingAuthority: "Philippine Maritime Medical Center",
          status: "expiring"
        },
        {
          crewMemberId: insertedCrew[2].id,
          type: "stcw",
          documentNumber: "STCW-2024-002",
          issueDate: new Date("2022-01-15"),
          expiryDate: new Date("2025-08-16"), // Expiring in 2 days - URGENT
          issuingAuthority: "Ukrainian Maritime Authority",
          status: "expiring"
        },
        {
          crewMemberId: insertedCrew[3].id,
          type: "cdc",
          documentNumber: "CDC-ESP-54321",
          issueDate: new Date("2022-03-10"),
          expiryDate: new Date("2025-09-05"), // Expiring in 22 days
          issuingAuthority: "Spanish Maritime Authority",
          status: "valid"
        },
        {
          crewMemberId: insertedCrew[4].id,
          type: "medical",
          documentNumber: "MED-IND-2024",
          issueDate: new Date("2024-02-01"),
          expiryDate: new Date("2025-08-28"), // Expiring in 14 days
          issuingAuthority: "Directorate General of Shipping, India",
          status: "expiring"
        }
      ];

      await db.insert(documents).values(documentData).onConflictDoNothing();
    }

    // Create crew rotations with upcoming events
    if (insertedCrew.length > 0 && insertedVessels.length > 0) {
      const rotationData = [
        {
          crewMemberId: insertedCrew[0].id, // James Anderson
          vesselId: insertedVessels[0].id,
          joinDate: new Date("2024-01-01"),
          leaveDate: new Date("2025-08-17"), // Leaving in 3 days - URGENT
          rotationType: "leave",
          status: "scheduled",
          notes: "End of contract - replacement needed urgently"
        },
        {
          crewMemberId: insertedCrew[2].id, // Anna Petrov
          vesselId: insertedVessels[1].id,
          joinDate: new Date("2025-08-21"), // Joining in 7 days
          leaveDate: new Date("2026-02-21"),
          rotationType: "join",
          status: "scheduled",
          notes: "Anna joining as Second Officer"
        },
        {
          crewMemberId: insertedCrew[3].id, // Carlos Rodriguez
          vesselId: insertedVessels[2].id,
          joinDate: new Date("2024-01-01"),
          leaveDate: new Date("2025-09-10"), // Leaving in 27 days
          rotationType: "leave",
          status: "scheduled",
          notes: "Scheduled rotation end"
        }
      ];

      await db.insert(crewRotations).values(rotationData).onConflictDoNothing();
    }

    // Create email settings
    await db.insert(emailSettings).values([{
      reminderDays: [30, 15, 7],
      enabled: true,
      recipients: ['office_staff', 'admin'],
      emailTemplate: "Dear [Crew Member],\n\nYour [Document Type] is scheduled to expire on [Expiry Date]. Please contact your Fleet Administrator to discuss renewal arrangements.\n\nBest regards,\nCrewTrack Pro Team"
    }]).onConflictDoNothing();

    console.log('✅ Database seeded successfully!');
    console.log(`- Created ${insertedVessels.length} vessels`);
    console.log(`- Created ${insertedCrew.length} crew members`);
    console.log(`- Created ${insertedCrew.length} active contracts`);
    console.log('- Created sample documents and email settings');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
  }
}

export { seedDatabase };

// Run seed function if this file is executed directly
seedDatabase();