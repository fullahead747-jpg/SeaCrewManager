import { 
  type User, 
  type InsertUser, 
  type Vessel, 
  type InsertVessel,
  type CrewMember, 
  type InsertCrewMember,
  type CrewMemberWithDetails,
  type Contract,
  type InsertContract,
  type Document,
  type InsertDocument,
  type DocumentAlert,
  type CrewRotation,
  type InsertCrewRotation,
  type EmailSettings,
  type InsertEmailSettings,
  type ActivityLog,
  type InsertActivityLog,
  users,
  vessels,
  crewMembers,
  contracts,
  documents,
  crewRotations,
  emailSettings,
  activityLogs,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  
  // Vessel operations
  getVessels(): Promise<Vessel[]>;
  getVessel(id: string): Promise<Vessel | undefined>;
  createVessel(vessel: InsertVessel): Promise<Vessel>;
  updateVessel(id: string, vessel: Partial<InsertVessel>): Promise<Vessel | undefined>;
  deleteVessel(id: string): Promise<boolean>;
  
  // Crew member operations
  getCrewMembers(): Promise<CrewMemberWithDetails[]>;
  getCrewMember(id: string): Promise<CrewMemberWithDetails | undefined>;
  getCrewMembersByVessel(vesselId: string): Promise<CrewMemberWithDetails[]>;
  createCrewMember(crewMember: InsertCrewMember): Promise<CrewMember>;
  updateCrewMember(id: string, crewMember: Partial<InsertCrewMember>): Promise<CrewMember | undefined>;
  deleteCrewMember(id: string): Promise<boolean>;
  
  // Contract operations
  getContracts(): Promise<Contract[]>;
  getContractsByCrewMember(crewMemberId: string): Promise<Contract[]>;
  getActiveContract(crewMemberId: string): Promise<Contract | undefined>;
  createContract(contract: InsertContract): Promise<Contract>;
  updateContract(id: string, contract: Partial<InsertContract>): Promise<Contract | undefined>;
  getVesselContractStats(vesselId: string): Promise<{active: number, expiringSoon: number, expired: number}>;
  getVesselContracts(vesselId: string, status?: string): Promise<Array<Contract & {crewMember: CrewMember}>>;
  
  // Document operations
  getDocuments(): Promise<Document[]>;
  getDocumentsByCrewMember(crewMemberId: string): Promise<Document[]>;
  getExpiringDocuments(days: number): Promise<DocumentAlert[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: string, document: Partial<InsertDocument>): Promise<Document | undefined>;
  deleteDocument(id: string): Promise<boolean>;
  
  // Crew rotation operations
  getCrewRotations(): Promise<CrewRotation[]>;
  getCrewRotationsByVessel(vesselId: string): Promise<CrewRotation[]>;
  createCrewRotation(rotation: InsertCrewRotation): Promise<CrewRotation>;
  updateCrewRotation(id: string, rotation: Partial<InsertCrewRotation>): Promise<CrewRotation | undefined>;
  deleteCrewRotation(id: string): Promise<boolean>;
  
  // Email settings operations
  getEmailSettings(): Promise<EmailSettings | undefined>;
  updateEmailSettings(settings: InsertEmailSettings): Promise<EmailSettings>;
  
  // Activity log operations
  logActivity(activity: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogs(): Promise<ActivityLog[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  // Vessel operations
  async getVessels(): Promise<Vessel[]> {
    return await db.select().from(vessels);
  }

  async getVessel(id: string): Promise<Vessel | undefined> {
    const [vessel] = await db.select().from(vessels).where(eq(vessels.id, id));
    return vessel || undefined;
  }

  async createVessel(vessel: InsertVessel): Promise<Vessel> {
    const [newVessel] = await db
      .insert(vessels)
      .values(vessel)
      .returning();
    return newVessel;
  }

  async updateVessel(id: string, vessel: Partial<InsertVessel>): Promise<Vessel | undefined> {
    const [updated] = await db
      .update(vessels)
      .set(vessel)
      .where(eq(vessels.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteVessel(id: string): Promise<boolean> {
    // First, unassign any crew members from this vessel
    await db
      .update(crewMembers)
      .set({ currentVesselId: null })
      .where(eq(crewMembers.currentVesselId, id));
    
    const result = await db.delete(vessels).where(eq(vessels.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Crew member operations
  async getCrewMembers(): Promise<CrewMemberWithDetails[]> {
    const crewList = await db.select().from(crewMembers);
    
    const detailedCrew = await Promise.all(crewList.map(async (member) => {
      const user = member.userId ? await this.getUser(member.userId) : undefined;
      const currentVessel = member.currentVesselId ? await this.getVessel(member.currentVesselId) : undefined;
      const memberDocuments = await this.getDocumentsByCrewMember(member.id);
      const activeContract = await this.getActiveContract(member.id);
      
      return {
        ...member,
        user,
        currentVessel,
        documents: memberDocuments,
        activeContract,
      };
    }));

    return detailedCrew;
  }

  async getCrewMember(id: string): Promise<CrewMemberWithDetails | undefined> {
    const [member] = await db.select().from(crewMembers).where(eq(crewMembers.id, id));
    if (!member) return undefined;

    const user = member.userId ? await this.getUser(member.userId) : undefined;
    const currentVessel = member.currentVesselId ? await this.getVessel(member.currentVesselId) : undefined;
    const memberDocuments = await this.getDocumentsByCrewMember(member.id);
    const activeContract = await this.getActiveContract(member.id);

    return {
      ...member,
      user,
      currentVessel,
      documents: memberDocuments,
      activeContract,
    };
  }

  async getCrewMembersByVessel(vesselId: string): Promise<CrewMemberWithDetails[]> {
    const vesselCrew = await db.select().from(crewMembers).where(eq(crewMembers.currentVesselId, vesselId));
    
    const detailedCrew = await Promise.all(vesselCrew.map(async (member) => {
      const user = member.userId ? await this.getUser(member.userId) : undefined;
      const currentVessel = await this.getVessel(vesselId);
      const memberDocuments = await this.getDocumentsByCrewMember(member.id);
      const activeContract = await this.getActiveContract(member.id);
      
      return {
        ...member,
        user,
        currentVessel,
        documents: memberDocuments,
        activeContract,
      };
    }));

    return detailedCrew;
  }

  async createCrewMember(crewMember: InsertCrewMember): Promise<CrewMember> {
    const [newCrewMember] = await db
      .insert(crewMembers)
      .values(crewMember)
      .returning();
    return newCrewMember;
  }

  async updateCrewMember(id: string, crewMember: Partial<InsertCrewMember>): Promise<CrewMember | undefined> {
    const [updated] = await db
      .update(crewMembers)
      .set(crewMember)
      .where(eq(crewMembers.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteCrewMember(id: string): Promise<boolean> {
    try {
      // First delete related documents
      await db.delete(documents).where(eq(documents.crewMemberId, id));
      
      // Delete related contracts
      await db.delete(contracts).where(eq(contracts.crewMemberId, id));
      
      // Delete related crew rotations
      await db.delete(crewRotations).where(eq(crewRotations.crewMemberId, id));
      
      // Finally delete the crew member
      const result = await db.delete(crewMembers).where(eq(crewMembers.id, id));
      
      return true;
    } catch (error) {
      console.error('Error deleting crew member:', error);
      return false;
    }
  }

  // Contract operations
  async getContracts(): Promise<Contract[]> {
    return await db.select().from(contracts);
  }

  async getContractsByCrewMember(crewMemberId: string): Promise<Contract[]> {
    return await db.select().from(contracts).where(eq(contracts.crewMemberId, crewMemberId));
  }

  async getActiveContract(crewMemberId: string): Promise<Contract | undefined> {
    const [contract] = await db
      .select()
      .from(contracts)
      .where(and(eq(contracts.crewMemberId, crewMemberId), eq(contracts.status, 'active')));
    return contract || undefined;
  }

  async createContract(contract: InsertContract): Promise<Contract> {
    const [newContract] = await db
      .insert(contracts)
      .values(contract)
      .returning();
    return newContract;
  }

  async updateContract(id: string, contract: Partial<InsertContract>): Promise<Contract | undefined> {
    const [updated] = await db
      .update(contracts)
      .set(contract)
      .where(eq(contracts.id, id))
      .returning();
    return updated || undefined;
  }

  // Document operations
  async getDocuments(): Promise<Document[]> {
    return await db.select().from(documents);
  }

  async getDocumentsByCrewMember(crewMemberId: string): Promise<Document[]> {
    return await db.select().from(documents).where(eq(documents.crewMemberId, crewMemberId));
  }

  async getExpiringDocuments(days: number): Promise<DocumentAlert[]> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + (days * 24 * 60 * 60 * 1000));
    
    const expiringDocs = await db
      .select()
      .from(documents)
      .where(and(
        lte(documents.expiryDate, futureDate),
        gte(documents.expiryDate, now)
      ));

    const alerts: DocumentAlert[] = [];
    
    for (const doc of expiringDocs) {
      const member = await this.getCrewMember(doc.crewMemberId);
      if (member) {
        const daysUntilExpiry = Math.ceil((doc.expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        const severity = daysUntilExpiry <= 7 ? 'critical' : daysUntilExpiry <= 15 ? 'warning' : 'info';
        
        alerts.push({
          document: doc,
          crewMember: member,
          daysUntilExpiry,
          severity: severity as 'critical' | 'warning' | 'info',
        });
      }
    }

    return alerts;
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const [newDocument] = await db
      .insert(documents)
      .values(document)
      .returning();
    return newDocument;
  }

  async updateDocument(id: string, document: Partial<InsertDocument>): Promise<Document | undefined> {
    const [updated] = await db
      .update(documents)
      .set(document)
      .where(eq(documents.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteDocument(id: string): Promise<boolean> {
    const result = await db.delete(documents).where(eq(documents.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Crew rotation operations
  async getCrewRotations(): Promise<CrewRotation[]> {
    return await db.select().from(crewRotations);
  }

  async getCrewRotationsByVessel(vesselId: string): Promise<CrewRotation[]> {
    return await db.select().from(crewRotations).where(eq(crewRotations.vesselId, vesselId));
  }

  async createCrewRotation(rotation: InsertCrewRotation): Promise<CrewRotation> {
    const [newRotation] = await db
      .insert(crewRotations)
      .values(rotation)
      .returning();
    return newRotation;
  }

  async updateCrewRotation(id: string, rotation: Partial<InsertCrewRotation>): Promise<CrewRotation | undefined> {
    const [updated] = await db
      .update(crewRotations)
      .set(rotation)
      .where(eq(crewRotations.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteCrewRotation(id: string): Promise<boolean> {
    const result = await db.delete(crewRotations).where(eq(crewRotations.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Email settings operations
  async getEmailSettings(): Promise<EmailSettings | undefined> {
    const [settings] = await db.select().from(emailSettings).limit(1);
    return settings || undefined;
  }

  async updateEmailSettings(settings: InsertEmailSettings): Promise<EmailSettings> {
    const existing = await this.getEmailSettings();
    
    if (existing) {
      const [updated] = await db
        .update(emailSettings)
        .set(settings)
        .where(eq(emailSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(emailSettings)
        .values(settings)
        .returning();
      return created;
    }
  }

  async getVesselContractStats(vesselId: string): Promise<{active: number, expiringSoon: number, expired: number}> {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const vesselContracts = await db
      .select()
      .from(contracts)
      .innerJoin(crewMembers, eq(contracts.crewMemberId, crewMembers.id))
      .where(eq(crewMembers.currentVesselId, vesselId));
    
    const stats = {
      active: 0,
      expiringSoon: 0,
      expired: 0
    };
    
    for (const { contracts: contract } of vesselContracts) {
      if (contract.status !== 'active') continue;
      
      if (contract.endDate < now) {
        stats.expired++;
      } else if (contract.endDate <= thirtyDaysFromNow) {
        stats.expiringSoon++;
      } else {
        stats.active++;
      }
    }
    
    return stats;
  }

  async getVesselContracts(vesselId: string, status?: string): Promise<Array<Contract & {crewMember: CrewMember}>> {
    const query = db
      .select()
      .from(contracts)
      .innerJoin(crewMembers, eq(contracts.crewMemberId, crewMembers.id))
      .where(eq(crewMembers.currentVesselId, vesselId));
      
    const results = await query;
    
    const contractsWithCrew = results.map(row => ({
      ...row.contracts,
      crewMember: row.crew_members
    }));
    
    if (status) {
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      return contractsWithCrew.filter(contract => {
        if (status === 'active') {
          return contract.status === 'active' && contract.endDate > thirtyDaysFromNow;
        } else if (status === 'expiring') {
          return contract.status === 'active' && contract.endDate <= thirtyDaysFromNow && contract.endDate >= now;
        } else if (status === 'expired') {
          return contract.endDate < now;
        }
        return contract.status === status;
      });
    }
    
    return contractsWithCrew;
  }
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private vessels: Map<string, Vessel>;
  private crewMembers: Map<string, CrewMember>;
  private contracts: Map<string, Contract>;
  private documents: Map<string, Document>;
  private crewRotations: Map<string, CrewRotation>;
  private emailSettings: EmailSettings | undefined;

  constructor() {
    this.users = new Map();
    this.vessels = new Map();
    this.crewMembers = new Map();
    this.contracts = new Map();
    this.documents = new Map();
    this.crewRotations = new Map();
    this.initializeData();
  }

  private initializeData() {
    // Create default admin user
    const adminUser: User = {
      id: randomUUID(),
      username: "admin",
      password: "admin123", // In real app, this would be hashed
      role: "admin",
      email: "admin@crewtrack.com",
      name: "John Smith",
      createdAt: new Date(),
    };
    this.users.set(adminUser.id, adminUser);

    // Create office staff user
    const officeStaffUser: User = {
      id: randomUUID(),
      username: "office",
      password: "office123",
      role: "office_staff",
      email: "office@crewtrack.com",
      name: "Sarah Wilson",
      createdAt: new Date(),
    };
    this.users.set(officeStaffUser.id, officeStaffUser);

    // Create sample vessels
    const vessel1: Vessel = {
      id: randomUUID(),
      name: "MV Ocean Pioneer",
      type: "Container Ship",
      imoNumber: "1234567",
      flag: "Panama",
      status: "active",
      createdAt: new Date(),
    };
    const vessel2: Vessel = {
      id: randomUUID(),
      name: "MV Maritime Explorer",
      type: "Bulk Carrier",
      imoNumber: "2345678",
      flag: "Liberia",
      status: "active",
      createdAt: new Date(),
    };
    const vessel3: Vessel = {
      id: randomUUID(),
      name: "MV Deep Blue",
      type: "Tanker",
      imoNumber: "3456789",
      flag: "Singapore",
      status: "maintenance",
      createdAt: new Date(),
    };

    const vessel4: Vessel = {
      id: randomUUID(),
      name: "MV Nordic Explorer",
      type: "Ro-Ro Ferry",
      imoNumber: "4567890",
      flag: "Norway",
      status: "active",
      createdAt: new Date(),
    };

    const vessel5: Vessel = {
      id: randomUUID(),
      name: "MV Pacific Voyager",
      type: "Container Ship",
      imoNumber: "5678901",
      flag: "Marshall Islands",
      status: "in-port",
      createdAt: new Date(),
    };

    const vessel6: Vessel = {
      id: randomUUID(),
      name: "MV Arctic Breeze",
      type: "Oil Tanker",
      imoNumber: "6789012",
      flag: "Denmark",
      status: "active",
      createdAt: new Date(),
    };

    const vessel7: Vessel = {
      id: randomUUID(),
      name: "Sagar",
      type: "Container Ship",
      imoNumber: "IMO1234567",
      flag: "India",
      status: "active",
      createdAt: new Date("2025-08-13"),
    };
    
    this.vessels.set(vessel1.id, vessel1);
    this.vessels.set(vessel2.id, vessel2);
    this.vessels.set(vessel3.id, vessel3);
    this.vessels.set(vessel4.id, vessel4);
    this.vessels.set(vessel5.id, vessel5);
    this.vessels.set(vessel6.id, vessel6);
    this.vessels.set(vessel7.id, vessel7);



    // Create sample crew members
    const crewMember1: CrewMember = {
      id: randomUUID(),
      userId: null,
      firstName: "Robert",
      lastName: "Johnson",
      nationality: "United Kingdom",
      dateOfBirth: new Date("1975-03-15"),
      rank: "Captain",
      phoneNumber: "+44-123-456-7890",
      emergencyContact: {
        name: "Sarah Johnson",
        relationship: "Wife",
        phone: "+44-123-456-7891",
        email: "sarah.j@email.com"
      },
      currentVesselId: vessel3.id,
      status: "active",
      createdAt: new Date(),
    };

    const crewMember2: CrewMember = {
      id: randomUUID(),
      userId: null,
      firstName: "Michael",
      lastName: "Santos",
      nationality: "Philippines",
      dateOfBirth: new Date("1985-07-22"),
      rank: "Chief Engineer",
      phoneNumber: "+63-123-456-7890",
      emergencyContact: {
        name: "Maria Santos",
        relationship: "Wife",
        phone: "+63-123-456-7891",
        email: "maria.s@email.com"
      },
      currentVesselId: vessel1.id,
      status: "active",
      createdAt: new Date(),
    };

    const crewMember3: CrewMember = {
      id: randomUUID(),
      userId: null,
      firstName: "Anna",
      lastName: "Kowalski",
      nationality: "Poland",
      dateOfBirth: new Date("1990-11-08"),
      rank: "2nd Officer",
      phoneNumber: "+48-123-456-7890",
      emergencyContact: {
        name: "Jan Kowalski",
        relationship: "Father",
        phone: "+48-123-456-7891",
        email: "jan.k@email.com"
      },
      currentVesselId: vessel2.id,
      status: "active",
      createdAt: new Date(),
    };

    // Add more crew members for other vessels
    const crewMember4: CrewMember = {
      id: randomUUID(),
      userId: null,
      firstName: "Carlos",
      lastName: "Rodriguez",
      nationality: "Spain",
      dateOfBirth: new Date("1988-03-15"),
      rank: "Chief Cook",
      phoneNumber: "+34-123-456-7890",
      emergencyContact: {
        name: "Maria Rodriguez",
        relationship: "Wife",
        phone: "+34-123-456-7891",
        email: "maria.r@email.com"
      },
      currentVesselId: vessel4.id,
      status: "active",
      createdAt: new Date(),
    };

    const crewMember5: CrewMember = {
      id: randomUUID(),
      userId: null,
      firstName: "Erik",
      lastName: "Larsen",
      nationality: "Norway",
      dateOfBirth: new Date("1982-09-22"),
      rank: "Bosun",
      phoneNumber: "+47-123-456-7890",
      emergencyContact: {
        name: "Ingrid Larsen",
        relationship: "Wife",
        phone: "+47-123-456-7891",
        email: "ingrid.l@email.com"
      },
      currentVesselId: vessel5.id,
      status: "active",
      createdAt: new Date(),
    };

    // Add unassigned crew members for testing assignment functionality
    const crewMember6: CrewMember = {
      id: randomUUID(),
      userId: null,
      firstName: "David",
      lastName: "Chen",
      nationality: "Singapore",
      dateOfBirth: new Date("1987-06-12"),
      rank: "3rd Officer",
      phoneNumber: "+65-123-456-7890",
      emergencyContact: {
        name: "Lisa Chen",
        relationship: "Wife",
        phone: "+65-123-456-7891",
        email: "lisa.c@email.com"
      },
      currentVesselId: null, // Unassigned
      status: "active",
      createdAt: new Date(),
    };

    const crewMember7: CrewMember = {
      id: randomUUID(),
      userId: null,
      firstName: "Marco",
      lastName: "Rossi",
      nationality: "Italy",
      dateOfBirth: new Date("1984-02-28"),
      rank: "Electrician",
      phoneNumber: "+39-123-456-7890",
      emergencyContact: {
        name: "Sofia Rossi",
        relationship: "Wife",
        phone: "+39-123-456-7891",
        email: "sofia.r@email.com"
      },
      currentVesselId: null, // Unassigned
      status: "active",
      createdAt: new Date(),
    };

    const crewMember8: CrewMember = {
      id: randomUUID(),
      userId: null,
      firstName: "Ahmed",
      lastName: "Hassan",
      nationality: "Egypt",
      dateOfBirth: new Date("1991-10-15"),
      rank: "Able Seaman",
      phoneNumber: "+20-123-456-7890",
      emergencyContact: {
        name: "Fatima Hassan",
        relationship: "Mother",
        phone: "+20-123-456-7891",
        email: "fatima.h@email.com"
      },
      currentVesselId: null, // Unassigned
      status: "active",
      createdAt: new Date(),
    };

    this.crewMembers.set(crewMember1.id, crewMember1);
    this.crewMembers.set(crewMember2.id, crewMember2);
    this.crewMembers.set(crewMember3.id, crewMember3);
    this.crewMembers.set(crewMember4.id, crewMember4);
    this.crewMembers.set(crewMember5.id, crewMember5);
    this.crewMembers.set(crewMember6.id, crewMember6);
    this.crewMembers.set(crewMember7.id, crewMember7);
    this.crewMembers.set(crewMember8.id, crewMember8);

    // Create sample contracts
    const contract1: Contract = {
      id: randomUUID(),
      crewMemberId: crewMember1.id,
      vesselId: vessel3.id,
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-07-01"),
      durationDays: 182, // 6 months
      salary: 8000,
      currency: "USD",
      status: "active",
      createdAt: new Date(),
    };

    const contract2: Contract = {
      id: randomUUID(),
      crewMemberId: crewMember2.id,
      vesselId: vessel1.id,
      startDate: new Date("2023-11-01"),
      endDate: new Date("2024-05-01"),
      durationDays: 182, // 6 months
      salary: 6500,
      currency: "USD",
      status: "active",
      createdAt: new Date(),
    };

    const contract3: Contract = {
      id: randomUUID(),
      crewMemberId: crewMember3.id,
      vesselId: vessel2.id,
      startDate: new Date("2024-02-15"),
      endDate: new Date("2024-08-15"),
      durationDays: 182, // 6 months
      salary: 5500,
      currency: "USD",
      status: "active",
      createdAt: new Date(),
    };

    // Add contracts for additional crew members
    const contract4: Contract = {
      id: randomUUID(),
      crewMemberId: crewMember4.id,
      vesselId: vessel4.id,
      startDate: new Date("2024-03-01"),
      endDate: new Date("2025-03-01"),
      durationDays: 365, // 1 year
      salary: 4500,
      currency: "USD",
      status: "active",
      createdAt: new Date(),
    };

    const contract5: Contract = {
      id: randomUUID(),
      crewMemberId: crewMember5.id,
      vesselId: vessel5.id,
      startDate: new Date("2024-01-15"),
      endDate: new Date("2025-01-15"),
      durationDays: 365, // 1 year
      salary: 5000,
      currency: "USD",
      status: "active",
      createdAt: new Date(),
    };

    // Add more contracts with varied expiry dates for demonstration
    const contract6: Contract = {
      id: randomUUID(),
      crewMemberId: crewMember1.id,
      vesselId: vessel1.id,
      startDate: new Date("2024-06-01"),
      endDate: new Date("2025-08-25"), // Expiring in ~12 days
      durationDays: 450, // ~15 months
      salary: 6500,
      currency: "USD",
      status: "active",
      createdAt: new Date(),
    };

    const contract7: Contract = {
      id: randomUUID(),
      crewMemberId: crewMember2.id,
      vesselId: vessel2.id,
      startDate: new Date("2024-09-01"),
      endDate: new Date("2025-08-18"), // Expiring in ~4 days
      durationDays: 351, // ~11.5 months  
      salary: 5800,
      currency: "USD",
      status: "active",
      createdAt: new Date(),
    };

    const contract8: Contract = {
      id: randomUUID(),
      crewMemberId: crewMember3.id,
      vesselId: vessel2.id,
      startDate: new Date("2024-08-01"),
      endDate: new Date("2025-08-20"), // Expiring within 30 days
      durationDays: 354, // ~11.5 months
      salary: 5200,
      currency: "USD",
      status: "active",
      createdAt: new Date(),
    };

    this.contracts.set(contract1.id, contract1);
    this.contracts.set(contract2.id, contract2);
    this.contracts.set(contract3.id, contract3);
    this.contracts.set(contract4.id, contract4);
    this.contracts.set(contract5.id, contract5);
    this.contracts.set(contract6.id, contract6);
    this.contracts.set(contract7.id, contract7);
    this.contracts.set(contract8.id, contract8);

    // Create sample documents with some expiring soon
    const documents = [
      {
        id: randomUUID(),
        crewMemberId: crewMember3.id,
        type: "stcw",
        documentNumber: "STCW-2024-001",
        issueDate: new Date("2022-01-15"),
        expiryDate: new Date("2025-01-22"), // Expiring in 7 days from Aug 12, 2025
        issuingAuthority: "Polish Maritime Authority",
        status: "expiring",
        filePath: null,
        createdAt: new Date(),
      },
      {
        id: randomUUID(),
        crewMemberId: crewMember2.id,
        type: "medical",
        documentNumber: "MED-2024-002",
        issueDate: new Date("2023-08-01"),
        expiryDate: new Date("2025-08-27"), // Expiring in 15 days
        issuingAuthority: "Philippine Health Authority",
        status: "expiring",
        filePath: null,
        createdAt: new Date(),
      },
      {
        id: randomUUID(),
        crewMemberId: crewMember1.id,
        type: "passport",
        documentNumber: "UK123456789",
        issueDate: new Date("2020-06-01"),
        expiryDate: new Date("2025-09-12"), // Expiring in 31 days
        issuingAuthority: "UK Passport Office",
        status: "valid",
        filePath: null,
        createdAt: new Date(),
      }
    ];

    documents.forEach(doc => this.documents.set(doc.id, doc));

    // Create sample crew rotations with upcoming events
    const rotation1: CrewRotation = {
      id: randomUUID(),
      crewMemberId: crewMember6.id, // David Chen - unassigned
      vesselId: vessel1.id, // MV Ocean Pioneer
      joinDate: new Date("2025-08-20"), // 6 days from now
      leaveDate: new Date("2025-12-20"),
      rotationType: "rotation",
      status: "scheduled",
      notes: "David Chen scheduled to join as 3rd Officer",
      createdAt: new Date(),
    };

    const rotation2: CrewRotation = {
      id: randomUUID(),
      crewMemberId: crewMember1.id, // James Anderson
      vesselId: vessel3.id, // Current vessel - Deep Blue
      joinDate: new Date("2024-06-01"), // Already joined
      leaveDate: new Date("2025-08-22"), // 8 days from now
      rotationType: "leave",
      status: "scheduled",
      notes: "End of contract rotation",
      createdAt: new Date(),
    };

    const rotation3: CrewRotation = {
      id: randomUUID(),
      crewMemberId: crewMember7.id, // Marco Rossi - unassigned
      vesselId: vessel4.id, // MV Nordic Explorer
      joinDate: new Date("2025-09-05"), // 22 days from now
      leaveDate: null,
      rotationType: "join",
      status: "scheduled",
      notes: "Marco Rossi joining as Electrician",
      createdAt: new Date(),
    };

    const rotation4: CrewRotation = {
      id: randomUUID(),
      crewMemberId: crewMember2.id, // Miguel Santos
      vesselId: vessel1.id, // Current vessel
      joinDate: new Date("2024-01-01"), // Already joined
      leaveDate: new Date("2025-08-17"), // 3 days from now - urgent!
      rotationType: "leave",
      status: "scheduled",
      notes: "Contract completion - urgent replacement needed",
      createdAt: new Date(),
    };

    this.crewRotations.set(rotation1.id, rotation1);
    this.crewRotations.set(rotation2.id, rotation2);
    this.crewRotations.set(rotation3.id, rotation3);
    this.crewRotations.set(rotation4.id, rotation4);

    // Initialize email settings
    this.emailSettings = {
      id: randomUUID(),
      reminderDays: [30, 15, 7],
      enabled: true,
      recipients: ['office_staff', 'admin'],
      emailTemplate: "Dear [Crew Member],\n\nYour [Document Type] is scheduled to expire on [Expiry Date]. Please contact your Fleet Administrator to discuss renewal arrangements.\n\nBest regards,\nCrewTrack Pro Team",
      updatedAt: new Date(),
    } as EmailSettings;
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id, createdAt: new Date() };
    this.users.set(id, user);
    return user;
  }

  // Vessel operations
  async getVessels(): Promise<Vessel[]> {
    return Array.from(this.vessels.values());
  }

  async getVessel(id: string): Promise<Vessel | undefined> {
    return this.vessels.get(id);
  }

  async createVessel(insertVessel: InsertVessel): Promise<Vessel> {
    const id = randomUUID();
    const vessel: Vessel = { 
      ...insertVessel,
      id, 
      createdAt: new Date(),
      imoNumber: insertVessel.imoNumber || null,
      status: insertVessel.status || 'active'
    };
    this.vessels.set(id, vessel);
    return vessel;
  }

  async updateVessel(id: string, updates: Partial<InsertVessel>): Promise<Vessel | undefined> {
    const vessel = this.vessels.get(id);
    if (!vessel) return undefined;
    
    const updated = { ...vessel, ...updates };
    this.vessels.set(id, updated);
    return updated;
  }

  async deleteVessel(id: string): Promise<boolean> {
    // First, unassign any crew members from this vessel
    const crewMembers = Array.from(this.crewMembers.values());
    for (const member of crewMembers) {
      if (member.currentVesselId === id) {
        member.currentVesselId = null;
      }
    }
    
    return this.vessels.delete(id);
  }

  // Crew member methods
  async createCrewMember(data: InsertCrewMember): Promise<CrewMember> {
    const id = crypto.randomUUID();
    const crewMember: CrewMember = {
      id,
      userId: data.userId || null,
      firstName: data.firstName,
      lastName: data.lastName,
      nationality: data.nationality,
      dateOfBirth: data.dateOfBirth,
      rank: data.rank,
      phoneNumber: data.phoneNumber || null,
      emergencyContact: data.emergencyContact || null,
      currentVesselId: data.currentVesselId || null,
      status: data.status || 'active',
      createdAt: new Date(),
    };
    
    this.crewMembers.set(id, crewMember);
    return crewMember;
  }

  // Crew member operations
  async getCrewMembers(): Promise<CrewMemberWithDetails[]> {
    const crewMembers = Array.from(this.crewMembers.values());
    return Promise.all(crewMembers.map(async (member) => {
      const user = await this.getUser(member.userId || '');
      const currentVessel = member.currentVesselId ? await this.getVessel(member.currentVesselId) : undefined;
      const documents = await this.getDocumentsByCrewMember(member.id);
      const activeContract = await this.getActiveContract(member.id);
      
      return {
        ...member,
        user,
        currentVessel,
        documents,
        activeContract,
      };
    }));
  }

  async getCrewMember(id: string): Promise<CrewMemberWithDetails | undefined> {
    const member = this.crewMembers.get(id);
    if (!member) return undefined;

    const user = member.userId ? await this.getUser(member.userId) : undefined;
    const currentVessel = member.currentVesselId ? await this.getVessel(member.currentVesselId) : undefined;
    const documents = await this.getDocumentsByCrewMember(member.id);
    const activeContract = await this.getActiveContract(member.id);

    return {
      ...member,
      user,
      currentVessel,
      documents,
      activeContract,
    };
  }

  async getCrewMembersByVessel(vesselId: string): Promise<CrewMemberWithDetails[]> {
    const allCrew = await this.getCrewMembers();
    return allCrew.filter(member => member.currentVesselId === vesselId);
  }



  async updateCrewMember(id: string, updates: Partial<InsertCrewMember>): Promise<CrewMember | undefined> {
    const member = this.crewMembers.get(id);
    if (!member) return undefined;
    
    const updated = { ...member, ...updates };
    this.crewMembers.set(id, updated);
    return updated;
  }

  async deleteCrewMember(id: string): Promise<boolean> {
    return this.crewMembers.delete(id);
  }

  // Contract operations
  async getContracts(): Promise<Contract[]> {
    return Array.from(this.contracts.values());
  }

  async getContractsByCrewMember(crewMemberId: string): Promise<Contract[]> {
    return Array.from(this.contracts.values()).filter(contract => contract.crewMemberId === crewMemberId);
  }

  async getActiveContract(crewMemberId: string): Promise<Contract | undefined> {
    return Array.from(this.contracts.values()).find(
      contract => contract.crewMemberId === crewMemberId && contract.status === 'active'
    );
  }

  async createContract(insertContract: InsertContract): Promise<Contract> {
    const id = randomUUID();
    const contract: Contract = { 
      ...insertContract, 
      id, 
      createdAt: new Date(),
      status: insertContract.status || 'active',
      salary: insertContract.salary || null,
      currency: insertContract.currency || 'USD',
      durationDays: insertContract.durationDays || null
    };
    this.contracts.set(id, contract);
    return contract;
  }

  async updateContract(id: string, updates: Partial<InsertContract>): Promise<Contract | undefined> {
    const contract = this.contracts.get(id);
    if (!contract) return undefined;
    
    const updated = { ...contract, ...updates };
    this.contracts.set(id, updated);
    return updated;
  }

  // Document operations
  async getDocuments(): Promise<Document[]> {
    return Array.from(this.documents.values());
  }

  async getDocumentsByCrewMember(crewMemberId: string): Promise<Document[]> {
    return Array.from(this.documents.values()).filter(doc => doc.crewMemberId === crewMemberId);
  }

  async getExpiringDocuments(days: number): Promise<DocumentAlert[]> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + (days * 24 * 60 * 60 * 1000));
    
    const expiringDocs = Array.from(this.documents.values()).filter(doc => {
      return doc.expiryDate <= futureDate && doc.expiryDate > now;
    });

    const alerts: DocumentAlert[] = [];
    
    for (const doc of expiringDocs) {
      const member = this.crewMembers.get(doc.crewMemberId);
      if (member) {
        const daysUntilExpiry = Math.ceil((doc.expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        const severity = daysUntilExpiry <= 7 ? 'critical' : daysUntilExpiry <= 15 ? 'warning' : 'info';
        
        alerts.push({
          document: doc,
          crewMember: member,
          daysUntilExpiry,
          severity,
        });
      }
    }

    return alerts.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const id = randomUUID();
    const document: Document = { 
      ...insertDocument, 
      id, 
      createdAt: new Date(),
      status: insertDocument.status || 'valid',
      filePath: insertDocument.filePath || null
    };
    this.documents.set(id, document);
    return document;
  }

  async updateDocument(id: string, updates: Partial<InsertDocument>): Promise<Document | undefined> {
    const document = this.documents.get(id);
    if (!document) return undefined;
    
    const updated = { ...document, ...updates };
    this.documents.set(id, updated);
    return updated;
  }

  async deleteDocument(id: string): Promise<boolean> {
    return this.documents.delete(id);
  }

  // Crew rotation operations
  async getCrewRotations(): Promise<CrewRotation[]> {
    return Array.from(this.crewRotations.values());
  }

  async getCrewRotationsByVessel(vesselId: string): Promise<CrewRotation[]> {
    return Array.from(this.crewRotations.values()).filter(rotation => rotation.vesselId === vesselId);
  }

  async createCrewRotation(insertRotation: InsertCrewRotation): Promise<CrewRotation> {
    const id = randomUUID();
    const rotation: CrewRotation = { 
      ...insertRotation, 
      id, 
      createdAt: new Date(),
      status: insertRotation.status || 'scheduled',
      leaveDate: insertRotation.leaveDate || null,
      notes: insertRotation.notes || null
    };
    this.crewRotations.set(id, rotation);
    return rotation;
  }

  async updateCrewRotation(id: string, updates: Partial<InsertCrewRotation>): Promise<CrewRotation | undefined> {
    const rotation = this.crewRotations.get(id);
    if (!rotation) return undefined;
    
    const updated = { ...rotation, ...updates };
    this.crewRotations.set(id, updated);
    return updated;
  }

  async deleteCrewRotation(id: string): Promise<boolean> {
    return this.crewRotations.delete(id);
  }

  async getVesselContractStats(vesselId: string): Promise<{active: number, expiringSoon: number, expired: number}> {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const stats = { active: 0, expiringSoon: 0, expired: 0 };
    
    for (const contract of Array.from(this.contracts.values())) {
      const crewMember = this.crewMembers.get(contract.crewMemberId);
      if (!crewMember || crewMember.currentVesselId !== vesselId || contract.status !== 'active') {
        continue;
      }
      
      if (contract.endDate < now) {
        stats.expired++;
      } else if (contract.endDate <= thirtyDaysFromNow) {
        stats.expiringSoon++;
      } else {
        stats.active++;
      }
    }
    
    return stats;
  }

  async getVesselContracts(vesselId: string, status?: string): Promise<Array<Contract & {crewMember: CrewMember}>> {
    const vesselContracts: Array<Contract & {crewMember: CrewMember}> = [];
    
    for (const contract of Array.from(this.contracts.values())) {
      const crewMember = this.crewMembers.get(contract.crewMemberId);
      if (!crewMember || crewMember.currentVesselId !== vesselId) {
        continue;
      }
      
      vesselContracts.push({
        ...contract,
        crewMember
      });
    }
    
    if (status) {
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      return vesselContracts.filter(contract => {
        if (status === 'active') {
          return contract.status === 'active' && contract.endDate > thirtyDaysFromNow;
        } else if (status === 'expiring') {
          return contract.status === 'active' && contract.endDate <= thirtyDaysFromNow && contract.endDate >= now;
        } else if (status === 'expired') {
          return contract.endDate < now;
        }
        return contract.status === status;
      });
    }
    
    return vesselContracts;
  }

  // Email settings operations
  async getEmailSettings(): Promise<EmailSettings | undefined> {
    return this.emailSettings;
  }

  async updateEmailSettings(settings: InsertEmailSettings): Promise<EmailSettings> {
    const updated: EmailSettings = {
      id: this.emailSettings?.id || randomUUID(),
      reminderDays: settings.reminderDays || [30, 15, 7],
      enabled: settings.enabled || true,
      recipients: settings.recipients || ['office_staff', 'admin'],
      emailTemplate: settings.emailTemplate || null,
      updatedAt: new Date(),
    };
    this.emailSettings = updated;
    return updated;
  }

  // Activity log operations
  async logActivity(activity: InsertActivityLog): Promise<ActivityLog> {
    const [log] = await db
      .insert(activityLogs)
      .values(activity)
      .returning();
    return log;
  }

  async getActivityLogs(): Promise<ActivityLog[]> {
    return await db
      .select()
      .from(activityLogs)
      .orderBy(sql`${activityLogs.createdAt} DESC`);
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }
}

export const storage = new DatabaseStorage();
