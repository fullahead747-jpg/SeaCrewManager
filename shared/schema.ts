import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table for authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull(), // 'admin', 'office_staff', 'vessel_user'
  email: text("email").notNull(),
  name: text("name").notNull(),
  assignedVesselId: varchar("assigned_vessel_id").references(() => vessels.id),
  otp: text("otp"),
  otpExpiry: timestamp("otp_expiry"),
  resetToken: text("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Vessels table
export const vessels = pgTable("vessels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(),
  imoNumber: text("imo_number").unique(),
  flag: text("flag").notNull(),
  status: text("status").notNull().default('harbour-mining'), // 'harbour-mining', 'coastal-mining', 'world-wide', 'oil-field', 'line-up-mining'
  sortOrder: integer("sort_order").default(0),
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
  email: text("email"),
  emergencyContact: jsonb("emergency_contact"), // {name, relationship, phone, email}
  currentVesselId: varchar("current_vessel_id").references(() => vessels.id),
  lastVesselId: varchar("last_vessel_id").references(() => vessels.id), // Track previous vessel for ex-hand records
  status: text("status").notNull().default('onBoard'), // 'onBoard', 'onShore'
  passportNotApplicable: boolean("passport_not_applicable").default(false),
  cdcNotApplicable: boolean("cdc_not_applicable").default(false),
  cocNotApplicable: boolean("coc_not_applicable").default(false), // Crew member does not hold a COC
  medicalNotApplicable: boolean("medical_not_applicable").default(false),
  stcwNotApplicable: boolean("stcw_not_applicable").default(false),
  coeExtensionNotApplicable: boolean("coe_extension_not_applicable").default(false),
  signOffDate: timestamp("sign_off_date"), // Auto-stamped when crew member is signed off
  remarks: text("remarks"),
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
  contractType: text("contract_type").notNull().default('SEA'),
  contractNumber: text("contract_number"),
  filePath: text("file_path"),
  lastHealthCategory: text("last_health_category"), // Track last notified health state (e.g., 'notDue', 'attention', 'upcoming', 'critical', 'overdue')
  createdAt: timestamp("created_at").defaultNow(),
});

// Documents table
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  crewMemberId: varchar("crew_member_id").notNull().references(() => crewMembers.id),
  type: text("type").notNull(), // 'passport', 'cdc', 'coc', 'medical', 'visa', 'aoa', 'photo', 'nok', 'coe', 'coe-extension'
  documentNumber: text("document_number").notNull(),
  issueDate: timestamp("issue_date").notNull(),
  expiryDate: timestamp("expiry_date"), // Nullable for TBD
  issuingAuthority: text("issuing_authority").notNull(),
  status: text("status").notNull().default('valid'), // 'valid', 'expiring', 'expired'
  filePath: text("file_path"), // For file storage reference
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("documents_crew_member_id_type_unique").on(table.crewMemberId, table.type),
]);

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
  recipientEmail: text("recipient_email").default('admin@offing.biz, management@fullahead.in'), // Primary recipient email address
  emailTemplate: text("email_template"),
  // Managed Report Toggles
  overdueEnabled: boolean("overdue_enabled").default(true),
  criticalEnabled: boolean("critical_enabled").default(true),
  upcomingEnabled: boolean("upcoming_enabled").default(true),
  attentionEnabled: boolean("attention_enabled").default(true),
  // Monthly calendar email tracking (persistent across server restarts)
  lastMonthlyEmailMonth: text("last_monthly_email_month"), // YYYY-MM format of last month email was sent
  lastMonthlyEmailMorningSent: timestamp("last_monthly_email_morning_sent"), // Timestamp when morning email was sent
  lastMonthlyEmailEveningSent: timestamp("last_monthly_email_evening_sent"), // Timestamp when evening email was sent
  // Weekly summary email tracking (persistent across server restarts)
  lastWeeklySummaryMonth: text("last_weekly_summary_month"), // YYYY-MM-WW format of last week summary was sent
  lastWeeklySummarySent: timestamp("last_weekly_summary_sent"), // Timestamp when last weekly summary was sent
  updatedAt: timestamp("updated_at").defaultNow(),
});


// Vessel documents table
export const vesselDocuments = pgTable("vessel_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vesselId: varchar("vessel_id").notNull().references(() => vessels.id),
  name: text("name").notNull(), // Document name/title
  type: text("type").notNull(), // 'certificate', 'insurance', 'inspection', 'safety', 'customs', 'other'
  description: text("description"), // Optional description
  fileName: text("file_name").notNull(), // Original file name
  filePath: text("file_path").notNull(), // Object storage path
  fileSize: integer("file_size"), // File size in bytes
  mimeType: text("mime_type"), // File MIME type
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  expiryDate: timestamp("expiry_date"), // Optional expiry date for certificates
  isPublic: boolean("is_public").default(false), // Whether document is publicly accessible
  createdAt: timestamp("created_at").defaultNow(),
});

