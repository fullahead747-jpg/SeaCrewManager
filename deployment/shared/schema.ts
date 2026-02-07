import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table for authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull(), // 'admin', 'office_staff'
  email: text("email").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Vessels table
export const vessels = pgTable("vessels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(),
  imoNumber: text("imo_number").unique(),
  flag: text("flag").notNull(),
  status: text("status").notNull().default('active'), // 'active', 'maintenance', 'inactive'
  createdAt: timestamp("created_at").defaultNow(),
});

// Crew members table
export const crewMembers = pgTable("crew_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  nationality: text("nationality").notNull(),
  dateOfBirth: timestamp("date_of_birth").notNull(),
  rank: text("rank").notNull(),
  phoneNumber: text("phone_number"),
  emergencyContact: jsonb("emergency_contact"), // {name, relationship, phone, email}
  currentVesselId: varchar("current_vessel_id").references(() => vessels.id),
  status: text("status").notNull().default('active'), // 'active', 'onLeave', 'inactive'
  createdAt: timestamp("created_at").defaultNow(),
});

// Contracts table
export const contracts = pgTable("contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  crewMemberId: varchar("crew_member_id").notNull().references(() => crewMembers.id),
  vesselId: varchar("vessel_id").notNull().references(() => vessels.id),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  durationDays: integer("duration_days"), // Number of days for the contract
  salary: integer("salary"),
  currency: text("currency").default('USD'),
  status: text("status").notNull().default('active'), // 'active', 'completed', 'terminated'
  createdAt: timestamp("created_at").defaultNow(),
});

// Documents table
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  crewMemberId: varchar("crew_member_id").notNull().references(() => crewMembers.id),
  type: text("type").notNull(), // 'passport', 'cdc', 'stcw', 'medical', 'visa'
  documentNumber: text("document_number").notNull(),
  issueDate: timestamp("issue_date").notNull(),
  expiryDate: timestamp("expiry_date").notNull(),
  issuingAuthority: text("issuing_authority").notNull(),
  status: text("status").notNull().default('valid'), // 'valid', 'expiring', 'expired'
  filePath: text("file_path"), // For file storage reference
  createdAt: timestamp("created_at").defaultNow(),
});

// Crew rotations/scheduling
export const crewRotations = pgTable("crew_rotations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  crewMemberId: varchar("crew_member_id").notNull().references(() => crewMembers.id),
  vesselId: varchar("vessel_id").notNull().references(() => vessels.id),
  joinDate: timestamp("join_date").notNull(),
  leaveDate: timestamp("leave_date"),
  rotationType: text("rotation_type").notNull(), // 'join', 'leave', 'rotation'
  status: text("status").notNull().default('scheduled'), // 'scheduled', 'completed', 'cancelled'
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Email notification settings
export const emailSettings = pgTable("email_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reminderDays: jsonb("reminder_days").default([30, 15, 7]), // Days before expiry to send reminders
  enabled: boolean("enabled").default(true),
  recipients: jsonb("recipients").default(['office_staff', 'admin']), // Who receives notifications
  emailTemplate: text("email_template"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Activity log table for tracking all system activities
export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // 'User Registration', 'Crew Management', 'Contract Management', etc.
  action: text("action").notNull(), // 'create', 'update', 'delete'
  entityType: text("entity_type").notNull(), // 'user', 'crew', 'vessel', 'contract', etc.
  entityId: text("entity_id"), // ID of the affected entity
  userId: varchar("user_id").references(() => users.id),
  username: text("username").notNull(),
  userRole: text("user_role").notNull(),
  description: text("description").notNull(),
  severity: text("severity").notNull().default('info'), // 'info', 'success', 'warning', 'error'
  metadata: jsonb("metadata"), // Additional context data
  createdAt: timestamp("created_at").defaultNow(),
});

// Create insert schemas with proper validation
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
}).extend({
  role: z.enum(["admin", "office_staff"]),
});

export const insertVesselSchema = createInsertSchema(vessels).omit({
  id: true,
  createdAt: true,
});

export const insertCrewMemberSchema = createInsertSchema(crewMembers).omit({
  id: true,
  createdAt: true,
}).extend({
  dateOfBirth: z.union([z.date(), z.string().transform((str) => new Date(str))]),
});

export const insertContractSchema = createInsertSchema(contracts).omit({
  id: true,
  createdAt: true,
}).extend({
  startDate: z.union([z.date(), z.string().transform((str) => new Date(str))]),
  endDate: z.union([z.date(), z.string().transform((str) => new Date(str))]),
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
});

export const insertCrewRotationSchema = createInsertSchema(crewRotations).omit({
  id: true,
  createdAt: true,
});

export const insertEmailSettingsSchema = createInsertSchema(emailSettings).omit({
  id: true,
  updatedAt: true,
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  createdAt: true,
});

// Type exports
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Vessel = typeof vessels.$inferSelect;
export type InsertVessel = z.infer<typeof insertVesselSchema>;
export type CrewMember = typeof crewMembers.$inferSelect;
export type InsertCrewMember = z.infer<typeof insertCrewMemberSchema>;
export type Contract = typeof contracts.$inferSelect;
export type InsertContract = z.infer<typeof insertContractSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type CrewRotation = typeof crewRotations.$inferSelect;
export type InsertCrewRotation = z.infer<typeof insertCrewRotationSchema>;
export type EmailSettings = typeof emailSettings.$inferSelect;
export type InsertEmailSettings = z.infer<typeof insertEmailSettingsSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;

// Additional types for API responses
export type CrewMemberWithDetails = CrewMember & {
  user?: User;
  currentVessel?: Vessel;
  documents?: Document[];
  activeContract?: Contract;
};

export type VesselWithCrew = Vessel & {
  crewMembers?: CrewMemberWithDetails[];
};

export type DocumentAlert = {
  document: Document;
  crewMember: CrewMember;
  daysUntilExpiry: number;
  severity: 'critical' | 'warning' | 'info';
};
