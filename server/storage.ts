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
  type ContractAlert,
  type VesselDocument,
  type InsertVesselDocument,
  type CrewRotation,
  type InsertCrewRotation,
  type EmailSettings,
  type InsertEmailSettings,
  type ActivityLog,
  type InsertActivityLog,
  type NotificationHistory,
  type InsertNotificationHistory,
  type WhatsappSettings,
  type InsertWhatsappSettings,
  users,
  vessels,
  crewMembers,
  contracts,
  documents,
  vesselDocuments,
  crewRotations,
  emailSettings,
  whatsappSettings,
  activityLogs,
  notificationHistory,
  scannedDocuments,
  statusChangeHistory,
  whatsappMessages,
  type WhatsappMessage,
  type InsertWhatsappMessage,
  type ScannedDocument,
  type InsertScannedDocument,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, sql, isNotNull, desc } from "drizzle-orm";
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
  updateVesselOrder(vesselIds: string[]): Promise<boolean>;

  // Crew member operations
  getCrewMembers(): Promise<CrewMemberWithDetails[]>;
  getCrewMember(id: string): Promise<CrewMemberWithDetails | undefined>;
  getCrewMembersByVessel(vesselId: string): Promise<CrewMemberWithDetails[]>;
  findDuplicateCrewMember(firstName: string, lastName: string, dateOfBirth: Date): Promise<CrewMember | undefined>;
  createCrewMember(crewMember: InsertCrewMember): Promise<CrewMember>;
  updateCrewMember(id: string, crewMember: Partial<InsertCrewMember>): Promise<CrewMember | undefined>;
  findCrewMemberByNameAndRank(name: string, rank: string): Promise<CrewMember | undefined>;
  deleteCrewMember(id: string): Promise<boolean>;

  // Contract operations
  getContracts(): Promise<Contract[]>;
  getContractsByCrewMember(crewMemberId: string): Promise<Contract[]>;
  getContract(id: string): Promise<Contract | undefined>;
  getActiveContract(crewMemberId: string): Promise<Contract | undefined>;
  createContract(contract: InsertContract): Promise<Contract>;
  updateContract(id: string, contract: Partial<InsertContract>): Promise<Contract | undefined>;
  getVesselContractStats(vesselId: string): Promise<{ active: number, expiringSoon: number, expired: number }>;
  getVesselContracts(vesselId: string, status?: string): Promise<Array<Contract & { crewMember: CrewMember }>>;

  // Document operations
  getDocuments(): Promise<Document[]>;
  getDocument(id: string): Promise<Document | undefined>;
  getDocumentsByCrewMember(crewMemberId: string): Promise<Document[]>;
  getExpiringDocuments(days: number): Promise<DocumentAlert[]>;
  getExpiringContracts(days: number): Promise<ContractAlert[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: string, document: Partial<InsertDocument>): Promise<Document | undefined>;
  deleteDocument(id: string): Promise<boolean>;

  // Scanned document operations (Shadow Truth)
  getScannedDocument(documentId: string): Promise<ScannedDocument | undefined>;
  createScannedDocument(scanned: InsertScannedDocument): Promise<ScannedDocument>;

  // Crew rotation operations
  getCrewRotations(): Promise<CrewRotation[]>;
  getCrewRotationsByVessel(vesselId: string): Promise<CrewRotation[]>;
  createCrewRotation(rotation: InsertCrewRotation): Promise<CrewRotation>;
  updateCrewRotation(id: string, rotation: Partial<InsertCrewRotation>): Promise<CrewRotation | undefined>;
  deleteCrewRotation(id: string): Promise<boolean>;

  // Email settings operations
  getEmailSettings(): Promise<EmailSettings | undefined>;
  updateEmailSettings(settings: InsertEmailSettings): Promise<EmailSettings>;

  // WhatsApp settings operations
  getWhatsappSettings(): Promise<WhatsappSettings | undefined>;
  updateWhatsappSettings(settings: InsertWhatsappSettings): Promise<WhatsappSettings>;

  // Vessel document operations
  getVesselDocuments(vesselId: string): Promise<VesselDocument[]>;
  getVesselDocument(id: string): Promise<VesselDocument | undefined>;
  createVesselDocument(document: InsertVesselDocument): Promise<VesselDocument>;
  updateVesselDocument(id: string, document: Partial<InsertVesselDocument>): Promise<VesselDocument | undefined>;
  deleteVesselDocument(id: string): Promise<boolean>;

  // Activity log operations
  logActivity(activity: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogs(): Promise<ActivityLog[]>;

  // Notification history operations
  logNotification(notification: InsertNotificationHistory): Promise<NotificationHistory>;
  getNotificationHistory(eventId: string, eventType: string, daysBeforeEvent: number): Promise<NotificationHistory[]>;
  hasNotificationBeenSent(eventId: string, eventType: string, daysBeforeEvent: number, provider: string): Promise<boolean>;
  hasNotificationBeenSentToday(eventId: string, eventType: string, provider: string, dateStr: string): Promise<boolean>;
  getFailedNotifications(maxRetries: number): Promise<NotificationHistory[]>;
  updateNotificationStatus(id: string, success: boolean, errorMessage?: string, retryCount?: number): Promise<NotificationHistory | undefined>;

  // WhatsApp message operations
  saveWhatsappMessage(message: InsertWhatsappMessage): Promise<WhatsappMessage>;
  getWhatsappMessages(remoteJid: string, limit?: number): Promise<WhatsappMessage[]>;
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
    return await db.select().from(vessels).orderBy(vessels.sortOrder);
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

  async updateVesselOrder(vesselIds: string[]): Promise<boolean> {
    try {
      // Update sort order for each vessel
      for (let i = 0; i < vesselIds.length; i++) {
        await db
          .update(vessels)
          .set({ sortOrder: i + 1 })
          .where(eq(vessels.id, vesselIds[i]));
      }
      return true;
    } catch (error) {
      console.error('Error updating vessel order:', error);
      return false;
    }
  }

  // Crew member operations
  async getCrewMembers(): Promise<CrewMemberWithDetails[]> {
    const crewList = await db.select().from(crewMembers);

    const detailedCrew = await Promise.all(crewList.map(async (member) => {
      const user = member.userId ? await this.getUser(member.userId) : undefined;
      const currentVessel = member.currentVesselId ? await this.getVessel(member.currentVesselId) : undefined;
      const lastVessel = member.lastVesselId ? await this.getVessel(member.lastVesselId) : undefined;
      const memberDocuments = await this.getDocumentsByCrewMember(member.id);
      const activeContract = await this.getActiveContract(member.id);

      return {
        ...member,
        user,
        currentVessel,
        lastVessel,
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

    const lastVessel = member.lastVesselId ? await this.getVessel(member.lastVesselId) : undefined;

    return {
      ...member,
      user,
      currentVessel,
      lastVessel,
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

  async findDuplicateCrewMember(firstName: string, lastName: string, dateOfBirth: Date): Promise<CrewMember | undefined> {
    if (!dateOfBirth || isNaN(dateOfBirth.getTime())) {
      console.error('Invalid dateOfBirth passed to findDuplicateCrewMember:', dateOfBirth);
      return undefined;
    }

    console.log('[DEBUG-SAVE-FIX-V2] Executing findDuplicateCrewMember:', { firstName, lastName, dateOfBirth });

    const results = await db.select().from(crewMembers).where(
      and(
        sql`LOWER(${crewMembers.firstName}) = LOWER(${firstName})`,
        sql`LOWER(${crewMembers.lastName}) = LOWER(${lastName})`,
        sql`CAST(${crewMembers.dateOfBirth} AS DATE) = CAST(${dateOfBirth} AS DATE)`
      )
    );
    return results[0] || undefined;
  }

  async createCrewMember(crewMember: InsertCrewMember): Promise<CrewMember> {
    const [newCrewMember] = await db
      .insert(crewMembers)
      .values(crewMember)
      .returning();
    return newCrewMember;
  }

  async findCrewMemberByNameAndRank(name: string, rank: string): Promise<CrewMember | undefined> {
    const normalizedName = name.replace(/\s+/g, ' ').trim().toLowerCase();
    const normalizedRank = rank.replace(/\s+/g, ' ').trim().toLowerCase();

    const allCrew = await db.select().from(crewMembers);

    const match = allCrew.find(member => {
      const memberFullName = `${member.firstName} ${member.lastName}`.replace(/\s+/g, ' ').trim().toLowerCase();
      const memberRank = member.rank.replace(/\s+/g, ' ').trim().toLowerCase();
      return memberFullName === normalizedName && memberRank === normalizedRank;
    });

    return match;
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
      const [existing] = await db.select().from(crewMembers).where(eq(crewMembers.id, id));

      if (!existing) {
        return false;
      }

      await db.delete(statusChangeHistory).where(eq(statusChangeHistory.crewMemberId, id));
      const crewDocuments = await db.select().from(documents).where(eq(documents.crewMemberId, id));

      for (const doc of crewDocuments) {
        await db.delete(scannedDocuments).where(eq(scannedDocuments.documentId, doc.id));
      }

      await db.delete(documents).where(eq(documents.crewMemberId, id));
      await db.delete(contracts).where(eq(contracts.crewMemberId, id));
      await db.delete(crewRotations).where(eq(crewRotations.crewMemberId, id));

      const result = await db.delete(crewMembers).where(eq(crewMembers.id, id));
      return (result.rowCount || 0) > 0;
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
      .where(eq(contracts.crewMemberId, crewMemberId))
      .orderBy(desc(contracts.createdAt));
    return contract || undefined;
  }

  async getContract(id: string): Promise<Contract | undefined> {
    const [contract] = await db.select().from(contracts).where(eq(contracts.id, id));
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

  async getDocument(id: string): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.id, id));
    return document || undefined;
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

  async getExpiringContracts(days: number): Promise<ContractAlert[]> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + (days * 24 * 60 * 60 * 1000));

    const allContracts = await db
      .select()
      .from(contracts)
      .where(eq(contracts.status, 'active'));

    const alerts: ContractAlert[] = [];

    for (const contract of allContracts) {
      const member = await this.getCrewMember(contract.crewMemberId);
      const vessel = await this.getVessel(contract.vesselId);

      if (member && vessel) {
        const daysUntilExpiry = Math.ceil((contract.endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

        if (daysUntilExpiry <= days) {
          let severity: 'critical' | 'warning' | 'info' | 'expired';
          if (daysUntilExpiry <= 0) {
            severity = 'expired';
          } else if (daysUntilExpiry <= 7) {
            severity = 'critical';
          } else if (daysUntilExpiry <= 15) {
            severity = 'warning';
          } else {
            severity = 'info';
          }

          alerts.push({
            contract,
            crewMember: member,
            vessel,
            daysUntilExpiry,
            severity,
          });
        }
      }
    }

    return alerts.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  }

  async getExpiringVesselDocuments(days: number): Promise<Array<{
    document: {
      id: string;
      name: string;
      type: string;
      expiryDate: Date;
    };
    vessel: {
      id: string;
      name: string;
    };
    daysUntilExpiry: number;
    severity: 'critical' | 'warning' | 'info';
  }>> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + (days * 24 * 60 * 60 * 1000));

    const expiringVesselDocs = await db
      .select()
      .from(vesselDocuments)
      .where(and(
        lte(vesselDocuments.expiryDate, futureDate),
        gte(vesselDocuments.expiryDate, now),
        isNotNull(vesselDocuments.expiryDate)
      ));

    const alerts = [];

    for (const doc of expiringVesselDocs) {
      const vessel = await this.getVessel(doc.vesselId);
      if (vessel && doc.expiryDate) {
        const daysUntilExpiry = Math.ceil((doc.expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        const severity = daysUntilExpiry <= 7 ? 'critical' : daysUntilExpiry <= 15 ? 'warning' : 'info';

        alerts.push({
          document: {
            id: doc.id,
            name: doc.name,
            type: doc.type,
            expiryDate: doc.expiryDate,
          },
          vessel: {
            id: vessel.id,
            name: vessel.name,
          },
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
      .set({ ...document, updatedAt: new Date() })
      .where(eq(documents.id, id))
      .returning();

    return updated || undefined;
  }

  async deleteDocument(id: string): Promise<boolean> {
    const result = await db.delete(documents).where(eq(documents.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Scanned document operations
  async getScannedDocument(documentId: string): Promise<ScannedDocument | undefined> {
    const [scanned] = await db.select().from(scannedDocuments).where(eq(scannedDocuments.documentId, documentId));
    return scanned || undefined;
  }

  async createScannedDocument(scanned: InsertScannedDocument): Promise<ScannedDocument> {
    const [newScanned] = await db
      .insert(scannedDocuments)
      .values(scanned)
      .returning();
    return newScanned;
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
        .set({ ...settings, updatedAt: new Date() })
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

  // WhatsApp settings operations
  async getWhatsappSettings(): Promise<WhatsappSettings | undefined> {
    const [settings] = await db.select().from(whatsappSettings).limit(1);
    return settings || undefined;
  }

  async updateWhatsappSettings(settings: InsertWhatsappSettings): Promise<WhatsappSettings> {
    const existing = await this.getWhatsappSettings();

    if (existing) {
      const [updated] = await db
        .update(whatsappSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(whatsappSettings.id, existing.id))
        .returning();

      return updated;
    } else {
      const [created] = await db
        .insert(whatsappSettings)
        .values(settings)
        .returning();
      return created;
    }
  }

  // Activity log operations
  async logActivity(activity: InsertActivityLog): Promise<ActivityLog> {
    const [newActivity] = await db
      .insert(activityLogs)
      .values(activity)
      .returning();
    return newActivity;
  }

  async getActivityLogs(): Promise<ActivityLog[]> {
    return await db.select().from(activityLogs).orderBy(activityLogs.createdAt);
  }

  // Notification history operations
  async logNotification(notification: InsertNotificationHistory): Promise<NotificationHistory> {
    const [newNotification] = await db
      .insert(notificationHistory)
      .values(notification)
      .returning();
    return newNotification;
  }

  async getNotificationHistory(eventId: string, eventType: string, daysBeforeEvent: number): Promise<NotificationHistory[]> {
    return await db
      .select()
      .from(notificationHistory)
      .where(and(
        eq(notificationHistory.eventId, eventId),
        eq(notificationHistory.eventType, eventType),
        eq(notificationHistory.daysBeforeEvent, daysBeforeEvent)
      ));
  }

  async hasNotificationBeenSent(eventId: string, eventType: string, daysBeforeEvent: number, provider: string): Promise<boolean> {
    const [notification] = await db
      .select()
      .from(notificationHistory)
      .where(and(
        eq(notificationHistory.eventId, eventId),
        eq(notificationHistory.eventType, eventType),
        eq(notificationHistory.daysBeforeEvent, daysBeforeEvent),
        eq(notificationHistory.provider, provider),
        eq(notificationHistory.success, true)
      ))
      .limit(1);

    return !!notification;
  }

  async hasNotificationBeenSentToday(eventId: string, eventType: string, provider: string, dateStr: string): Promise<boolean> {
    const startOfDay = new Date(dateStr);
    const endOfDay = new Date(dateStr);
    endOfDay.setHours(23, 59, 59, 999);

    const [notification] = await db
      .select()
      .from(notificationHistory)
      .where(and(
        eq(notificationHistory.eventId, eventId),
        eq(notificationHistory.eventType, eventType),
        eq(notificationHistory.provider, provider),
        eq(notificationHistory.success, true),
        gte(notificationHistory.notificationDate, startOfDay),
        lte(notificationHistory.notificationDate, endOfDay)
      ))
      .limit(1);

    return !!notification;
  }

  async getFailedNotifications(maxRetries: number = 3): Promise<NotificationHistory[]> {
    return await db
      .select()
      .from(notificationHistory)
      .where(and(
        eq(notificationHistory.success, false),
        lte(notificationHistory.retryCount, maxRetries)
      ));
  }

  async updateNotificationStatus(id: string, success: boolean, errorMessage?: string, retryCount?: number): Promise<NotificationHistory | undefined> {
    const updateData: any = { success };

    if (errorMessage !== undefined) {
      updateData.errorMessage = errorMessage;
    }

    if (retryCount !== undefined) {
      updateData.retryCount = retryCount;
    }

    const [updated] = await db
      .update(notificationHistory)
      .set(updateData)
      .where(eq(notificationHistory.id, id))
      .returning();

    return updated || undefined;
  }

  // Vessel document operations
  async getVesselDocuments(vesselId: string): Promise<VesselDocument[]> {
    return await db.select().from(vesselDocuments)
      .where(eq(vesselDocuments.vesselId, vesselId))
      .orderBy(vesselDocuments.uploadedAt);
  }

  async getVesselDocument(id: string): Promise<VesselDocument | undefined> {
    const [document] = await db.select().from(vesselDocuments).where(eq(vesselDocuments.id, id));
    return document || undefined;
  }

  async createVesselDocument(document: InsertVesselDocument): Promise<VesselDocument> {
    const [newDocument] = await db
      .insert(vesselDocuments)
      .values(document)
      .returning();
    return newDocument;
  }

  async updateVesselDocument(id: string, document: Partial<InsertVesselDocument>): Promise<VesselDocument | undefined> {
    const [updated] = await db
      .update(vesselDocuments)
      .set(document)
      .where(eq(vesselDocuments.id, id))
      .returning();

    return updated || undefined;
  }

  async deleteVesselDocument(id: string): Promise<boolean> {
    const result = await db.delete(vesselDocuments).where(eq(vesselDocuments.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getVesselContractStats(vesselId: string): Promise<{ active: number, expiringSoon: number, expired: number }> {
    const now = new Date();
    const fortyFiveDaysFromNow = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);

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
      } else if (contract.endDate <= fortyFiveDaysFromNow) {
        stats.expiringSoon++;
      } else {
        stats.active++;
      }
    }

    return stats;
  }

  async getVesselContracts(vesselId: string, status?: string): Promise<Array<Contract & { crewMember: CrewMember }>> {
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

    const sortedContracts = contractsWithCrew.sort((a, b) =>
      new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
    );

    if (status) {
      const now = new Date();
      const fortyFiveDaysFromNow = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);

      return sortedContracts.filter(contract => {
        if (status === 'active') {
          return contract.status === 'active' && contract.endDate > fortyFiveDaysFromNow;
        } else if (status === 'expiring') {
          return contract.status === 'active' && contract.endDate <= fortyFiveDaysFromNow && contract.endDate >= now;
        } else if (status === 'expired') {
          return contract.endDate < now;
        }
        return contract.status === status;
      });
    }

    return sortedContracts;
  }

  async saveWhatsappMessage(message: InsertWhatsappMessage): Promise<WhatsappMessage> {
    const [newMessage] = await db
      .insert(whatsappMessages)
      .values(message)
      .returning();
    return newMessage;
  }

  async getWhatsappMessages(remoteJid: string, limit: number = 50): Promise<WhatsappMessage[]> {
    return await db
      .select()
      .from(whatsappMessages)
      .where(eq(whatsappMessages.remoteJid, remoteJid))
      .orderBy(desc(whatsappMessages.timestamp))
      .limit(limit);
  }
}


export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private vessels: Map<string, Vessel>;
  private crewMembers: Map<string, CrewMember>;
  private contracts: Map<string, Contract>;
  private documents: Map<string, Document>;
  private vesselDocuments: Map<string, VesselDocument>;
  private crewRotations: Map<string, CrewRotation>;
  private emailSettings: EmailSettings | undefined;
  private whatsappSettings: WhatsappSettings | undefined;
  private notificationHistory: Map<string, NotificationHistory>;
  private scannedDocuments: Map<string, ScannedDocument>;
  private whatsappMessages: Map<string, WhatsappMessage>;

  constructor() {
    this.users = new Map();
    this.vessels = new Map();
    this.crewMembers = new Map();
    this.contracts = new Map();
    this.documents = new Map();
    this.vesselDocuments = new Map();
    this.crewRotations = new Map();
    this.notificationHistory = new Map();
    this.scannedDocuments = new Map();
    this.whatsappMessages = new Map();
    this.initializeData();
  }

  private initializeData() {
    // CRITICAL: Never create demo data in production
    const environment = process.env.NODE_ENV || 'development';

    if (environment === 'production') {
      console.error('❌ DEMO DATA BLOCKED: MemStorage should not be used in production');
      console.error('   Use DatabaseStorage with real PostgreSQL database instead');
      return;
    }

    console.log(`🔧 Initializing demo data for ${environment} environment`);

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
      status: "world-wide",
      sortOrder: 1,
      createdAt: new Date(),
    };
    const vessel2: Vessel = {
      id: randomUUID(),
      name: "MV Maritime Explorer",
      type: "Bulk Carrier",
      imoNumber: "2345678",
      flag: "Liberia",
      status: "world-wide",
      sortOrder: 2,
      createdAt: new Date(),
    };
    const vessel3: Vessel = {
      id: randomUUID(),
      name: "MV Deep Blue",
      type: "Tanker",
      imoNumber: "3456789",
      flag: "Singapore",
      status: "harbour-mining",
      sortOrder: 3,
      createdAt: new Date(),
    };

    const vessel4: Vessel = {
      id: randomUUID(),
      name: "MV Nordic Explorer",
      type: "Ro-Ro Ferry",
      imoNumber: "4567890",
      flag: "Norway",
      status: "world-wide",
      sortOrder: 4,
      createdAt: new Date(),
    };

    const vessel5: Vessel = {
      id: randomUUID(),
      name: "MV Pacific Voyager",
      type: "Container Ship",
      imoNumber: "5678901",
      flag: "Marshall Islands",
      status: "harbour-mining",
      sortOrder: 5,
      createdAt: new Date(),
    };

    const vessel6: Vessel = {
      id: randomUUID(),
      name: "MV Arctic Breeze",
      type: "Oil Tanker",
      imoNumber: "6789012",
      flag: "Denmark",
      status: "world-wide",
      sortOrder: 6,
      createdAt: new Date(),
    };

    const vessel7: Vessel = {
      id: randomUUID(),
      name: "Sagar",
      type: "Container Ship",
      imoNumber: "IMO1234567",
      flag: "India",
      status: "world-wide",
      sortOrder: 7,
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
      email: null,
      emergencyContact: {
        name: "Sarah Johnson",
        relationship: "Wife",
        phone: "+44-123-456-7891",
        email: "sarah.j@email.com"
      },
      currentVesselId: vessel3.id,
      lastVesselId: null,
      status: "onBoard",
      signOffDate: null,
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
      email: null,
      emergencyContact: {
        name: "Maria Santos",
        relationship: "Wife",
        phone: "+63-123-456-7891",
        email: "maria.s@email.com"
      },
      currentVesselId: vessel1.id,
      lastVesselId: null,
      status: "onBoard",
      signOffDate: null,
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
      email: null,
      emergencyContact: {
        name: "Jan Kowalski",
        relationship: "Father",
        phone: "+48-123-456-7891",
        email: "jan.k@email.com"
      },
      currentVesselId: vessel2.id,
      lastVesselId: null,
      status: "onBoard",
      signOffDate: null,
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
      email: null,
      emergencyContact: {
        name: "Maria Rodriguez",
        relationship: "Wife",
        phone: "+34-123-456-7891",
        email: "maria.r@email.com"
      },
      currentVesselId: vessel4.id,
      lastVesselId: null,
      status: "onBoard",
      signOffDate: null,
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
      email: null,
      emergencyContact: {
        name: "Ingrid Larsen",
        relationship: "Wife",
        phone: "+47-123-456-7891",
        email: "ingrid.l@email.com"
      },
      currentVesselId: vessel5.id,
      lastVesselId: null,
      status: "onBoard",
      signOffDate: null,
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
      email: null,
      emergencyContact: {
        name: "Lisa Chen",
        relationship: "Wife",
        phone: "+65-123-456-7891",
        email: "lisa.c@email.com"
      },
      currentVesselId: null, // Unassigned
      lastVesselId: null,
      status: "onShore",
      signOffDate: null,
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
      email: null,
      emergencyContact: {
        name: "Sofia Rossi",
        relationship: "Wife",
        phone: "+39-123-456-7891",
        email: "sofia.r@email.com"
      },
      currentVesselId: null, // Unassigned
      lastVesselId: null,
      status: "onShore",
      signOffDate: null,
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
      email: null,
      emergencyContact: {
        name: "Fatima Hassan",
        relationship: "Mother",
        phone: "+20-123-456-7891",
        email: "fatima.h@email.com"
      },
      currentVesselId: null, // Unassigned
      lastVesselId: null,
      status: "onShore",
      signOffDate: null,
      createdAt: new Date(),
    };

    // Add signed-off crew members for Ex-Hand Database testing
    const signedOffCrew1: CrewMember = {
      id: randomUUID(),
      userId: null,
      firstName: "Satish",
      lastName: "Kumar",
      nationality: "India",
      dateOfBirth: new Date("1988-05-10"),
      rank: "Wiper",
      phoneNumber: "+91-123-456-7890",
      email: null,
      emergencyContact: {
        name: "Priya Kumar",
        relationship: "Wife",
        phone: "+91-123-456-7891",
        email: "priya.k@email.com"
      },
      currentVesselId: vessel1.id, // Keep vessel reference for "Last Vessel Sailed"
      lastVesselId: null,
      status: "onShore", // Signed off
      signOffDate: new Date("2024-12-20"),
      createdAt: new Date(),
    };

    const signedOffCrew2: CrewMember = {
      id: randomUUID(),
      userId: null,
      firstName: "Alexander",
      lastName: "Philip",
      nationality: "Philippines",
      dateOfBirth: new Date("1986-03-22"),
      rank: "AB Seaman",
      phoneNumber: "+63-123-456-7890",
      email: null,
      emergencyContact: {
        name: "Maria Philip",
        relationship: "Wife",
        phone: "+63-123-456-7891",
        email: "maria.p@email.com"
      },
      currentVesselId: vessel2.id, // Keep vessel reference for "Last Vessel Sailed"
      lastVesselId: null,
      status: "onShore", // Signed off
      signOffDate: new Date("2024-12-18"),
      createdAt: new Date(),
    };

    const signedOffCrew3: CrewMember = {
      id: randomUUID(),
      userId: null,
      firstName: "Ragarajan",
      lastName: "Chandrasekaran",
      nationality: "India",
      dateOfBirth: new Date("1985-08-14"),
      rank: "2nd Engineer",
      phoneNumber: "+91-987-654-3210",
      email: null,
      emergencyContact: {
        name: "Lakshmi Chandrasekaran",
        relationship: "Wife",
        phone: "+91-987-654-3211",
        email: "lakshmi.c@email.com"
      },
      currentVesselId: vessel3.id, // Keep vessel reference for "Last Vessel Sailed"
      lastVesselId: null,
      status: "onShore", // Signed off
      signOffDate: new Date("2024-12-15"),
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
    this.crewMembers.set(signedOffCrew1.id, signedOffCrew1);
    this.crewMembers.set(signedOffCrew2.id, signedOffCrew2);
    this.crewMembers.set(signedOffCrew3.id, signedOffCrew3);

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
      contractType: "SEA",
      contractNumber: "C12345",
      filePath: null,
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
      contractType: "SEA",
      contractNumber: "C12346",
      filePath: null,
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
      contractType: "SEA",
      contractNumber: "C12347",
      filePath: null,
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
      contractType: "SEA",
      contractNumber: "C12348",
      filePath: null,
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
      contractType: "SEA",
      contractNumber: "C12349",
      filePath: null,
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
      contractType: "SEA",
      contractNumber: "C12350",
      filePath: null,
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
      contractType: "SEA",
      contractNumber: "C12351",
      filePath: null,
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
      contractType: "SEA",
      contractNumber: "C12352",
      filePath: null,
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
        type: "coc",
        documentNumber: "COC-2024-001",
        issueDate: new Date("2022-01-15"),
        expiryDate: new Date("2025-01-22"), // Expiring in 7 days from Aug 12, 2025
        issuingAuthority: "Polish Maritime Authority",
        status: "expiring",
        filePath: null,
        createdAt: new Date(),
        updatedAt: new Date(),
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
        updatedAt: new Date(),
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
        updatedAt: new Date(),
      }
    ];

    documents.forEach(doc => this.documents.set(doc.id, doc as Document));

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
      status: insertVessel.status || 'harbour-mining',
      sortOrder: insertVessel.sortOrder || null
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

  async updateVesselOrder(vesselIds: string[]): Promise<boolean> {
    try {
      // Update sort order for each vessel
      for (let i = 0; i < vesselIds.length; i++) {
        const vessel = this.vessels.get(vesselIds[i]);
        if (vessel) {
          vessel.sortOrder = i + 1;
          this.vessels.set(vesselIds[i], vessel);
        }
      }
      return true;
    } catch (error) {
      console.error('Error updating vessel order:', error);
      return false;
    }
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
      email: data.email || null,
      emergencyContact: data.emergencyContact || null,
      currentVesselId: data.currentVesselId || null,
      lastVesselId: data.lastVesselId || null,
      status: data.status || 'onBoard',
      signOffDate: data.signOffDate || null,
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

  async findDuplicateCrewMember(firstName: string, lastName: string, dateOfBirth: Date): Promise<CrewMember | undefined> {
    const allMembers = Array.from(this.crewMembers.values());
    return allMembers.find(member =>
      member.firstName.toLowerCase() === firstName.toLowerCase() &&
      member.lastName.toLowerCase() === lastName.toLowerCase() &&
      new Date(member.dateOfBirth).toDateString() === dateOfBirth.toDateString()
    );
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
    const activeContracts = Array.from(this.contracts.values())
      .filter(contract => contract.crewMemberId === crewMemberId)
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
    return activeContracts[0];
  }

  async getContract(id: string): Promise<Contract | undefined> {
    return this.contracts.get(id);
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
      durationDays: insertContract.durationDays || null,
      contractType: insertContract.contractType || 'SEA',
      contractNumber: insertContract.contractNumber || null,
      filePath: insertContract.filePath || null
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

  async getDocument(id: string): Promise<Document | undefined> {
    return this.documents.get(id);
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

  async getExpiringContracts(days: number): Promise<ContractAlert[]> {
    const now = new Date();

    const activeContracts = Array.from(this.contracts.values()).filter(c => c.status === 'active');
    const alerts: ContractAlert[] = [];

    for (const contract of activeContracts) {
      const member = this.crewMembers.get(contract.crewMemberId);
      const vessel = this.vessels.get(contract.vesselId);

      if (member && vessel) {
        const daysUntilExpiry = Math.ceil((contract.endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

        // Include expired contracts (negative days) and contracts expiring within the specified days
        if (daysUntilExpiry <= days) {
          let severity: 'critical' | 'warning' | 'info' | 'expired';
          if (daysUntilExpiry <= 0) {
            severity = 'expired';
          } else if (daysUntilExpiry <= 7) {
            severity = 'critical';
          } else if (daysUntilExpiry <= 15) {
            severity = 'warning';
          } else {
            severity = 'info';
          }

          alerts.push({
            contract,
            crewMember: member,
            vessel,
            daysUntilExpiry,
            severity,
          });
        }
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
      updatedAt: new Date(),
      status: insertDocument.status || 'valid',
      filePath: insertDocument.filePath || null
    };
    this.documents.set(id, document);
    return document;
  }

  async updateDocument(id: string, updates: Partial<InsertDocument>): Promise<Document | undefined> {
    const document = this.documents.get(id);
    if (!document) return undefined;

    const updated = { ...document, ...updates, updatedAt: new Date() };
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

  async getVesselContractStats(vesselId: string): Promise<{ active: number, expiringSoon: number, expired: number }> {
    const now = new Date();
    const fortyFiveDaysFromNow = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);

    const stats = { active: 0, expiringSoon: 0, expired: 0 };

    for (const contract of Array.from(this.contracts.values())) {
      const crewMember = this.crewMembers.get(contract.crewMemberId);
      if (!crewMember || crewMember.currentVesselId !== vesselId || contract.status !== 'active') {
        continue;
      }

      if (contract.endDate < now) {
        stats.expired++;
      } else if (contract.endDate <= fortyFiveDaysFromNow) {
        stats.expiringSoon++;
      } else {
        stats.active++;
      }
    }

    return stats;
  }

  async getVesselContracts(vesselId: string, status?: string): Promise<Array<Contract & { crewMember: CrewMember }>> {
    const vesselContracts: Array<Contract & { crewMember: CrewMember }> = [];

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
      const fortyFiveDaysFromNow = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);

      return vesselContracts.filter(contract => {
        if (status === 'active') {
          return contract.status === 'active' && contract.endDate > fortyFiveDaysFromNow;
        } else if (status === 'expiring') {
          return contract.status === 'active' && contract.endDate <= fortyFiveDaysFromNow && contract.endDate >= now;
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
      enabled: settings.enabled ?? true,
      recipients: settings.recipients || ['office_staff', 'admin'],
      recipientEmail: settings.recipientEmail || null,
      emailTemplate: settings.emailTemplate || null,
      lastMonthlyEmailMonth: this.emailSettings?.lastMonthlyEmailMonth || null,
      lastMonthlyEmailMorningSent: this.emailSettings?.lastMonthlyEmailMorningSent || null,
      lastMonthlyEmailEveningSent: this.emailSettings?.lastMonthlyEmailEveningSent || null,
      lastWeeklySummaryMonth: this.emailSettings?.lastWeeklySummaryMonth || null,
      lastWeeklySummarySent: this.emailSettings?.lastWeeklySummarySent || null,
      updatedAt: new Date(),
    };
    this.emailSettings = updated;
    return updated;
  }

  async getWhatsappSettings(): Promise<WhatsappSettings | undefined> {
    return this.whatsappSettings;
  }

  async updateWhatsappSettings(settings: InsertWhatsappSettings): Promise<WhatsappSettings> {
    const updated: WhatsappSettings = {
      id: this.whatsappSettings?.id || randomUUID(),
      enabled: settings.enabled ?? false,
      provider: settings.provider || 'twilio',
      apiKey: settings.apiKey || null,
      groupId: settings.groupId || null,
      webhookUrl: settings.webhookUrl || null,
      notificationTypes: settings.notificationTypes || ['contract_expiry', 'document_expiry', 'crew_rotation'],
      reminderDays: settings.reminderDays || [7, 3, 1],
      messageTemplate: settings.messageTemplate || '📋 *Crew Management Alert*\n\n{{title}}\n{{description}}\n\nDate: {{date}}\nSeverity: {{severity}}',
      updatedAt: new Date(),
    };
    this.whatsappSettings = updated;
    return updated;
  }

  // Activity log operations
  async logActivity(activity: InsertActivityLog): Promise<ActivityLog> {
    const id = randomUUID();
    const log: ActivityLog = {
      id,
      type: activity.type,
      action: activity.action,
      entityType: activity.entityType,
      entityId: activity.entityId || null,
      userId: activity.userId || null,
      username: activity.username,
      userRole: activity.userRole,
      description: activity.description,
      severity: activity.severity || 'info',
      metadata: activity.metadata || null,
      createdAt: new Date(),
    };

    // For in-memory storage, we'll just return the log without storing
    // In a real implementation, you might want to store these in a Map
    return log;
  }

  async getActivityLogs(): Promise<ActivityLog[]> {
    // For in-memory storage, return empty array
    // In a real implementation, you would retrieve from a Map
    return [];
  }

  // Notification history operations
  async logNotification(notification: InsertNotificationHistory): Promise<NotificationHistory> {
    const id = randomUUID();
    const log: NotificationHistory = {
      id,
      eventId: notification.eventId,
      eventType: notification.eventType,
      eventDate: notification.eventDate instanceof Date ? notification.eventDate : new Date(notification.eventDate),
      notificationDate: notification.notificationDate instanceof Date ? notification.notificationDate : new Date(notification.notificationDate),
      daysBeforeEvent: notification.daysBeforeEvent,
      provider: notification.provider,
      success: notification.success ?? true,
      errorMessage: notification.errorMessage || null,
      retryCount: notification.retryCount || 0,
      metadata: notification.metadata || null,
      createdAt: new Date(),
    };

    this.notificationHistory.set(id, log);
    return log;
  }

  async getNotificationHistory(eventId: string, eventType: string, daysBeforeEvent: number): Promise<NotificationHistory[]> {
    return Array.from(this.notificationHistory.values()).filter(
      notification =>
        notification.eventId === eventId &&
        notification.eventType === eventType &&
        notification.daysBeforeEvent === daysBeforeEvent
    );
  }

  async hasNotificationBeenSent(eventId: string, eventType: string, daysBeforeEvent: number, provider: string): Promise<boolean> {
    return Array.from(this.notificationHistory.values()).some(
      notification =>
        notification.eventId === eventId &&
        notification.eventType === eventType &&
        notification.daysBeforeEvent === daysBeforeEvent &&
        notification.provider === provider &&
        notification.success === true
    );
  }

  async hasNotificationBeenSentToday(eventId: string, eventType: string, provider: string, dateStr: string): Promise<boolean> {
    const startOfDay = new Date(dateStr);
    const endOfDay = new Date(dateStr);
    endOfDay.setHours(23, 59, 59, 999);

    return Array.from(this.notificationHistory.values()).some(
      notification =>
        notification.eventId === eventId &&
        notification.eventType === eventType &&
        notification.provider === provider &&
        notification.success === true &&
        notification.notificationDate >= startOfDay &&
        notification.notificationDate <= endOfDay
    );
  }

  async getFailedNotifications(maxRetries: number = 3): Promise<NotificationHistory[]> {
    return Array.from(this.notificationHistory.values()).filter(
      notification =>
        notification.success === false &&
        (notification.retryCount || 0) <= maxRetries
    );
  }

  async updateNotificationStatus(id: string, success: boolean, errorMessage?: string, retryCount?: number): Promise<NotificationHistory | undefined> {
    const notification = this.notificationHistory.get(id);
    if (!notification) {
      return undefined;
    }

    const updated: NotificationHistory = {
      ...notification,
      success,
      errorMessage: errorMessage !== undefined ? errorMessage : notification.errorMessage,
      retryCount: retryCount !== undefined ? retryCount : notification.retryCount,
    };

    this.notificationHistory.set(id, updated);
    return updated;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  // Vessel document operations
  async getVesselDocuments(vesselId: string): Promise<VesselDocument[]> {
    return Array.from(this.vesselDocuments.values()).filter(doc => doc.vesselId === vesselId);
  }

  async getVesselDocument(id: string): Promise<VesselDocument | undefined> {
    return this.vesselDocuments.get(id);
  }

  async createVesselDocument(document: InsertVesselDocument): Promise<VesselDocument> {
    const newDocument: VesselDocument = {
      id: randomUUID(),
      name: document.name,
      type: document.type,
      vesselId: document.vesselId,
      filePath: document.filePath,
      fileName: document.fileName,
      fileSize: document.fileSize ?? null,
      mimeType: document.mimeType ?? null,
      uploadedBy: document.uploadedBy || 'system',
      expiryDate: document.expiryDate ?? null,
      description: document.description ?? null,
      isPublic: document.isPublic ?? null,
      uploadedAt: new Date(),
      createdAt: new Date(),
    };
    this.vesselDocuments.set(newDocument.id, newDocument);
    return newDocument;
  }

  async updateVesselDocument(id: string, document: Partial<InsertVesselDocument>): Promise<VesselDocument | undefined> {
    const existing = this.vesselDocuments.get(id);
    if (!existing) return undefined;

    const updated: VesselDocument = {
      ...existing,
      name: document.name !== undefined ? document.name : existing.name,
      type: document.type !== undefined ? document.type : existing.type,
      vesselId: document.vesselId !== undefined ? document.vesselId : existing.vesselId,
      filePath: document.filePath !== undefined ? document.filePath : existing.filePath,
      fileName: document.fileName !== undefined ? document.fileName : existing.fileName,
      fileSize: document.fileSize !== undefined ? (document.fileSize ?? null) : existing.fileSize,
      mimeType: document.mimeType !== undefined ? (document.mimeType ?? null) : existing.mimeType,
      uploadedBy: document.uploadedBy !== undefined ? document.uploadedBy : existing.uploadedBy,
      expiryDate: document.expiryDate !== undefined ? (document.expiryDate ?? null) : existing.expiryDate,
      description: document.description !== undefined ? (document.description ?? null) : existing.description,
      isPublic: document.isPublic !== undefined ? (document.isPublic ?? null) : existing.isPublic,
    };
    this.vesselDocuments.set(id, updated);
    return updated;
  }

  async deleteVesselDocument(id: string): Promise<boolean> {
    return this.vesselDocuments.delete(id);
  }

  // Scanned document operations
  async getScannedDocument(documentId: string): Promise<ScannedDocument | undefined> {
    return Array.from(this.scannedDocuments.values()).find(
      (scanned) => scanned.documentId === documentId
    );
  }

  async createScannedDocument(scanned: InsertScannedDocument): Promise<ScannedDocument> {
    const id = randomUUID();
    const newScanned: ScannedDocument = {
      ...scanned,
      id,
      seafarerName: scanned.seafarerName || null,
      extractedNumber: scanned.extractedNumber || null,
      extractedExpiry: scanned.extractedExpiry || null,
      extractedIssueDate: scanned.extractedIssueDate || null,
      extractedHolderName: scanned.extractedHolderName || null,
      extractedIssuingAuthority: scanned.extractedIssuingAuthority || null,
      mrzValidation: scanned.mrzValidation || null,
      ocrConfidence: scanned.ocrConfidence || null,
      rawText: scanned.rawText || null,
      createdAt: new Date(),
      supersededAt: null,
      supersededBy: null,
      ownerValidationStatus: scanned.ownerValidationStatus || null,
      ownerValidationScore: scanned.ownerValidationScore || null,
      ownerValidationMessage: scanned.ownerValidationMessage || null,
    };
    this.scannedDocuments.set(id, newScanned);
    return newScanned;
  }

  // WhatsApp message operations
  async saveWhatsappMessage(message: InsertWhatsappMessage): Promise<WhatsappMessage> {
    const id = randomUUID();
    const newMessage: WhatsappMessage = {
      ...message,
      id,
      fromMe: message.fromMe ?? false,
      senderName: message.senderName || null,
      status: message.status || 'sent',
      timestamp: new Date(),
      createdAt: new Date(),
    };
    this.whatsappMessages.set(id, newMessage);
    return newMessage;
  }

  async getWhatsappMessages(remoteJid: string, _limit?: number): Promise<WhatsappMessage[]> {
    return Array.from(this.whatsappMessages.values())
      .filter(m => m.remoteJid === remoteJid)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
}

export const storage = new DatabaseStorage();