// Table for storing AI-scanned data secretly
export const scannedDocuments = pgTable("scanned_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => documents.id),
  seafarerName: text("seafarer_name"), // Crew member's full name from UI (synced with Seafarer Name field)
  extractedNumber: text("extracted_number"),
  extractedExpiry: timestamp("extracted_expiry"),
  extractedIssueDate: timestamp("extracted_issue_date"),
  extractedHolderName: text("extracted_holder_name"),
  extractedIssuingAuthority: text("extracted_issuing_authority"),
  mrzValidation: jsonb("mrz_validation"), // Full mrzResult object
  ocrConfidence: integer("ocr_confidence"),
  rawText: text("raw_text"),
  supersededAt: timestamp("superseded_at"), // When this scan was replaced
  supersededBy: varchar("superseded_by"), // ID of the scan that replaced this one
  // Owner validation fields
  ownerValidationStatus: text("owner_validation_status"), // 'match', 'warning', 'mismatch', null
  ownerValidationScore: integer("owner_validation_score"), // 0-100 similarity score
  ownerValidationMessage: text("owner_validation_message"), // User-friendly message
  createdAt: timestamp("created_at").defaultNow(),
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

// Notification history table for tracking sent notifications to prevent duplicates
export const notificationHistory = pgTable("notification_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: text("event_id").notNull(), // Unique identifier for the event
  eventType: text("event_type").notNull(), // 'contract_expiry', 'document_expiry', 'crew_join', etc.
  eventDate: timestamp("event_date").notNull(), // When the event is scheduled to occur
  notificationDate: timestamp("notification_date").notNull(), // When the notification was sent
  daysBeforeEvent: integer("days_before_event").notNull(), // How many days before the event this notification was sent
  provider: text("provider").notNull(), // 'email', etc.
  success: boolean("success").notNull().default(true), // Whether the notification was sent successfully
  errorMessage: text("error_message"), // Error message if sending failed
  retryCount: integer("retry_count").default(0), // Number of retry attempts
  metadata: jsonb("metadata"), // Additional context data like crew member name, vessel name, etc.
  createdAt: timestamp("created_at").defaultNow(),
});

// Crew status change history table for tracking status changes with mandatory reasons
export const statusChangeHistory = pgTable("status_change_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  crewMemberId: varchar("crew_member_id").notNull().references(() => crewMembers.id),
  previousStatus: text("previous_status").notNull(), // 'onBoard', 'onShore'
  newStatus: text("new_status").notNull(), // 'onBoard', 'onShore'
  reason: text("reason").notNull(), // Mandatory reason for the status change
  changedBy: varchar("changed_by").references(() => users.id), // User who made the change
  changedByUsername: text("changed_by_username").notNull(), // Username for audit trail
  vesselId: varchar("vessel_id").references(() => vessels.id), // Vessel at time of change (if applicable)
  contractId: varchar("contract_id").references(() => contracts.id), // Related contract (if applicable)
  createdAt: timestamp("created_at").defaultNow(),
});

// Daily compliance status transitions table for tracking daily 12:00 AM status category changes
export const dailyComplianceTransitions = pgTable("daily_compliance_transitions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  crewMemberId: varchar("crew_member_id").notNull().references(() => crewMembers.id),
  contractId: varchar("contract_id").references(() => contracts.id),
  vesselId: varchar("vessel_id").references(() => vessels.id),
  previousCategory: text("previous_category").notNull(), // 'notDue', 'attention', 'upcoming', 'critical', 'overdue'
  newCategory: text("new_category").notNull(), // 'notDue', 'attention', 'upcoming', 'critical', 'overdue'
  transitionDate: text("transition_date").notNull(), // 'YYYY-MM-DD'
  createdAt: timestamp("created_at").defaultNow(),
});


// Create insert schemas with proper validation
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
}).extend({
  role: z.enum(["admin", "office_staff", "vessel_user"]),
  assignedVesselId: z.string().optional().nullable(),
});

export const insertVesselSchema = createInsertSchema(vessels).omit({
  id: true,
  createdAt: true,
});

export const insertCrewMemberSchema = createInsertSchema(crewMembers).omit({
  id: true,
  createdAt: true,
}).extend({
  dateOfBirth: z.union([
    z.date().refine((date) => !isNaN(date.getTime()), { message: "Invalid date" }),
    z.string().transform((str) => {
      const date = new Date(str);
      if (isNaN(date.getTime())) return null;
      return date;
    }).pipe(z.date().refine((date) => !isNaN(date.getTime()), { message: "Invalid date" }))
  ]),
  signOffDate: z.union([
    z.date(),
    z.string().transform((str) => {
      if (!str) return null;
      const date = new Date(str);
      return isNaN(date.getTime()) ? null : date;
    }),
    z.null()
  ]).optional(),
  status: z.enum(['onBoard', 'onShore']).optional(),
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
  updatedAt: true,
}).extend({
  issueDate: z.union([z.date(), z.string().transform((str) => new Date(str))]),
  expiryDate: z.union([z.date(), z.string().transform((str) => new Date(str)), z.null()]).optional(),
});

export const insertCrewRotationSchema = createInsertSchema(crewRotations).omit({
  id: true,
  createdAt: true,
});

export const insertEmailSettingsSchema = createInsertSchema(emailSettings).omit({
  id: true,
  updatedAt: true,
});


export const insertVesselDocumentSchema = createInsertSchema(vesselDocuments).omit({
  id: true,
  createdAt: true,
  uploadedAt: true,
}).extend({
  expiryDate: z.union([z.date(), z.string().transform((str) => new Date(str)), z.null()]).optional(),
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationHistorySchema = createInsertSchema(notificationHistory).omit({
  id: true,
  createdAt: true,
}).extend({
  eventDate: z.union([z.date(), z.string().transform((str) => new Date(str))]),
  notificationDate: z.union([z.date(), z.string().transform((str) => new Date(str))]),
});

export const insertStatusChangeHistorySchema = createInsertSchema(statusChangeHistory).omit({
  id: true,
  createdAt: true,
});

export const insertDailyComplianceTransitionSchema = createInsertSchema(dailyComplianceTransitions).omit({
  id: true,
  createdAt: true,
});

export const insertScannedDocumentSchema = createInsertSchema(scannedDocuments).omit({
  id: true,
  createdAt: true,
}).extend({
  extractedExpiry: z.union([z.date(), z.string().transform((str) => new Date(str)), z.null()]).optional(),
  extractedIssueDate: z.union([z.date(), z.string().transform((str) => new Date(str)), z.null()]).optional(),
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
export type VesselDocument = typeof vesselDocuments.$inferSelect;
export type InsertVesselDocument = z.infer<typeof insertVesselDocumentSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type NotificationHistory = typeof notificationHistory.$inferSelect;
export type InsertNotificationHistory = z.infer<typeof insertNotificationHistorySchema>;
export type StatusChangeHistory = typeof statusChangeHistory.$inferSelect;
export type InsertStatusChangeHistory = z.infer<typeof insertStatusChangeHistorySchema>;
export type DailyComplianceTransition = typeof dailyComplianceTransitions.$inferSelect;
export type InsertDailyComplianceTransition = z.infer<typeof insertDailyComplianceTransitionSchema>;

export type ScannedDocument = typeof scannedDocuments.$inferSelect;
export type InsertScannedDocument = z.infer<typeof insertScannedDocumentSchema>;

export type StatusChangeHistoryWithDetails = StatusChangeHistory & {
  crewMember?: CrewMember;
  vessel?: Vessel;
};

// Additional types for API responses
export type CrewMemberWithDetails = CrewMember & {
  user?: User;
  currentVessel?: Vessel;
  lastVessel?: Vessel;
  documents?: Document[];
  activeContract?: Contract;
  sailingHistory?: {
    vesselName: string;
    durationDays: number;
    durationMonths: number;
  }[];
  totalSailedMonths?: number;
};

export type VesselWithCrew = Vessel & {
  crewMembers?: CrewMemberWithDetails[];
  documents?: VesselDocument[];
};

export type DocumentAlert = {
  document: Document;
  crewMember: CrewMember;
  daysUntilExpiry: number;
  severity: 'critical' | 'warning' | 'info';
};

export type ContractAlert = {
  contract: Contract;
  crewMember: CrewMember;
  vessel: Vessel;
  daysUntilExpiry: number;
  severity: 'critical' | 'warning' | 'info' | 'expired';
};

// Notification log for tracking sent notifications
export const notificationLog = pgTable("notification_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").references(() => documents.id, { onDelete: 'cascade' }),
  crewMemberId: varchar("crew_member_id").references(() => crewMembers.id, { onDelete: 'cascade' }),
  notificationType: varchar("notification_type", { length: 50 }).notNull(),
  sentAt: timestamp("sent_at").defaultNow(),
  recipientEmail: varchar("recipient_email", { length: 255 }).notNull(),
  status: varchar("status", { length: 20 }).default('sent'),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Document policies for configuration
export const documentPolicies = pgTable("document_policies", {
  documentType: varchar("document_type", { length: 50 }).primaryKey(),
  warningDays: integer("warning_days").default(30),
  gracePeriodDays: integer("grace_period_days").default(7),
  blocksAssignments: boolean("blocks_assignments").default(true),
  isMandatory: boolean("is_mandatory").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Document access tokens for secure email links
export const documentAccessTokens = pgTable("document_access_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").references(() => documents.id, { onDelete: 'cascade' }),
  contractId: varchar("contract_id").references(() => contracts.id, { onDelete: 'cascade' }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdFor: varchar("created_for", { length: 50 }).notNull(), // 'email_notification', 'renewal_confirmation', 'view_document'
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

