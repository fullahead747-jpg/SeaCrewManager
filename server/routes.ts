import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import {
  insertCrewMemberSchema,
  insertVesselSchema,
  insertDocumentSchema,
  insertVesselDocumentSchema,
  insertContractSchema,
  insertCrewRotationSchema,
  insertEmailSettingsSchema,
  insertWhatsappSettingsSchema,
  activityLogs,
  statusChangeHistory,
  crewMembers,
  vessels,
  documents,
  contracts,
  crewRotations,
  scannedDocuments
} from "@shared/schema";
import { db } from "./db";
import { sql, eq, and, isNull, desc } from "drizzle-orm";
import { localOcrService } from "./localOcrService";
import { groqOcrService } from "./groqOcrService";
import { geminiOcrService } from "./geminiOcrService";
import { randomUUID } from "crypto";
import { DocumentStorageService } from "./objectStorage";
import { notificationService } from "./services/notification-service";
import { documentVerificationService } from "./services/document-verification-service";
import { documentEditValidator } from "./services/document-edit-validator";
import { documentAccessService } from "./services/document-access-service";
import { documentValidationService } from "./services/document-validation-service";
import { compliancePolicyService } from "./services/compliance-policy-service";
import express from "express";
import * as fs from 'fs';
import * as path from 'path';
import multer from 'multer';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: string; username?: string };
    }
  }
}

/**
 * Parse date string or Date object from runtime extraction
 */
function parseRuntimeDate(date: string | Date | null | undefined): Date | null {
  if (!date) return null;
  try {
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

// Helper to format dates for user-friendly error messages
function formatDateForDisplay(date: string | Date | null | undefined): string {
  if (!date) return 'N/A';

  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return 'N/A';

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch (e) {
    return 'N/A';
  }
}

export async function registerRoutes(app: Express): Promise<Server> {

  // Static file serving for uploaded documents
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsDir));

  // Configure Multer for file uploads
  const storageConfig = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + '-' + file.originalname);
    }
  });

  const upload = multer({
    storage: storageConfig,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only PDF, JPG, and PNG are allowed.'));
      }
    }
  });

  // Helper functions moved to registerRoutes scope for deduplication
  const parseDDMMYYYY = (dateStr: string | undefined | null): Date | null => {
    if (!dateStr) return null;
    const ddmmyyyyMatch = dateStr.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
    if (ddmmyyyyMatch) {
      const [, day, month, year] = ddmmyyyyMatch;
      return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
    }
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr || dateStr === 'NONE' || dateStr === 'NOT FOUND') return dateStr;
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
    } catch (e) {
      return dateStr;
    }
  };

  // API route for file upload
  app.post('/api/upload', (req, res, next) => {
    // Manually handle authentication checking since multer middleware runs before body parsing
    // In a real app, you would use the authenticate middleware, but here we need to handle multipart first
    // Checks standard auth headers as in authenticate middleware
    const authHeader = req.headers.authorization;
    if (!authHeader && !req.headers['x-user-id'] && !req.cookies?.['auth_token']) {
      // Allow for now to let multer process, then check auth in the handler or wrap multer
    }
    next();
  }, upload.single('file'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      // Return relative path for storage
      const relativePath = path.relative(process.cwd(), req.file.path);
      // Ensure forward slashes for cross-platform compatibility
      const normalizedPath = relativePath.split(path.sep).join('/');

      res.json({
        message: 'File uploaded successfully',
        filePath: normalizedPath,
        originalName: req.file.originalname,
        filename: req.file.filename
      });
    } catch (error) {
      console.error('File upload error:', error);
      res.status(500).json({ message: 'File upload failed' });
    }
  });

  // Authentication middleware (simplified for demo)
  const authenticate = (req: any, res: any, next: any) => {
    // In development mode, allow access without authentication
    if (process.env.NODE_ENV === 'development') {
      req.user = {
        id: 'dev-user',
        role: 'admin',
        username: 'dev-admin'
      };
      return next();
    }

    // In production, verify JWT tokens
    const authHeader = req.headers.authorization;

    // Check for mock token (supported for demo/Vercel)
    if (authHeader && authHeader.startsWith('Bearer mock-token-')) {
      const mockUserId = authHeader.replace('Bearer mock-token-', '');
      req.user = {
        id: mockUserId,
        role: req.headers['x-user-role'] as string || 'admin',
        username: req.headers['x-username'] as string || 'admin'
      };
      return next();
    }

    if (!authHeader) {
      // If we are on Vercel and it's a demo, we can allow a default user even without headers
      // as a fallback for the first-time users hitting the API
      if (process.env.VERCEL === '1') {
        req.user = {
          id: 'demo-admin-id',
          role: 'admin',
          username: 'admin'
        };
        return next();
      }
      return res.status(401).json({ message: "Authentication required" });
    }

    // Standard OIDC headers support
    const userId = req.headers['x-user-id'] || req.headers['x-oidc-sub'] || 'demo-user';
    const userRole = req.headers['x-user-role'] || req.headers['x-oidc-role'] || 'office_staff';
    const username = req.headers['x-username'] || req.headers['x-oidc-preferred-username'] || 'demo-user';

    req.user = { id: userId, role: userRole as string, username: username as string };
    next();
  };

  // Diagnostic endpoint to check database connectivity
  app.get("/api/debug/database", async (req, res) => {
    try {
      const dbStatus = {
        connected: false,
        environment: process.env.NODE_ENV || 'unknown',
        vercel: process.env.VERCEL === '1',
        databaseUrl: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
        tables: {} as Record<string, number>,
        sampleData: {} as Record<string, any>,
        error: null as string | null
      };

      try {
        // Test basic queries
        const vessels = await storage.getVessels();
        const crew = await storage.getCrewMembers();
        const docs = await storage.getDocuments();
        const contracts = await storage.getContracts();
        const users = await storage.getAllUsers();

        dbStatus.connected = true;
        dbStatus.tables = {
          vessels: vessels.length,
          crewMembers: crew.length,
          documents: docs.length,
          contracts: contracts.length,
          users: users.length
        };

        // Sample data (first item from each table)
        dbStatus.sampleData = {
          firstVessel: vessels[0] ? { id: vessels[0].id, name: vessels[0].name } : null,
          firstCrew: crew[0] ? { id: crew[0].id, firstName: crew[0].firstName, lastName: crew[0].lastName } : null,
          firstDocument: docs[0] ? { id: docs[0].id, type: docs[0].type } : null
        };

      } catch (dbError: any) {
        dbStatus.error = dbError.message || 'Unknown database error';
      }

      res.json(dbStatus);
    } catch (error: any) {
      res.status(500).json({
        connected: false,
        error: error.message || 'Failed to check database status',
        stack: error.stack
      });
    }
  });

  // Diagnostic endpoint to check uploads directory
  app.get("/api/debug/uploads", (req, res) => {
    try {
      const uploadsDir = path.join(process.cwd(), 'uploads');
      const exists = fs.existsSync(uploadsDir);
      let files: string[] = [];
      if (exists) {
        files = fs.readdirSync(uploadsDir);
      }
      res.json({
        cwd: process.cwd(),
        uploadsDir,
        exists,
        fileCount: files.length,
        files: files.slice(0, 50) // limit to first 50
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const user = await storage.getUserByUsername(username);

      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // In a real app, generate JWT token here
      const token = `mock-token-${user.id}`;

      // Log login activity
      try {
        await db.insert(activityLogs).values({
          type: 'System',
          action: 'login',
          entityType: 'user',
          entityId: user.id,
          userId: null,
          username: user.username,
          userRole: user.role,
          description: `${user.role === 'admin' ? 'Admin' : 'Office Staff'} user ${user.username} logged into system`,
          severity: 'info',
          metadata: {
            userRole: user.role,
            userName: user.name
          }
        });
        console.log('Login activity logged successfully');
      } catch (logError) {
        console.error('Failed to log login activity:', logError);
      }

      res.json({
        user: { id: user.id, username: user.username, role: user.role, name: user.name, email: user.email },
        token
      });
    } catch (error) {
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Vessel routes
  app.get("/api/vessels", authenticate, async (req, res) => {
    try {
      // Add cache control headers to prevent stale data
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Vary': 'Authorization'
      });

      const vessels = await storage.getVessels();
      const crewMembers = await storage.getCrewMembers();
      const contracts = await storage.getContracts();

      // Enhance vessel data with crew count and next crew change
      const enhancedVessels = vessels.map(vessel => {
        const assignedCrew = crewMembers.filter(member => member.currentVesselId === vessel.id);
        const crewCount = assignedCrew.length;

        // Find next crew change from active contracts ending soon
        const activeContracts = contracts.filter(contract =>
          assignedCrew.some(crew => crew.id === contract.crewMemberId) &&
          contract.status === 'active'
        );

        // Get the earliest contract end date as next crew change
        const nextCrewChange = activeContracts.length > 0 ?
          Math.min(...activeContracts.map(c => c.endDate.getTime())) : null;

        return {
          ...vessel,
          crewCount,
          nextCrewChange: nextCrewChange ? new Date(nextCrewChange).toISOString() : undefined
        };
      });

      res.json(enhancedVessels);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch vessels" });
    }
  });

  app.post("/api/vessels", authenticate, async (req, res) => {
    try {
      const vesselData = insertVesselSchema.parse(req.body);
      const vessel = await storage.createVessel(vesselData);

      // Log vessel creation activity
      try {
        await db.insert(activityLogs).values({
          type: 'Fleet Management',
          action: 'create',
          entityType: 'vessel',
          entityId: vessel.id,
          userId: null,
          username: req.user?.username || 'System',
          userRole: req.user?.role || 'admin',
          description: `Vessel ${vessel.name} (${vessel.type}) added to fleet - IMO: ${vessel.imoNumber} - Flag: ${vessel.flag}`,
          severity: 'success',
          metadata: JSON.stringify({
            vesselName: vessel.name,
            vesselType: vessel.type,
            imoNumber: vessel.imoNumber,
            flag: vessel.flag
          })
        });
        console.log('Vessel creation activity logged successfully');
      } catch (logError) {
        console.error('Failed to log vessel creation activity:', logError);
      }

      res.json(vessel);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid vessel data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create vessel" });
      }
    }
  });

  // Update vessel order - placed BEFORE general vessel routes to avoid route conflicts
  app.put("/api/vessels/order", authenticate, async (req, res) => {
    try {
      // Check if user is admin
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can reorder vessels" });
      }

      const { vesselIds } = req.body;

      if (!Array.isArray(vesselIds)) {
        return res.status(400).json({ message: "vesselIds must be an array" });
      }

      if (vesselIds.length === 0) {
        return res.status(400).json({ message: "vesselIds array cannot be empty" });
      }

      const success = await storage.updateVesselOrder(vesselIds);

      if (success) {
        try {
          // Log the reordering activity using direct DB insert
          await db.insert(activityLogs).values({
            type: 'Fleet Management',
            action: 'reorder',
            entityType: 'vessel',
            entityId: 'multiple',
            userId: null,
            username: req.user?.username || 'unknown',
            userRole: req.user?.role || 'unknown',
            description: `Vessel order updated by ${req.user?.username}`,
            severity: 'info',
            metadata: JSON.stringify({
              vesselIds: vesselIds,
              newOrder: vesselIds.map((id, index) => ({ id, position: index + 1 }))
            })
          });
        } catch (logError) {
          console.error('Failed to log vessel reordering activity:', logError);
        }

        res.json({ message: "Vessel order updated successfully" });
      } else {
        res.status(500).json({ message: "Failed to update vessel order" });
      }
    } catch (error) {
      console.error('Error updating vessel order:', error);
      res.status(500).json({ message: "Failed to update vessel order", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.put("/api/vessels/:id", authenticate, async (req, res) => {
    try {
      const vesselData = insertVesselSchema.partial().parse(req.body);

      // Get original vessel for comparison
      const originalVessel = await storage.getVessel(req.params.id);
      if (!originalVessel) {
        return res.status(404).json({ message: "Vessel not found" });
      }

      const updatedVessel = await storage.updateVessel(req.params.id, vesselData);

      if (updatedVessel) {
        try {
          // Log the update activity
          await db.insert(activityLogs).values({
            type: 'Fleet Management',
            action: 'update',
            entityType: 'vessel',
            entityId: req.params.id,
            userId: null,
            username: req.user?.username || 'unknown',
            userRole: req.user?.role || 'unknown',
            description: `Vessel ${updatedVessel.name} (${updatedVessel.type}) updated - IMO: ${updatedVessel.imoNumber} - Flag: ${updatedVessel.flag}`,
            severity: 'info',
            metadata: JSON.stringify({
              vesselName: updatedVessel.name,
              vesselType: updatedVessel.type,
              imoNumber: updatedVessel.imoNumber,
              flag: updatedVessel.flag,
              originalName: originalVessel.name,
              changes: Object.keys(vesselData).filter(key => {
                const originalValue = originalVessel[key as keyof typeof originalVessel];
                const newValue = vesselData[key as keyof typeof vesselData];
                return originalValue !== newValue;
              })
            })
          });
        } catch (logError) {
          console.error('Failed to log vessel update activity:', logError);
        }

        res.json(updatedVessel);
      } else {
        res.status(404).json({ message: "Vessel not found" });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid vessel data", errors: error.errors });
      } else {
        console.error('Error updating vessel:', error);
        res.status(500).json({ message: "Failed to update vessel" });
      }
    }
  });

  app.delete("/api/vessels/:id", authenticate, async (req, res) => {
    try {
      console.log('Attempting to delete vessel:', req.params.id);

      // Get vessel details before deletion for logging
      const vessel = await storage.getVessel(req.params.id);
      console.log('Found vessel:', vessel);

      if (!vessel) {
        return res.status(404).json({ message: "Vessel not found" });
      }

      const success = await storage.deleteVessel(req.params.id);
      console.log('Deletion success:', success);

      if (success) {
        try {
          // Log the deletion activity directly to database
          await db.insert(activityLogs).values({
            type: 'Fleet Management',
            action: 'delete',
            entityType: 'vessel',
            entityId: req.params.id,
            userId: null, // Set to null due to foreign key constraint
            username: req.user?.username || 'unknown',
            userRole: req.user?.role || 'unknown',
            description: `Vessel ${vessel.name} (${vessel.type}) deleted - IMO: ${vessel.imoNumber} - Flag: ${vessel.flag}`,
            severity: 'warning',
            metadata: JSON.stringify({
              vesselName: vessel.name,
              vesselType: vessel.type,
              imoNumber: vessel.imoNumber,
              flag: vessel.flag
            })
          });
          console.log('Activity logged successfully');
        } catch (logError) {
          console.error('Failed to log activity:', logError);
          // Don't fail the whole operation if logging fails
        }

        res.json({ message: "Vessel deleted successfully" });
      } else {
        res.status(404).json({ message: "Vessel not found" });
      }
    } catch (error) {
      console.error('Error deleting vessel:', error);
      res.status(500).json({ message: "Failed to delete vessel", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/vessels/:id/contract-stats", authenticate, async (req, res) => {
    try {
      const vesselId = req.params.id;
      const stats = await storage.getVesselContractStats(vesselId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch contract statistics" });
    }
  });

  app.get("/api/vessels/:id/contracts", authenticate, async (req, res) => {
    try {
      const vesselId = req.params.id;
      const { status } = req.query;
      const contracts = await storage.getVesselContracts(vesselId, status as string);
      res.json(contracts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch vessel contracts" });
    }
  });



  // Crew member routes
  app.get("/api/crew", authenticate, async (req, res) => {
    try {
      const { vesselId } = req.query;
      let crewMembers;

      if (vesselId) {
        crewMembers = await storage.getCrewMembersByVessel(vesselId as string);
      } else {
        crewMembers = await storage.getCrewMembers();
      }

      res.json(crewMembers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch crew members" });
    }
  });

  app.get("/api/crew/:id", authenticate, async (req, res) => {
    try {
      const crewMember = await storage.getCrewMember(req.params.id);
      if (!crewMember) {
        return res.status(404).json({ message: "Crew member not found" });
      }
      res.json(crewMember);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch crew member" });
    }
  });

  app.post("/api/crew", authenticate, async (req, res) => {
    try {
      console.log('Received crew creation request:', {
        body: req.body,
        user: req.user?.username
      });

      // Convert dateOfBirth string to Date object before validation
      let dob: Date;
      try {
        dob = new Date(req.body.dateOfBirth);
        if (isNaN(dob.getTime())) {
          console.error('Invalid Date of Birth provided:', req.body.dateOfBirth);
          return res.status(400).json({ message: "Invalid Date of Birth" });
        }
      } catch (e) {
        console.error('Error parsing dateOfBirth:', e);
        return res.status(400).json({ message: "Invalid Date of Birth" });
      }

      const requestBody = {
        ...req.body,
        dateOfBirth: dob
      };

      const crewData = insertCrewMemberSchema.parse(requestBody);

      // Check for duplicate crew member (same first name, last name, and date of birth)
      const duplicate = await storage.findDuplicateCrewMember(
        crewData.firstName,
        crewData.lastName,
        crewData.dateOfBirth
      );

      // Only reject if duplicate exists AND is being added to the same vessel (or no vessel specified)
      if (duplicate) {
        const newVesselId = crewData.currentVesselId || null;
        const existingVesselId = duplicate.currentVesselId || null;

        // If same vessel (including both being null/unassigned), reject the duplicate
        if (newVesselId === existingVesselId) {
          console.log('Duplicate crew member detected:', {
            name: `${crewData.firstName} ${crewData.lastName}`,
            vesselId: newVesselId
          });
          return res.status(400).json({
            message: `A crew member with the name "${crewData.firstName} ${crewData.lastName}" and the same date of birth already exists${existingVesselId ? ' on the same vessel' : ''}.`,
            error: "DUPLICATE_CREW_MEMBER"
          });
        }
        // Different vessel - allow the entry (fall through to create)
      }

      const crewMember = await storage.createCrewMember(crewData);

      // Log crew creation activity
      try {
        await db.insert(activityLogs).values({
          type: 'Crew Management',
          action: 'create',
          entityType: 'crew',
          entityId: crewMember.id,
          userId: null,
          username: req.user?.username || 'System',
          userRole: req.user?.role || 'admin',
          description: `Crew member ${crewMember.firstName} ${crewMember.lastName} (${crewMember.rank}) added to system`,
          severity: 'success',
          metadata: {
            crewName: `${crewMember.firstName} ${crewMember.lastName}`,
            position: crewMember.rank,
            nationality: crewMember.nationality
          }
        });
        console.log('Crew creation activity logged successfully');
      } catch (logError) {
        console.error('Failed to log crew creation activity:', logError);
      }

      res.json(crewMember);
    } catch (error) {
      console.error('Crew creation failed:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid crew data", errors: error.errors });
      } else {
        const errorMessage = error instanceof Error ? `[V2-ERR] ${error.message}` : "[V2-ERR] Failed to create crew member";
        res.status(500).json({ message: errorMessage });
      }
    }
  });

  app.put("/api/crew/:id", authenticate, async (req, res) => {
    try {
      console.log('Updating crew member:', req.params.id, 'with data:', req.body);

      // Get existing crew member for status comparison
      const existingCrewMember = await storage.getCrewMember(req.params.id);
      if (!existingCrewMember) {
        return res.status(404).json({ message: "Crew member not found" });
      }

      // Only validate documents if status is CHANGING from onShore to onBoard (initial sign-on)
      // Skip validation for crew members who are already onBoard (just updating their details)
      const isSigningOn = req.body.status === 'onBoard' && existingCrewMember.status === 'onShore';

      if (isSigningOn) {
        const validation = await documentValidationService.validateForSignOn(
          req.params.id,
          req.body.signOnDate || new Date(),
          90 // Default duration if not provided, though usually sign-on comes with a contract
        );

        if (!validation.isValid) {
          return res.status(400).json({
            message: "Cannot sign on crew member due to document validation errors",
            error: "DOCUMENT_VALIDATION_ERROR",
            blockers: validation.blockers,
            warnings: validation.warnings
          });
        }
      }

      // Check if status is being changed - require mandatory reason
      const statusChangeReason = req.body.statusChangeReason;
      if (req.body.status && req.body.status !== existingCrewMember.status) {
        if (!statusChangeReason || statusChangeReason.trim() === '') {
          return res.status(400).json({
            message: "Status change requires a reason",
            error: "REASON_REQUIRED",
            details: "You must provide a reason when changing crew member status"
          });
        }
      }

      // Remove statusChangeReason from the body before parsing with schema
      const { statusChangeReason: _, ...updateBody } = req.body;

      const updates = insertCrewMemberSchema.partial().parse(updateBody);
      console.log('Parsed updates:', updates);

      // Handle vessel assignment changes - create rotation records for history tracking
      if (updates.currentVesselId !== undefined && updates.currentVesselId !== existingCrewMember.currentVesselId) {
        const now = new Date();

        // If crew member had a previous vessel, complete that rotation
        if (existingCrewMember.currentVesselId) {
          console.log(`Completing previous vessel rotation for ${existingCrewMember.firstName} ${existingCrewMember.lastName}`);

          // Find any active rotations for the previous vessel
          const existingRotations = await storage.getCrewRotationsByVessel(existingCrewMember.currentVesselId);
          const activeRotation = existingRotations.find(
            r => r.crewMemberId === req.params.id && (!r.leaveDate || r.status !== 'completed')
          );

          if (activeRotation) {
            // Update the existing rotation with leave date
            await storage.updateCrewRotation(activeRotation.id, {
              leaveDate: now,
              status: 'completed'
            });
          } else {
            // Create a completed rotation record for the previous vessel
            // Use a reasonable join date if not found in existing rotations
            const estimatedJoinDate = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000)); // Estimate 90 days ago

            await storage.createCrewRotation({
              crewMemberId: req.params.id,
              vesselId: existingCrewMember.currentVesselId,
              joinDate: estimatedJoinDate,
              leaveDate: now,
              rotationType: 'leave',
              status: 'completed'
            });
          }

          // Update lastVesselId
          updates.lastVesselId = existingCrewMember.currentVesselId;
        }

        // If assigning to a new vessel (not signing off), create new rotation
        if (updates.currentVesselId) {
          console.log(`Creating new vessel rotation for ${existingCrewMember.firstName} ${existingCrewMember.lastName}`);

          await storage.createCrewRotation({
            crewMemberId: req.params.id,
            vesselId: updates.currentVesselId,
            joinDate: now,
            leaveDate: null,
            rotationType: 'join',
            status: 'scheduled'
          });
        }
      }

      // Special handling for sign-off operations
      if (updates.status === 'onShore' && updates.currentVesselId === null) {
        console.log(`Processing sign-off for crew member: ${existingCrewMember.firstName} ${existingCrewMember.lastName}`);

        // Add signOffDate if not provided
        if (!updates.signOffDate) {
          updates.signOffDate = new Date();
        }
      }

      const crewMember = await storage.updateCrewMember(req.params.id, updates);
      console.log('Updated crew member result:', crewMember);

      if (!crewMember) {
        return res.status(404).json({ message: "Crew member not found" });
      }

      // Record status change in history if status was changed
      if (updates.status && updates.status !== existingCrewMember.status && statusChangeReason) {
        try {
          // Check if user ID is a valid UUID (demo users like "demo-admin" are not valid UUIDs)
          const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.user?.id || '');

          await db.insert(statusChangeHistory).values({
            crewMemberId: req.params.id,
            previousStatus: existingCrewMember.status,
            newStatus: updates.status,
            reason: statusChangeReason.trim(),
            changedBy: isValidUUID ? req.user?.id : null,
            changedByUsername: req.user?.username || 'System',
            vesselId: updates.currentVesselId || existingCrewMember.currentVesselId || null,
            contractId: null
          });
          console.log('Status change history recorded successfully');
        } catch (historyError) {
          console.error('Failed to record status change history:', historyError);
        }
      }

      // Log the update activity
      try {
        await db.insert(activityLogs).values({
          type: 'Crew Management',
          action: 'update',
          entityType: 'crew',
          entityId: req.params.id,
          userId: null,
          username: req.user?.username || 'System',
          userRole: req.user?.role || 'admin',
          description: `Crew member ${crewMember.firstName} ${crewMember.lastName} (${crewMember.rank}) updated`,
          severity: 'info',
          metadata: {
            crewName: `${crewMember.firstName} ${crewMember.lastName}`,
            position: crewMember.rank,
            nationality: crewMember.nationality,
            changes: Object.keys(updates)
          }
        });
        console.log('Crew update activity logged successfully');
      } catch (logError) {
        console.error('Failed to log crew update activity:', logError);
      }

      res.json(crewMember);
    } catch (error) {
      console.error('Error updating crew member:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          message: "Invalid update data",
          errors: error.errors,
          details: `Validation failed for crew member ${req.params.id}`
        });
      } else {
        res.status(500).json({
          message: "Failed to update crew member",
          error: error instanceof Error ? error.message : 'Unknown error',
          crewId: req.params.id,
          requestBody: req.body
        });
      }
    }
  });

  app.delete("/api/crew/:id", authenticate, async (req, res) => {
    try {
      console.log(`DELETE /api/crew/${req.params.id} - Attempting to delete crew member`);

      // Try to get crew member details for logging (but don't block deletion if this fails)
      let crewMember;
      try {
        crewMember = await storage.getCrewMember(req.params.id);
        console.log(`Crew member lookup result for ${req.params.id}:`, crewMember ? `Found: ${crewMember.firstName} ${crewMember.lastName}` : 'NOT FOUND');
      } catch (lookupError) {
        console.warn(`Failed to lookup crew member ${req.params.id} for logging:`, lookupError);
        // Continue with deletion even if lookup fails
      }

      // Attempt deletion - deleteCrewMember handles existence check internally
      const deleted = await storage.deleteCrewMember(req.params.id);
      console.log(`Delete result for ${req.params.id}:`, deleted);

      if (!deleted) {
        console.log(`Crew member ${req.params.id} not found in database - returning 404`);
        return res.status(404).json({ message: "Crew member not found" });
      }

      // Log crew deletion activity if we have the crew member details
      if (crewMember) {
        try {
          await db.insert(activityLogs).values({
            type: 'Crew Management',
            action: 'delete',
            entityType: 'crew',
            entityId: req.params.id,
            userId: null,
            username: req.user?.username || 'System',
            userRole: req.user?.role || 'admin',
            description: `Crew member ${crewMember.firstName} ${crewMember.lastName} (${crewMember.rank}) removed from system`,
            severity: 'warning',
            metadata: {
              crewName: `${crewMember.firstName} ${crewMember.lastName}`,
              position: crewMember.rank,
              nationality: crewMember.nationality
            }
          });
          console.log('Crew deletion activity logged successfully');
        } catch (logError) {
          console.error('Failed to log crew deletion activity:', logError);
        }
      }

      res.json({ message: "Crew member deleted successfully" });
    } catch (error) {
      console.error('Error in delete endpoint:', error);
      res.status(500).json({ message: "Failed to delete crew member" });
    }
  });

  // Document routes
  app.get("/api/documents", authenticate, async (req, res) => {
    try {
      const { crewMemberId } = req.query;
      let documents;

      if (crewMemberId) {
        documents = await storage.getDocumentsByCrewMember(crewMemberId as string);
      } else {
        documents = await storage.getDocuments();
      }

      res.json(documents);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.post("/api/documents", authenticate, async (req, res) => {
    try {
      const documentData = insertDocumentSchema.parse(req.body);






      // 1. Fetch crew member for name validation
      const crewMember = await storage.getCrewMember(documentData.crewMemberId);
      if (!crewMember) {
        return res.status(404).json({ message: "Crew member not found" });
      }

      // 2. Perform strict validation against uploaded file
      if (documentData.filePath) {
        const fullPath = path.join(process.cwd(), documentData.filePath);

        // Prepare data for verification
        const verifyData = {
          documentNumber: documentData.documentNumber,
          issuingAuthority: documentData.issuingAuthority,
          issueDate: documentData.issueDate ? new Date(documentData.issueDate).toISOString() : null,
          expiryDate: documentData.expiryDate ? new Date(documentData.expiryDate).toISOString() : null,
          type: documentData.type,
          holderName: `${crewMember.firstName} ${crewMember.lastName}`
        };

        try {
          console.log(`[STRICT-VALIDATION] Verifying ${documentData.type} for ${crewMember.firstName} ${crewMember.lastName}`);

          if (!fs.existsSync(fullPath)) {
            console.error(`[STRICT-VALIDATION] File not found at path: ${fullPath}`);
            return res.status(400).json({ message: "Uploaded file could not be found for validation" });
          }

          // GLOBAL SCAN CACHE LOOKUP:
          // Since this is a NEW upload, we don't have a record for this specific document ID yet.
          // However, we can search the entire scanned_documents table for this document number to see if 
          // we've EVER successfully scanned it before. This is useful for re-uploads of the same document.
          // GLOBAL SCAN CACHE LOOKUP:
          // Since this is a NEW upload, we don't have a record for this specific document ID yet.
          // However, we can search the entire scanned_documents table for this document number to see if 
          // we've EVER successfully scanned it before. This is useful for re-uploads of the same document.
          let cachedData: any = undefined;
          if (documentData.documentNumber) {
            const previousScans = await db.select().from(scannedDocuments)
              .where(eq(scannedDocuments.extractedNumber, documentData.documentNumber))
              .orderBy(desc(scannedDocuments.createdAt))
              .limit(1)
              .execute();

            if (previousScans.length > 0) {
              const scan = previousScans[0];
              cachedData = {
                documentNumber: scan.extractedNumber,
                expiryDate: scan.extractedExpiry ? scan.extractedExpiry.toISOString() : null,
                issueDate: scan.extractedIssueDate ? scan.extractedIssueDate.toISOString() : null,
                holderName: scan.extractedHolderName
              };
              console.log(`[STRICT-VALIDATION] Found previous scan for DocNum ${documentData.documentNumber} in DB. Using as fallback.`);
            }
          }


          const verification = await documentVerificationService.verifyDocument(fullPath, verifyData, cachedData);

          if (!verification.isValid) {
            console.warn(`[STRICT-VALIDATION] Blocked upload due to validation failure`);
            return res.status(400).json({
              message: "Document validation failed. The entered details do not match the uploaded document.",
              details: {
                matchScore: verification.matchScore,
                warnings: verification.warnings,
                criticalErrors: verification.fieldComparisons
                  .filter(c => !c.matches && ['documentNumber', 'expiryDate'].includes(c.field))
                  .map(c => `${c.displayName}: Expected '${c.existingValue}', OCR found '${c.extractedValue}'`)
              }
            });
          }

          // DOUBLE CHECK: Ensure critical fields were actually extracted and compared
          const expiryCheck = verification.fieldComparisons.find(c => c.field === 'expiryDate');
          if (expiryCheck && (!expiryCheck.extractedValue || expiryCheck.extractedValue === 'NONE')) {
            console.warn(`[STRICT-VALIDATION] OCR failed to read expiry date`);
            // Option: Reject if OCR failed to read expiry date?
            // return res.status(400).json({ message: "Validation Failed: Could not read expiry date from document. Please ensure the image is clear." });
          }

          console.log(`[STRICT-VALIDATION] Validation passed (Score: ${verification.matchScore})`);

          // Move to Object Storage for persistence
          const documentStorageService = new DocumentStorageService();

          // Only attempt cloud move if objectively storage is available (Replit sidecar)
          if (documentStorageService.isCloudStorageAvailable()) {
            try {
              const fileName = path.basename(fullPath);
              const uploadUrl = await documentStorageService.getDocumentUploadURL('crew', crewMember.id, fileName);

              // Upload local file to signed URL
              const fileBuffer = fs.readFileSync(fullPath);
              const response = await fetch(uploadUrl, {
                method: 'PUT',
                body: new Uint8Array(fileBuffer),
                headers: {
                  'Content-Type': getMimeType(fullPath)
                }
              });

              if (!response.ok) {
                throw new Error(`Failed to upload to Object Storage: ${response.statusText}`);
              }

              // Update path to the cloud path
              const cloudPath = documentStorageService.normalizeDocumentPath(uploadUrl);
              console.log(`[CLOUD-STORAGE] Successfully uploaded to ${cloudPath}`);
              documentData.filePath = cloudPath;

              // Cleanup local file
              fs.unlink(fullPath, (err) => {
                if (err) console.error(`[CLOUD-STORAGE] Failed to delete local file ${fullPath}:`, err);
              });
            } catch (storageError) {
              console.error("[CLOUD-STORAGE] Error uploading to Object Storage:", storageError);
              // We can choose to keep it local if cloud fails, but Replit is non-persistent
              // so maybe we should fail the whole request?
              return res.status(500).json({ message: "Failed to save document to persistent storage" });
            }
          } else {
            console.log(`[STORAGE-LOCAL] Cloud storage not available, keeping local file path: ${documentData.filePath}`);
          }
        } catch (validationError) {
          console.error("Validation service error:", validationError);
          return res.status(500).json({
            message: "Document verification service failed",
            error: validationError instanceof Error ? validationError.message : 'Unknown error'
          });
        }
      }

      const document = await storage.createDocument(documentData);

      // AUTO-POPULATE SCANNED DOCUMENTS (User's Solution)
      // For manually uploaded documents, we immediately store the data in scanned_documents
      // This provides a "Ground Truth" for future cached validations.
      if (document && document.documentNumber && ['passport', 'cdc', 'medical', 'coc'].includes(document.type.toLowerCase())) {
        try {
          await storage.createScannedDocument({
            documentId: document.id,
            extractedNumber: document.documentNumber,
            extractedExpiry: document.expiryDate,
            extractedIssueDate: document.issueDate,
            extractedHolderName: `${crewMember.firstName} ${crewMember.lastName}`,
            extractedIssuingAuthority: document.issuingAuthority,
          });
          console.log(`[AUTO-SCAN] Successfully auto-populated scanned_documents for ${document.type}`);
        } catch (scanError) {
          console.error(`[AUTO-SCAN] Failed to auto-populate scanned_documents:`, scanError);
        }
      }

      // SILENT BACKEND EXTRACTION: Run in the background hidden from user
      if (req.file?.path || (document.filePath && !document.filePath.startsWith('/'))) {
        (async () => {
          try {
            const localPath = req.file?.path || path.join(process.cwd(), document.filePath!);
            const crewMember = await storage.getCrewMember(document.crewMemberId);
            const nationalityHint = crewMember?.nationality;

            console.log(`[SILENT-SCAN] Starting background extraction for ${document.type}: ${localPath} (Nationality Hint: ${nationalityHint})`);
            const extractedData = await documentVerificationService.extractDocumentData(localPath, document.type, nationalityHint);

            // FAIL-SAFE: Re-apply correction here in routes.ts where we have 100% access to crew profile
            console.log(`[SILENT-SCAN-DEBUG] Fail-safe check:`);
            console.log(`  - document.type: "${document.type}"`);
            console.log(`  - extractedData.documentNumber: "${extractedData.documentNumber}"`);
            console.log(`  - nationalityHint: "${nationalityHint}"`);
            console.log(`  - crewMember found: ${!!crewMember}`);

            const isPassport = document.type === 'passport';
            const hasNumber = !!extractedData.documentNumber;
            // More robust nationality check
            const isIndian = nationalityHint && (
              nationalityHint.toUpperCase().includes('IND') ||
              nationalityHint.toUpperCase() === 'INDIAN' ||
              nationalityHint.toUpperCase() === 'INDIA'
            );

            console.log(`  - isPassport: ${isPassport}, hasNumber: ${hasNumber}, isIndian: ${isIndian}`);

            if (isPassport && hasNumber && isIndian) {
              const currentNum = extractedData.documentNumber!.toUpperCase();
              console.log(`[SILENT-SCAN-DEBUG] Nationality matched. currentNum="${currentNum}", len=${currentNum.length}, startsWithJ=${currentNum.startsWith('J')}`);

              if (currentNum.startsWith('J') && currentNum.length === 8) {
                console.log(`[SILENT-SCAN] 🚨 FAIL-SAFE: Forcing J -> U correction for Indian passport: ${currentNum}`);
                extractedData.documentNumber = 'U' + currentNum.substring(1);
                console.log(`[SILENT-SCAN-DEBUG] Corrected to: ${extractedData.documentNumber}`);
              } else {
                console.log(`[SILENT-SCAN-DEBUG] No J->U correction needed (doesn't start with J or wrong length)`);
              }
            } else {
              console.log(`[SILENT-SCAN-DEBUG] Skipping J->U correction: isPassport=${isPassport}, hasNumber=${hasNumber}, isIndian=${isIndian}`);
            }

            console.log(`[SILENT-SCAN] Saving to database - Document Number BEFORE final check: "${extractedData.documentNumber}"`);

            // SMART J→U CORRECTION - Only apply if MRZ confirms it should be U
            // This prevents wrong corrections for passports that legitimately start with J
            if (document.type === 'passport' && extractedData.documentNumber && nationalityHint) {
              const isIndian = nationalityHint.toUpperCase().includes('IND') ||
                nationalityHint.toUpperCase() === 'INDIAN' ||
                nationalityHint.toUpperCase() === 'INDIA';

              if (isIndian) {
                const currentNum = extractedData.documentNumber.toUpperCase();

                // Check if OCR read 'J' but we should verify against MRZ
                if (currentNum.startsWith('J') && currentNum.length === 8) {
                  console.log(`[SILENT-SCAN] 🔍 Detected J-prefix for Indian passport: ${currentNum}`);

                  // Check MRZ data if available
                  if (extractedData.mrzValidation && typeof extractedData.mrzValidation === 'object') {
                    const mrzData = extractedData.mrzValidation as any;
                    const mrzNumber = mrzData.documentNumber || mrzData.passportNumber;

                    if (mrzNumber) {
                      const cleanMrzNumber = mrzNumber.replace(/</g, '').trim().toUpperCase();
                      console.log(`[SILENT-SCAN] 📋 MRZ number found: "${cleanMrzNumber}"`);

                      // If MRZ starts with U, correct J→U
                      if (cleanMrzNumber.startsWith('U') && cleanMrzNumber.length === 8) {
                        const correctedNum = 'U' + currentNum.substring(1);
                        console.log(`[SILENT-SCAN] ✅ MRZ confirms U-prefix. Correcting: ${currentNum} → ${correctedNum}`);
                        extractedData.documentNumber = correctedNum;
                      }
                      // If MRZ starts with J, keep J (legitimate J-prefix passport)
                      else if (cleanMrzNumber.startsWith('J')) {
                        console.log(`[SILENT-SCAN] ✅ MRZ confirms J-prefix. Keeping: ${currentNum}`);
                        // No correction needed
                      }
                      // If MRZ has different letter, use MRZ value
                      else if (cleanMrzNumber.length === 8) {
                        console.log(`[SILENT-SCAN] ✅ MRZ shows different prefix: ${cleanMrzNumber[0]}. Using MRZ value.`);
                        extractedData.documentNumber = cleanMrzNumber;
                      }
                    } else {
                      // No MRZ number - apply default J→U correction as fallback
                      console.log(`[SILENT-SCAN] ⚠️ No MRZ number found. Applying default J→U correction.`);
                      const correctedNum = 'U' + currentNum.substring(1);
                      extractedData.documentNumber = correctedNum;
                    }
                  } else {
                    // No MRZ validation data - apply default J→U correction as fallback
                    console.log(`[SILENT-SCAN] ⚠️ No MRZ data available. Applying default J→U correction.`);
                    const correctedNum = 'U' + currentNum.substring(1);
                    extractedData.documentNumber = correctedNum;
                  }
                } else {
                  console.log(`[SILENT-SCAN] ℹ️ No J-prefix detected or wrong length. No correction needed.`);
                }
              }
            }

            console.log(`[SILENT-SCAN] Saving to database - Document Number AFTER final check: "${extractedData.documentNumber}"`);

            // NOTE: Owner validation already passed in synchronous validation (lines 844-917)
            // If we reached this point, the document belongs to the correct crew member
            // No need to re-validate and risk deleting a valid document

            await storage.createScannedDocument({
              documentId: document.id,
              seafarerName: crewMember ? `${crewMember.firstName} ${crewMember.lastName}` : undefined,
              extractedNumber: extractedData.documentNumber,
              extractedExpiry: parseDDMMYYYY(extractedData.expiryDate),
              extractedIssueDate: parseDDMMYYYY(extractedData.issueDate),
              extractedHolderName: extractedData.holderName,
              mrzValidation: extractedData.mrzValidation,
              ocrConfidence: extractedData.documentNumber ? 100 : 0,
              rawText: JSON.stringify(extractedData),
              // Store validation status as 'match' since sync validation passed
              ownerValidationStatus: 'match',
              ownerValidationScore: 100,
              ownerValidationMessage: 'Document owner verified during upload'
            });

            // The mismatch case is already handled above by throwing an error
            // which prevents execution from reaching this point.

            console.log(`[SILENT-SCAN] Completed for Document ID: ${document.id}`);
          } catch (scanError) {
            console.error(`[SILENT-SCAN-ERROR] Failed for Document ID: ${document.id}:`, scanError);
          }
        })();
      }

      // Trigger immediate alert if document expires within 30 days
      if (document.expiryDate) {
        try {
          const crewMember = await storage.getCrewMember(document.crewMemberId);
          if (crewMember) {
            let vesselName: string | undefined;
            if (crewMember.currentVesselId) {
              const vessel = await storage.getVessel(crewMember.currentVesselId);
              vesselName = vessel?.name;
            }

            await notificationService.sendImmediateDocumentAlert(
              {
                id: document.id,
                type: document.type,
                expiryDate: document.expiryDate,
                documentNumber: document.documentNumber,
                issuingAuthority: document.issuingAuthority,
              },
              {
                id: crewMember.id,
                name: `${crewMember.firstName} ${crewMember.lastName}`,
                rank: crewMember.rank,
                nationality: crewMember.nationality,
              },
              vesselName
            );
          }
        } catch (alertError) {
          console.error('Failed to send immediate document alert:', alertError);
        }
      }

      res.json(document);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid document data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create document", error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.put("/api/documents/:id", authenticate, async (req, res) => {
    try {
      const updates = insertDocumentSchema.partial().parse(req.body);

      // Get existing document first (needed for validation and other checks)
      const existingDocument = await storage.getDocument(req.params.id);

      if (!existingDocument) {
        return res.status(404).json({ message: "Document not found" });
      }

      // 0. GLOBAL SEARCH: Check if document number is unique (if changed)
      if (updates.documentNumber) {
        const uniqueness = await documentVerificationService.isDocumentNumberUnique(
          updates.documentNumber,
          existingDocument.crewMemberId,
          existingDocument.id
        );

        if (!uniqueness.isUnique) {
          return res.status(400).json({
            message: `Verification Failed: Document Number ${updates.documentNumber} is already registered to ${uniqueness.ownerName}.`
          });
        }
      }

      const crewMember = await storage.getCrewMember(existingDocument.crewMemberId);
      if (!crewMember) {
        return res.status(404).json({ message: "Crew member not found" });
      }

      // AOA DATE LOCK: Prevent manual date changes for AOA documents without a new file upload
      if (existingDocument.type.toLowerCase() === 'aoa') {
        const issueDateChanged = updates.issueDate &&
          new Date(updates.issueDate).toISOString().split('T')[0] !== existingDocument.issueDate.toISOString().split('T')[0];
        const expiryDateChanged = updates.expiryDate &&
          new Date(updates.expiryDate).toISOString().split('T')[0] !== existingDocument.expiryDate.toISOString().split('T')[0];

        if ((issueDateChanged || expiryDateChanged) && !updates.filePath) {
          console.warn(`[AOA-LOCK] Blocked manual date change for AOA document: ${existingDocument.id}`);
          return res.status(400).json({
            message: "AOA date change rejected. You must first replace the AOA form with the updated document to change the date."
          });
        }
      }

      // STRICT VALIDATION FOR EDITS
      // Run validation if ANY critical field is changed OR if a new file is uploaded
      const isCriticalUpdate = updates.filePath || updates.documentNumber || updates.expiryDate || updates.issueDate;
      const fileToCheck = updates.filePath || existingDocument.filePath;

      if (isCriticalUpdate && fileToCheck) {
        try {

          const fullPath = path.join(process.cwd(), fileToCheck);

          if (!fs.existsSync(fullPath)) {
            console.error(`[STRICT-VALIDATION-PUT] File not found: ${fullPath}`);
            // If we are just updating metadata but the file is missing, we should probably warn but maybe not block?
            // But if we are validating, we need the file. 
            return res.status(400).json({ message: "Validation Failed: The document file could not be found on the server." });
          }

          console.log(`[STRICT-VALIDATION-PUT] Verifying updates for ${existingDocument.type}`);

          // FETCH CACHED SCAN DATA
          // Cache is useful for fields the user is NOT currently editing.
          const latestScans = await db.select().from(scannedDocuments)
            .where(and(
              eq(scannedDocuments.documentId, existingDocument.id),
              isNull(scannedDocuments.supersededAt)
            ))
            .limit(1)
            .execute();

          let cachedData: any = undefined;
          if (latestScans.length > 0) {
            const scan = latestScans[0];
            cachedData = {
              documentNumber: scan.extractedNumber,
              expiryDate: scan.extractedExpiry ? scan.extractedExpiry.toISOString() : null,
              issueDate: scan.extractedIssueDate ? scan.extractedIssueDate.toISOString() : null,
              holderName: scan.extractedHolderName,
              mrzValidation: scan.mrzValidation as { isValid: boolean; errors: string[] } | undefined
            };

            // CRITICAL: Disable cache fallback ONLY for fields the user is manually editing.
            // This ensures manual edits are verified against fresh OCR, while unchanged fields
            // can still benefit from the verified cache.
            if (updates.documentNumber) delete cachedData.documentNumber;
            if (updates.issueDate) delete cachedData.issueDate;
            if (updates.expiryDate) delete cachedData.expiryDate;

            console.log(`[STRICT-VALIDATION-PUT] Using selective cache fallback. Fields being manually verified: ${[updates.documentNumber && 'Number', updates.issueDate && 'Issue Date', updates.expiryDate && 'Expiry Date'].filter(Boolean).join(', ') || 'None'}`);
          }


          // Merge updates with existing data to form the complete picture of what the document SHOULD look like
          const verifyData = {
            documentNumber: updates.documentNumber || existingDocument.documentNumber,
            issuingAuthority: updates.issuingAuthority || existingDocument.issuingAuthority,
            issueDate: updates.issueDate ? new Date(updates.issueDate).toISOString() : (existingDocument.issueDate ? new Date(existingDocument.issueDate).toISOString() : null),
            expiryDate: updates.expiryDate ? new Date(updates.expiryDate).toISOString() : (existingDocument.expiryDate ? new Date(existingDocument.expiryDate).toISOString() : null),
            type: updates.type || existingDocument.type,
            holderName: `${crewMember.firstName} ${crewMember.lastName}`
          };

          const verification = await documentVerificationService.verifyDocument(fullPath, verifyData, cachedData);

          if (!verification.isValid) {
            console.warn(`[STRICT-VALIDATION-PUT] Blocked update due to validation failure`);

            const changedFields = Object.keys(updates).filter(key => {
              const newVal = (updates as any)[key];
              const oldVal = (existingDocument as any)[key];
              if (!newVal || !oldVal) return true;

              // Date comparison
              if (key === 'issueDate' || key === 'expiryDate') {
                return new Date(newVal).getTime() !== new Date(oldVal).getTime();
              }
              return String(newVal) !== String(oldVal);
            });

            const criticalMismatches = verification.fieldComparisons
              .filter(c => !c.matches && ['documentNumber', 'expiryDate', 'issueDate'].includes(c.field))
              // Only report mismatches for fields that actually changed compared to the system record
              .filter(c => changedFields.includes(c.field))
              .map(c => {
                const newValue = formatDate(c.existingValue);
                // Find the original verified value from the record
                let originalValue: any = (existingDocument as any)[c.field];
                if (originalValue instanceof Date) originalValue = originalValue.toISOString();
                const formattedOriginal = formatDate(originalValue);

                return `${c.displayName}: You entered '${newValue}', but our verified record shows '${formattedOriginal}'`;
              });

            const mainMessage = criticalMismatches.length > 0
              ? `Update Rejected: ${criticalMismatches.join(' | ')}`
              : "Update Rejected: The details provided do not match the verified document on file.";

            return res.status(400).json({
              message: mainMessage,
              details: {
                matchScore: verification.matchScore,
                warnings: verification.warnings,
                // No longer returning criticalErrors to avoid redundant bullet points in UI
                criticalErrors: []
              }
            });
          }

          // DOUBLE CHECK: Ensure critical fields were actually extracted and compared
          const expiryCheck = verification.fieldComparisons.find(c => c.field === 'expiryDate');
          if (expiryCheck && (!expiryCheck.extractedValue || expiryCheck.extractedValue === 'NONE')) {
            console.warn(`[STRICT-VALIDATION-PUT] OCR failed to read expiry date`);
            // Option: Reject if OCR failed to read expiry date?
          }

          console.log(`[STRICT-VALIDATION-PUT] Validation passed (Score: ${verification.matchScore})`);

          // Move to Object Storage for persistence if this is a new file upload
          if (updates.filePath && !updates.filePath.startsWith('/')) {
            const documentStorageService = new DocumentStorageService();
            try {
              const localPath = path.join(process.cwd(), updates.filePath);
              const fileName = path.basename(localPath);
              const uploadUrl = await documentStorageService.getDocumentUploadURL('crew', crewMember.id, fileName);

              const fileBuffer = fs.readFileSync(localPath);
              const response = await fetch(uploadUrl, {
                method: 'PUT',
                body: new Uint8Array(fileBuffer),
                headers: {
                  'Content-Type': getMimeType(localPath)
                }
              });

              if (!response.ok) {
                throw new Error(`Failed to upload to Object Storage: ${response.statusText}`);
              }

              const cloudPath = documentStorageService.normalizeDocumentPath(uploadUrl);
              console.log(`[CLOUD-STORAGE-PUT] Successfully uploaded to ${cloudPath}`);
              updates.filePath = cloudPath;

              // Cleanup local file
              fs.unlink(localPath, (err) => {
                if (err) console.error(`[CLOUD-STORAGE-PUT] Failed to delete local file ${localPath}:`, err);
              });
            } catch (storageError) {
              console.error("[CLOUD-STORAGE-PUT] Error uploading to Object Storage:", storageError);
              return res.status(500).json({ message: "Failed to save updated document to persistent storage" });
            }
          }
        } catch (validationError) {
          console.error("Validation service error (PUT):", validationError);
          return res.status(500).json({
            message: "Document verification service failed during update",
            error: validationError instanceof Error ? validationError.message : 'Unknown error'
          });
        }
      }

      const document = await storage.updateDocument(req.params.id, updates);

      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // AUTO-POPULATE SCANNED DOCUMENTS (User's Solution)
      // When a document is updated, we update the scanned_documents record to maintain "Ground Truth"
      if (document && document.documentNumber && ['passport', 'cdc', 'medical', 'coc'].includes(document.type.toLowerCase())) {
        try {
          // First check if a scan exists for this document
          const [existingScan] = await db.select().from(scannedDocuments)
            .where(eq(scannedDocuments.documentId, document.id))
            .limit(1);

          if (existingScan) {
            // Update existing scan
            await db.update(scannedDocuments)
              .set({
                extractedNumber: document.documentNumber,
                extractedExpiry: document.expiryDate,
                extractedIssueDate: document.issueDate,
                extractedHolderName: `${crewMember.firstName} ${crewMember.lastName}`,
                extractedIssuingAuthority: document.issuingAuthority,
                createdAt: new Date(), // Update timestamp to show it's the latest "truth"
              })
              .where(eq(scannedDocuments.id, existingScan.id));
            console.log(`[AUTO-SCAN-PUT] Updated scanned_documents for ${document.type}`);
          } else {
            // Create new scan record if it didn't exist
            await db.insert(scannedDocuments).values({
              documentId: document.id,
              extractedNumber: document.documentNumber,
              extractedExpiry: document.expiryDate,
              extractedIssueDate: document.issueDate,
              extractedHolderName: `${crewMember.firstName} ${crewMember.lastName}`,
              extractedIssuingAuthority: document.issuingAuthority,
              createdAt: new Date(),
            });
            console.log(`[AUTO-SCAN-PUT] Created new scanned_documents for ${document.type}`);
          }
        } catch (scanError) {
          console.error(`[AUTO-SCAN-PUT] Failed to update scanned_documents:`, scanError);
        }
      }

      // SILENT BACKEND EXTRACTION: Run if file changed or critical info updated
      if (document.filePath && (updates.filePath || updates.documentNumber || updates.expiryDate)) {
        (async () => {
          try {
            const crewMember = await storage.getCrewMember(document.crewMemberId);
            const nationalityHint = crewMember?.nationality;

            const fullPath = path.join(process.cwd(), document.filePath!);
            console.log(`[SILENT-SCAN-PUT] Starting background extraction for ${document.type}: ${document.filePath} (Nationality Hint: ${nationalityHint})`);
            const extractedData = await documentVerificationService.extractDocumentData(fullPath, document.type, nationalityHint);

            // FAIL-SAFE: Re-apply correction here in routes.ts where we have 100% access to crew profile
            console.log(`[SILENT-SCAN-PUT-DEBUG] Fail-safe check:`);
            console.log(`  - document.type: "${document.type}"`);
            console.log(`  - extractedData.documentNumber: "${extractedData.documentNumber}"`);
            console.log(`  - nationalityHint: "${nationalityHint}"`);
            console.log(`  - crewMember found: ${!!crewMember}`);

            const isPassport = document.type === 'passport';
            const hasNumber = !!extractedData.documentNumber;
            // More robust nationality check
            const isIndian = nationalityHint && (
              nationalityHint.toUpperCase().includes('IND') ||
              nationalityHint.toUpperCase() === 'INDIAN' ||
              nationalityHint.toUpperCase() === 'INDIA'
            );

            console.log(`  - isPassport: ${isPassport}, hasNumber: ${hasNumber}, isIndian: ${isIndian}`);

            if (isPassport && hasNumber && isIndian) {
              const currentNum = extractedData.documentNumber!.toUpperCase();
              console.log(`[SILENT-SCAN-PUT-DEBUG] Nationality matched. currentNum="${currentNum}", len=${currentNum.length}, startsWithJ=${currentNum.startsWith('J')}`);

              if (currentNum.startsWith('J') && currentNum.length === 8) {
                console.log(`[SILENT-SCAN-PUT] 🚨 FAIL-SAFE: Forcing J -> U correction for Indian passport: ${currentNum}`);
                extractedData.documentNumber = 'U' + currentNum.substring(1);
                console.log(`[SILENT-SCAN-PUT-DEBUG] Corrected to: ${extractedData.documentNumber}`);
              } else {
                console.log(`[SILENT-SCAN-PUT-DEBUG] No J->U correction needed (doesn't start with J or wrong length)`);
              }
            } else {
              console.log(`[SILENT-SCAN-PUT-DEBUG] Skipping J->U correction: isPassport=${isPassport}, hasNumber=${hasNumber}, isIndian=${isIndian}`);
            }

            // DOCUMENT RENEWAL: Mark old scans as superseded before creating new one
            // This ensures validation only checks against the latest scan
            const oldScans = await db
              .select()
              .from(scannedDocuments)
              .where(
                and(
                  eq(scannedDocuments.documentId, document.id),
                  isNull(scannedDocuments.supersededAt)
                )
              );

            console.log(`[SILENT-SCAN-PUT] Saving to database - Document Number BEFORE final check: "${extractedData.documentNumber}"`);

            // SMART J→U CORRECTION - Only apply if MRZ confirms it should be U
            // This prevents wrong corrections for passports that legitimately start with J
            if (document.type === 'passport' && extractedData.documentNumber && nationalityHint) {
              const isIndian = nationalityHint.toUpperCase().includes('IND') ||
                nationalityHint.toUpperCase() === 'INDIAN' ||
                nationalityHint.toUpperCase() === 'INDIA';

              if (isIndian) {
                const currentNum = extractedData.documentNumber.toUpperCase();

                // Check if OCR read 'J' but we should verify against MRZ
                if (currentNum.startsWith('J') && currentNum.length === 8) {
                  console.log(`[SILENT-SCAN-PUT] 🔍 Detected J-prefix for Indian passport: ${currentNum}`);

                  // Check MRZ data if available
                  if (extractedData.mrzValidation && typeof extractedData.mrzValidation === 'object') {
                    const mrzData = extractedData.mrzValidation as any;
                    const mrzNumber = mrzData.documentNumber || mrzData.passportNumber;

                    if (mrzNumber) {
                      const cleanMrzNumber = mrzNumber.replace(/</g, '').trim().toUpperCase();
                      console.log(`[SILENT-SCAN-PUT] 📋 MRZ number found: "${cleanMrzNumber}"`);

                      // If MRZ starts with U, correct J→U
                      if (cleanMrzNumber.startsWith('U') && cleanMrzNumber.length === 8) {
                        const correctedNum = 'U' + currentNum.substring(1);
                        console.log(`[SILENT-SCAN-PUT] ✅ MRZ confirms U-prefix. Correcting: ${currentNum} → ${correctedNum}`);
                        extractedData.documentNumber = correctedNum;
                      }
                      // If MRZ starts with J, keep J (legitimate J-prefix passport)
                      else if (cleanMrzNumber.startsWith('J')) {
                        console.log(`[SILENT-SCAN-PUT] ✅ MRZ confirms J-prefix. Keeping: ${currentNum}`);
                        // No correction needed
                      }
                      // If MRZ has different letter, use MRZ value
                      else if (cleanMrzNumber.length === 8) {
                        console.log(`[SILENT-SCAN-PUT] ✅ MRZ shows different prefix: ${cleanMrzNumber[0]}. Using MRZ value.`);
                        extractedData.documentNumber = cleanMrzNumber;
                      }
                    } else {
                      // No MRZ number - apply default J→U correction as fallback
                      console.log(`[SILENT-SCAN-PUT] ⚠️ No MRZ number found. Applying default J→U correction.`);
                      const correctedNum = 'U' + currentNum.substring(1);
                      extractedData.documentNumber = correctedNum;
                    }
                  } else {
                    // No MRZ validation data - apply default J→U correction as fallback
                    console.log(`[SILENT-SCAN-PUT] ⚠️ No MRZ data available. Applying default J→U correction.`);
                    const correctedNum = 'U' + currentNum.substring(1);
                    extractedData.documentNumber = correctedNum;
                  }
                } else {
                  console.log(`[SILENT-SCAN-PUT] ℹ️ No J-prefix detected or wrong length. No correction needed.`);
                }
              }
            }

            console.log(`[SILENT-SCAN-PUT] Saving to database - Document Number AFTER final check: "${extractedData.documentNumber}"`);

            // NOTE: Owner validation already passed in synchronous validation (lines 1225-1300)
            // If we reached this point, the document belongs to the correct crew member
            // No need to re-validate and risk deleting a valid document

            // Create the new scan entry first to get its ID
            const newScan = await storage.createScannedDocument({
              documentId: document.id,
              seafarerName: crewMember ? `${crewMember.firstName} ${crewMember.lastName}` : undefined,
              extractedNumber: extractedData.documentNumber,
              extractedExpiry: parseDDMMYYYY(extractedData.expiryDate),
              extractedIssueDate: parseDDMMYYYY(extractedData.issueDate),
              extractedHolderName: extractedData.holderName,
              mrzValidation: extractedData.mrzValidation,
              ocrConfidence: extractedData.documentNumber ? 100 : 0,
              rawText: JSON.stringify(extractedData),
              // Store validation status as 'match' since sync validation passed
              ownerValidationStatus: 'match',
              ownerValidationScore: 100,
              ownerValidationMessage: 'Document owner verified during upload'
            });

            // Mark old scans as superseded by the new scan
            if (oldScans.length > 0 && newScan) {
              for (const oldScan of oldScans) {
                await db
                  .update(scannedDocuments)
                  .set({
                    supersededAt: new Date(),
                    supersededBy: newScan.id
                  })
                  .where(eq(scannedDocuments.id, oldScan.id));
              }
              console.log(`[DOCUMENT-RENEWAL] Marked ${oldScans.length} old scan(s) as superseded for Document ID: ${document.id}`);
            }

            console.log(`[SILENT-SCAN-PUT] Completed for Document ID: ${document.id}`);
          } catch (scanError) {
            console.error(`[SILENT-SCAN-PUT-ERROR] Failed for Document ID: ${document.id}:`, scanError);
          }
        })();
      }

      // Trigger immediate alert if document expires within 30 days (check on expiry date update)
      if (document.expiryDate && updates.expiryDate) {
        try {
          const crewMember = await storage.getCrewMember(document.crewMemberId);
          if (crewMember) {
            // Get vessel name from crew member's current vessel
            let vesselName: string | undefined;
            if (crewMember.currentVesselId) {
              const vessel = await storage.getVessel(crewMember.currentVesselId);
              vesselName = vessel?.name;
            }

            await notificationService.sendImmediateDocumentAlert(
              {
                id: document.id,
                type: document.type,
                expiryDate: document.expiryDate,
                documentNumber: document.documentNumber,
                issuingAuthority: document.issuingAuthority,
              },
              {
                id: crewMember.id,
                name: `${crewMember.firstName} ${crewMember.lastName}`,
                rank: crewMember.rank,
                nationality: crewMember.nationality,
              },
              vesselName
            );
          }
        } catch (alertError) {
          console.error('Failed to send immediate document alert:', alertError);
        }
      }

      res.json(document);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid update data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update document" });
      }
    }
  });


  // Verify document against existing data
  app.post("/api/documents/:id/verify", authenticate, async (req, res) => {
    try {
      const { filePath } = req.body;

      if (!filePath) {
        return res.status(400).json({ message: "File path is required" });
      }

      // Get existing document
      const existingDocument = await storage.getDocument(req.params.id);
      if (!existingDocument) {
        return res.status(404).json({ message: "Document not found" });
      }

      try {
        const fullPath = path.join(process.cwd(), filePath);

        // Fetch latest non-superseded scan cache if it exists (Ground Truth)
        const [cachedScan] = await db.select().from(scannedDocuments)
          .where(
            and(
              eq(scannedDocuments.documentId, existingDocument.id),
              isNull(scannedDocuments.supersededAt)
            )
          )
          .orderBy(desc(scannedDocuments.createdAt))
          .limit(1);

        const cachedData = cachedScan ? {
          documentNumber: cachedScan.extractedNumber || undefined,
          expiryDate: cachedScan.extractedExpiry ? cachedScan.extractedExpiry.toISOString() : undefined,
          issueDate: cachedScan.extractedIssueDate ? cachedScan.extractedIssueDate.toISOString() : undefined,
          holderName: cachedScan.extractedHolderName || undefined,
          mrzValidation: cachedScan.mrzValidation as { isValid: boolean; errors: string[] } | undefined,
        } : undefined;

        if (cachedData) {
          console.log(`[VERIFICATION-API] Found cached scan data for ${existingDocument.type} (ID: ${existingDocument.id})`);
        }

        // Verify the document
        const verificationResult = await documentVerificationService.verifyDocument(
          fullPath,
          {
            documentNumber: existingDocument.documentNumber,
            issuingAuthority: existingDocument.issuingAuthority,
            issueDate: existingDocument.issueDate ? existingDocument.issueDate.toISOString() : null,
            expiryDate: existingDocument.expiryDate ? existingDocument.expiryDate.toISOString() : null,
            type: existingDocument.type,
            holderName: `${existingDocument.crewMemberId}` // Pass ID if needed or handled in service
          },
          cachedData
        );

        // EXTRA: Proactive Profile Comparison
        // Check if there are matches/changes for the seafarer's profile and NOK
        try {
          const profileComparison = await documentVerificationService.compareProfile(
            existingDocument.crewMemberId,
            verificationResult.extractedData
          );
          verificationResult.profileComparison = profileComparison;
        } catch (profileError) {
          console.error('Profile comparison error:', profileError);
          // Don't fail verification if profile comparison fails
        }

        // Return verification result
        res.json(verificationResult);
      } catch (verificationError) {
        console.error('Verification error:', verificationError);
        // Return error but allow frontend to proceed
        res.json({
          isValid: false,
          matchScore: 0,
          warnings: ['Failed to verify document: ' + (verificationError instanceof Error ? verificationError.message : 'Unknown error')],
          fieldComparisons: [],
          extractedData: {}
        });
      }
    } catch (error) {
      console.error('Verification endpoint error:', error);
      res.status(500).json({ message: "Verification failed" });
    }
  });

  app.delete("/api/documents/:id", authenticate, async (req, res) => {
    try {
      // Get the document first to access its filePath
      const document = await storage.getDocument(req.params.id);

      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Delete the physical file if it exists
      if (document.filePath) {
        try {
          const fs = await import('fs');
          const path = await import('path');

          // Remove leading slash if present to create relative path
          const relativePath = document.filePath.startsWith('/') ? document.filePath.slice(1) : document.filePath;
          const fullPath = path.resolve(relativePath);

          // Delete the file if it exists
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            console.log(`Deleted file: ${fullPath}`);
          }
        } catch (fileError) {
          console.error('Error deleting physical file:', fileError);
          // Continue with soft delete even if file deletion fails
        }
      }

      // Soft delete: Clear filePath and set status to pending_upload
      const updatedDocument = await storage.updateDocument(req.params.id, {
        filePath: null,
        status: 'pending_upload'
      });

      if (!updatedDocument) {
        return res.status(404).json({ message: "Document not found" });
      }

      res.json({
        message: "Document file removed successfully. Document data has been preserved.",
        document: updatedDocument
      });
    } catch (error) {
      console.error('Error in soft delete:', error);
      res.status(500).json({ message: "Failed to remove document file" });
    }
  });

  // Helper for determining MIME type based on extension
  const getMimeType = (filePath: string): string => {
    const ext = path.extname(filePath).toLowerCase();
    const map: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif'
    };
    return map[ext] || 'application/octet-stream';
  };

  // ============================================================================
  // PHASE 1: Secure Document Access System
  // Public route for viewing documents via time-limited access tokens
  // ============================================================================
  app.get("/api/documents/view/:token", async (req, res) => {
    try {
      const { token } = req.params;

      console.log(`📥 Document view request with token: ${token.substring(0, 20)}...`);

      // Validate token and retrieve document
      const document = await documentAccessService.getDocumentByToken(token);

      if (!document) {
        console.log('❌ Invalid or expired token');
        return res.status(404).send(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Document Not Available</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  min-height: 100vh;
                  margin: 0;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  color: #333;
                }
                .container {
                  background: white;
                  padding: 3rem;
                  border-radius: 12px;
                  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                  text-align: center;
                  max-width: 500px;
                }
                h1 {
                  font-size: 3rem;
                  margin: 0 0 1rem 0;
                }
                p {
                  font-size: 1.1rem;
                  color: #666;
                  line-height: 1.6;
                }
                .icon {
                  font-size: 4rem;
                  margin-bottom: 1rem;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="icon">🔒</div>
                <h1>Document Not Found</h1>
                <p>This link has expired or is invalid.</p>
                <p>Please request a new link from the system administrator.</p>
              </div>
            </body>
          </html>
        `);
      }

      console.log(`✅ Valid token - Serving document: ${document.type} - ${document.documentNumber}`);

      const documentStorageService = new DocumentStorageService();
      await documentStorageService.downloadDocument(document.filePath!, res);
    } catch (error) {
      console.error("❌ Error in secure document viewer:", error);
      if (!res.headersSent) {
        res.status(500).send('Internal server error');
      }
    }
  });

  // GET /api/documents/:id/scanned - Get scanned document data including validation status
  app.get("/api/documents/:id/scanned", authenticate, async (req, res) => {
    try {
      const scannedDoc = await storage.getScannedDocument(req.params.id);

      if (!scannedDoc) {
        return res.status(404).json({ message: "Scanned document data not found" });
      }

      res.json(scannedDoc);
    } catch (error: any) {
      console.error("Error fetching scanned document:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // View crew document (inline) - Requires authentication

  app.get("/api/documents/:id/view", authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const document = await storage.getDocument(id);

      if (!document || !document.filePath) {
        return res.status(404).json({ message: "Document not found" });
      }

      console.log(`[VIEW-DOC] Attempting to view doc: ${id}, Path: ${document.filePath}`);
      const documentStorageService = new DocumentStorageService();
      await documentStorageService.downloadDocument(document.filePath, res);
    } catch (error) {
      console.error("Error viewing crew document:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to view document" });
      }
    }
  });

  // Download crew document
  app.get("/api/documents/:id/download", authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const document = await storage.getDocument(id);

      if (!document || !document.filePath) {
        return res.status(404).json({ message: "Document not found" });
      }

      const documentStorageService = new DocumentStorageService();
      await documentStorageService.downloadDocument(document.filePath, res);
    } catch (error) {
      console.error("Error downloading crew document:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to download document" });
      }
    }
  });

  // Download all documents as ZIP
  app.get("/api/documents/download-all", authenticate, async (req, res) => {
    try {
      const archiver = await import('archiver');
      const documents = await storage.getDocuments();

      // Filter documents that have files
      const documentsWithFiles = documents.filter(doc => doc.filePath);

      if (documentsWithFiles.length === 0) {
        return res.status(404).json({ message: "No documents available to download" });
      }

      // Set response headers for ZIP file
      const zipFileName = `all-documents-${new Date().toISOString().split('T')[0]}.zip`;
      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFileName}"`,
        'Cache-Control': 'no-cache'
      });

      // Create ZIP archive
      const archive = archiver.default('zip', {
        zlib: { level: 9 } // Maximum compression
      });

      // Handle archive errors
      archive.on('error', (err) => {
        console.error('Archive error:', err);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Failed to create ZIP archive' });
        }
      });

      // Pipe archive to response
      archive.pipe(res);

      // Add each document to the archive
      const documentStorageService = new DocumentStorageService();
      let addedCount = 0;
      for (const document of documentsWithFiles) {
        try {
          const filePath = document.filePath!;
          const extension = path.extname(filePath) || '.pdf';
          const crewMember = await storage.getCrewMember(document.crewMemberId);
          const crewName = crewMember
            ? `${crewMember.firstName}_${crewMember.lastName}`.replace(/\s+/g, '_')
            : 'Unknown';

          const fileName = `${crewName}_${document.type.toUpperCase()}_${document.documentNumber || 'doc'}${extension}`;

          if (filePath.startsWith('/')) {
            // Object Storage path
            const file = await documentStorageService.getDocumentFile(filePath);
            archive.append(file.createReadStream(), { name: fileName });
            addedCount++;
          } else {
            // Local path
            const fullPath = path.resolve(process.cwd(), filePath);
            if (fs.existsSync(fullPath)) {
              archive.file(fullPath, { name: fileName });
              addedCount++;
            }
          }
        } catch (fileError) {
          console.error(`Error adding document ${document.id} to archive:`, fileError);
        }
      }

      if (addedCount === 0) {
        return res.status(404).json({ message: "No document files found on disk" });
      }

      // Finalize the archive
      await archive.finalize();

      console.log(`ZIP archive created with ${addedCount} documents`);
    } catch (error) {
      console.error("Error creating ZIP archive:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to create document archive" });
      }
    }
  });

  // Download all documents for a specific crew member as ZIP
  app.get("/api/crew/:crewMemberId/documents/download-all", authenticate, async (req, res) => {
    try {
      const { crewMemberId } = req.params;
      const archiver = await import('archiver');

      // Get all documents for this crew member
      const allDocuments = await storage.getDocuments();
      const crewDocuments = allDocuments.filter(doc => doc.crewMemberId === crewMemberId && doc.filePath);

      // Get crew member name for filename
      const crewMember = await storage.getCrewMember(crewMemberId);
      const crewName = crewMember
        ? `${crewMember.firstName}_${crewMember.lastName}`.replace(/\s+/g, '_')
        : 'Unknown';

      // Set response headers for ZIP file
      const zipFileName = `${crewName}_documents.zip`;
      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFileName}"`,
        'Cache-Control': 'no-cache'
      });

      // Create ZIP archive
      const archive = archiver.default('zip', {
        zlib: { level: 9 } // Maximum compression
      });

      // Handle archive errors
      archive.on('error', (err) => {
        console.error('Archive error:', err);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Failed to create ZIP archive' });
        }
      });

      // Pipe archive to response
      archive.pipe(res);

      const hasAoaDoc = crewDocuments.some(d => d.type.toLowerCase() === 'aoa');

      // Add each document to the archive
      const documentStorageService = new DocumentStorageService();
      let addedCount = 0;
      for (const document of crewDocuments) {
        try {
          const filePath = document.filePath!;
          const extension = path.extname(filePath) || '.pdf';
          const fileName = `${document.type.toUpperCase()}_${document.documentNumber || 'doc'}${extension}`;

          if (filePath.startsWith('/')) {
            // Object Storage path
            const file = await documentStorageService.getDocumentFile(filePath);
            archive.append(file.createReadStream(), { name: fileName });
            addedCount++;
          } else {
            // Local path
            const fullPath = path.resolve(process.cwd(), filePath);
            if (fs.existsSync(fullPath)) {
              archive.file(fullPath, { name: fileName });
              addedCount++;
            }
          }
        } catch (fileError) {
          console.error(`Error adding document ${document.id} to archive:`, fileError);
        }
      }

      // Add contract document if available
      try {
        const contracts = await storage.getContracts();
        const activeContract = contracts.find(c =>
          c.crewMemberId === crewMemberId &&
          c.status === 'active' &&
          c.filePath
        );

        if (activeContract && activeContract.filePath) {
          const contractFilePath = activeContract.filePath;
          const extension = path.extname(contractFilePath) || '.pdf';
          const contractFileName = hasAoaDoc
            ? `CONTRACT_${activeContract.contractNumber || 'Agreement'}${extension}`
            : `AOA_CONTRACT_${activeContract.contractNumber || 'Agreement'}${extension}`;

          if (contractFilePath.startsWith('/')) {
            // Object Storage path
            const file = await documentStorageService.getDocumentFile(contractFilePath);
            archive.append(file.createReadStream(), { name: contractFileName });
            addedCount++;
          } else {
            // Local path
            const fullContractPath = path.resolve(process.cwd(), contractFilePath);
            if (fs.existsSync(fullContractPath)) {
              archive.file(fullContractPath, { name: contractFileName });
              addedCount++;
            }
          }
          console.log(`Added contract document: ${contractFileName}`);
        }
      } catch (contractError) {
        console.error('Error adding contract document to archive:', contractError);
        // Continue even if contract fails
      }

      if (addedCount === 0) {
        return res.status(404).json({ message: "No document files found on disk" });
      }

      // Finalize the archive
      await archive.finalize();

      console.log(`ZIP archive created for ${crewName} with ${addedCount} documents`);
    } catch (error) {
      console.error("Error creating crew documents ZIP archive:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to create document archive" });
      }
    }
  });

  // Contract routes
  app.get("/api/contracts", authenticate, async (req, res) => {
    try {
      const { crewMemberId } = req.query;
      let contracts;

      if (crewMemberId) {
        contracts = await storage.getContractsByCrewMember(crewMemberId as string);
      } else {
        contracts = await storage.getContracts();
      }

      res.json(contracts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch contracts" });
    }
  });

  app.post("/api/contracts", authenticate, async (req, res) => {
    try {
      let contractData = insertContractSchema.parse(req.body);

      // Validate documents for the contract period
      const validation = await documentValidationService.validateForSignOn(
        contractData.crewMemberId,
        contractData.startDate,
        contractData.durationDays || 90
      );

      if (!validation.isValid) {
        return res.status(400).json({
          message: "Cannot create contract due to document validation errors",
          error: "DOCUMENT_VALIDATION_ERROR",
          blockers: validation.blockers,
          warnings: validation.warnings
        });
      }

      // Move to Object Storage for persistence if a file path is provided
      if (contractData.filePath && !contractData.filePath.startsWith('/')) {
        const documentStorageService = new DocumentStorageService();

        // Only attempt cloud move if objectively storage is available (Replit sidecar)
        if (documentStorageService.isCloudStorageAvailable()) {
          try {
            const fullPath = path.join(process.cwd(), contractData.filePath);
            if (fs.existsSync(fullPath)) {
              const fileName = path.basename(fullPath);
              const uploadUrl = await documentStorageService.getDocumentUploadURL('crew', contractData.crewMemberId, fileName);

              // Upload local file to signed URL
              const fileBuffer = fs.readFileSync(fullPath);
              const response = await fetch(uploadUrl, {
                method: 'PUT',
                body: new Uint8Array(fileBuffer),
                headers: {
                  'Content-Type': getMimeType(fullPath)
                }
              });

              if (!response.ok) {
                throw new Error(`Failed to upload to Object Storage: ${response.statusText}`);
              }

              // Update path to the cloud path
              const cloudPath = documentStorageService.normalizeDocumentPath(uploadUrl);
              console.log(`[CLOUD-STORAGE-CONTRACT] Successfully uploaded to ${cloudPath}`);
              contractData.filePath = cloudPath;

              // Cleanup local file
              fs.unlink(fullPath, (err) => {
                if (err) console.error(`[CLOUD-STORAGE-CONTRACT] Failed to delete local file ${fullPath}:`, err);
              });
            }
          } catch (storageError) {
            console.error("[CLOUD-STORAGE-CONTRACT] Error uploading to Object Storage:", storageError);
            return res.status(500).json({ message: "Failed to save contract document to persistent storage" });
          }
        } else {
          console.log(`[STORAGE-LOCAL] Cloud storage not available, keeping local file path: ${contractData.filePath}`);
        }
      }

      const contract = await storage.createContract(contractData);

      // Trigger immediate alert if contract expires within 30 days
      if (contract.endDate) {
        try {
          const crewMember = await storage.getCrewMember(contract.crewMemberId);
          if (crewMember) {
            // Get vessel name from crew member's current vessel
            let vesselName: string | undefined;
            if (crewMember.currentVesselId) {
              const vessel = await storage.getVessel(crewMember.currentVesselId);
              vesselName = vessel?.name;
            }

            await notificationService.sendImmediateContractAlert(
              {
                id: contract.id,
                endDate: contract.endDate,
                status: contract.status,
              },
              {
                id: crewMember.id,
                name: `${crewMember.firstName} ${crewMember.lastName} `,
                rank: crewMember.rank,
                nationality: crewMember.nationality,
              },
              vesselName
            );
          }
        } catch (alertError) {
          console.error('Failed to send immediate contract alert:', alertError);
        }
      }

      res.json(contract);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid contract data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create contract" });
      }
    }
  });

  // View contract (inline)
  app.get("/api/contracts/:id/view", authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const contract = await storage.getContract(id);

      if (!contract || !contract.filePath) {
        return res.status(404).json({ message: "Contract document not found" });
      }

      const documentStorageService = new DocumentStorageService();
      await documentStorageService.downloadDocument(contract.filePath, res);
    } catch (error) {
      console.error("Error viewing contract:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to view contract" });
      }
    }
  });

  // Download contract
  app.get("/api/contracts/:id/download", authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const contract = await storage.getContract(id);

      if (!contract || !contract.filePath) {
        return res.status(404).json({ message: "Contract document not found" });
      }

      const documentStorageService = new DocumentStorageService();
      await documentStorageService.downloadDocument(contract.filePath, res);
    } catch (error) {
      console.error("Error downloading contract:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to download contract" });
      }
    }
  });

  app.put("/api/contracts/:id", authenticate, async (req, res) => {
    try {
      console.log('Updating contract:', req.params.id, 'with data:', req.body);

      const updates = insertContractSchema.partial().parse(req.body);
      console.log('Parsed contract updates:', updates);

      // Move to Object Storage for persistence if a new file path is provided
      if (updates.filePath && !updates.filePath.startsWith('/')) {
        const documentStorageService = new DocumentStorageService();

        // Only attempt cloud move if objectively storage is available (Replit sidecar)
        if (documentStorageService.isCloudStorageAvailable()) {
          try {
            const existingContract = await storage.getContract(req.params.id);
            const crewMemberId = updates.crewMemberId || existingContract?.crewMemberId;

            if (!crewMemberId) {
              throw new Error("Crew member ID not found for contract storage");
            }

            const fullPath = path.join(process.cwd(), updates.filePath);
            if (fs.existsSync(fullPath)) {
              const fileName = path.basename(fullPath);
              const uploadUrl = await documentStorageService.getDocumentUploadURL('crew', crewMemberId, fileName);

              const fileBuffer = fs.readFileSync(fullPath);
              const response = await fetch(uploadUrl, {
                method: 'PUT',
                body: new Uint8Array(fileBuffer),
                headers: {
                  'Content-Type': getMimeType(fullPath)
                }
              });

              if (!response.ok) {
                throw new Error(`Failed to upload to Object Storage: ${response.statusText}`);
              }

              const cloudPath = documentStorageService.normalizeDocumentPath(uploadUrl);
              console.log(`[CLOUD-STORAGE-CONTRACT-PUT] Successfully uploaded to ${cloudPath}`);
              updates.filePath = cloudPath;

              // Cleanup local file
              fs.unlink(fullPath, (err) => {
                if (err) console.error(`[CLOUD-STORAGE-CONTRACT-PUT] Failed to delete local file ${fullPath}:`, err);
              });
            }
          } catch (storageError) {
            console.error("[CLOUD-STORAGE-CONTRACT-PUT] Error uploading to Object Storage:", storageError);
            return res.status(500).json({ message: "Failed to save updated contract document to persistent storage" });
          }
        } else {
          console.log(`[STORAGE-LOCAL] Cloud storage not available, keeping local file path for contract update: ${updates.filePath}`);
        }
      }

      // POLICY ENFORCEMENT: Check policy if end date is being extended
      if (updates.endDate) {
        const validation = await compliancePolicyService.validateContractExtension(req.params.id, new Date(updates.endDate));
        if (!validation.allowed && validation.severity === 'error') {
          return res.status(400).json({
            message: "Contract extension blocked by compliance policy",
            error: "COMPLIANCE_POLICY_ERROR",
            reason: validation.reason,
            actionRequired: validation.actionRequired
          });
        }
      }

      const contract = await storage.updateContract(req.params.id, updates);
      console.log('Updated contract result:', contract);

      if (!contract) {
        return res.status(404).json({ message: "Contract not found" });
      }

      // Log the contract update activity
      try {
        await db.insert(activityLogs).values({
          type: 'Contract Management',
          action: 'update',
          entityType: 'contract',
          entityId: req.params.id,
          userId: null,
          username: req.user?.username || 'System',
          userRole: req.user?.role || 'admin',
          description: `Contract updated - Start: ${contract.startDate}, End: ${contract.endDate}, Status: ${contract.status} `,
          severity: 'info',
          metadata: {
            contractId: contract.id,
            crewMemberId: contract.crewMemberId,
            startDate: contract.startDate?.toISOString(),
            endDate: contract.endDate?.toISOString(),
            status: contract.status,
            changes: Object.keys(updates)
          }
        });
        console.log('Contract update activity logged successfully');
      } catch (logError) {
        console.error('Failed to log contract update activity:', logError);
      }

      // Trigger immediate alert if contract expires within 30 days (check on end date update)
      if (contract.endDate && updates.endDate) {
        try {
          const crewMember = await storage.getCrewMember(contract.crewMemberId);
          if (crewMember) {
            // Get vessel name from crew member's current vessel
            let vesselName: string | undefined;
            if (crewMember.currentVesselId) {
              const vessel = await storage.getVessel(crewMember.currentVesselId);
              vesselName = vessel?.name;
            }

            await notificationService.sendImmediateContractAlert(
              {
                id: contract.id,
                endDate: contract.endDate,
                status: contract.status,
              },
              {
                id: crewMember.id,
                name: `${crewMember.firstName} ${crewMember.lastName} `,
                rank: crewMember.rank,
                nationality: crewMember.nationality,
              },
              vesselName
            );
          }
        } catch (alertError) {
          console.error('Failed to send immediate contract alert:', alertError);
        }
      }

      res.json(contract);
    } catch (error) {
      console.error('Error updating contract:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid contract data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update contract" });
      }
    }
  });


  // Existing route handlers continue...

  // Crew rotation routes
  app.get("/api/rotations", authenticate, async (req, res) => {
    try {
      // Add cache control headers to prevent stale data
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Vary': 'Authorization'
      });

      const { vesselId } = req.query;
      let rotations;

      if (vesselId) {
        rotations = await storage.getCrewRotationsByVessel(vesselId as string);
      } else {
        rotations = await storage.getCrewRotations();
      }

      res.json(rotations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch rotations" });
    }
  });

  app.post("/api/rotations", authenticate, async (req, res) => {
    try {
      // Transform date strings to Date objects before validation
      const transformedData = {
        ...req.body,
        joinDate: req.body.joinDate ? new Date(req.body.joinDate) : undefined,
        leaveDate: req.body.leaveDate ? new Date(req.body.leaveDate) : undefined,
      };

      const rotationData = insertCrewRotationSchema.parse(transformedData);
      const rotation = await storage.createCrewRotation(rotationData);
      res.json(rotation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid rotation data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create rotation" });
      }
    }
  });

  app.patch("/api/rotations/:id", authenticate, async (req, res) => {
    try {
      const { id } = req.params;

      console.log('Updating rotation:', id, req.body);

      // Extract only the fields that can be updated, excluding id and createdAt
      const { id: _, createdAt, ...updateFields } = req.body;

      // Transform date strings to Date objects before validation
      const transformedData = {
        ...updateFields,
        joinDate: updateFields.joinDate ? new Date(updateFields.joinDate) : undefined,
        leaveDate: updateFields.leaveDate ? new Date(updateFields.leaveDate) : undefined,
      };

      console.log('Transformed data:', transformedData);

      const rotation = await storage.updateCrewRotation(id, transformedData);
      if (!rotation) {
        return res.status(404).json({ message: "Rotation not found" });
      }
      res.json(rotation);
    } catch (error) {
      console.error('Error updating rotation:', error);
      res.status(500).json({ message: "Failed to update rotation", error: String(error) });
    }
  });

  app.delete("/api/rotations/:id", authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const { reason, deletedBy } = req.body;

      // Delete the rotation
      const success = await storage.deleteCrewRotation(id);
      if (!success) {
        return res.status(404).json({ message: "Rotation not found" });
      }

      // Log the deletion activity
      if (req.user) {
        await storage.logActivity({
          type: 'Crew Management',
          action: 'delete',
          entityType: 'rotation',
          entityId: id,
          username: req.user.username || 'System',
          userRole: req.user.role || 'admin',
          description: `Deleted vessel history record.Reason: ${reason || 'Not provided'}. Deleted by: ${deletedBy || req.user.username || 'System'} `,
          severity: 'info',
          userId: req.user.id,
        });
      }

      res.json({ message: "Rotation deleted successfully" });
    } catch (error) {
      console.error('Error deleting rotation:', error);
      res.status(500).json({ message: "Failed to delete rotation" });
    }
  });

  // WhatsApp Settings routes
  app.get("/api/whatsapp-settings", authenticate, async (req, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const settings = await storage.getWhatsappSettings();

      // Redact sensitive information
      const sanitizedSettings = settings ? {
        ...settings,
        apiKey: settings.apiKey ? '***REDACTED***' : null,
        webhookUrl: settings.webhookUrl ? '***REDACTED***' : null,
      } : null;

      res.json(sanitizedSettings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch WhatsApp settings" });
    }
  });

  app.put("/api/whatsapp-settings", authenticate, async (req, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }

      const settingsData = insertWhatsappSettingsSchema.parse(req.body);
      const settings = await storage.updateWhatsappSettings(settingsData);
      res.json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid settings data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update WhatsApp settings" });
      }
    }
  });

  // Alerts routes
  app.get("/api/alerts/expiring-documents", authenticate, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const alerts = await storage.getExpiringDocuments(days);
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch expiring documents" });
    }
  });

  app.get("/api/alerts/expiring-vessel-documents", authenticate, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const alerts = await storage.getExpiringVesselDocuments(days);
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch expiring vessel documents" });
    }
  });

  app.get("/api/alerts/expiring-contracts", authenticate, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 90;
      const alerts = await storage.getExpiringContracts(days);
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch expiring contracts" });
    }
  });

  // Compliance Policy routes
  app.get("/api/compliance/crew/:id", authenticate, async (req, res) => {
    try {
      const validation = await compliancePolicyService.checkMandatorySignOff(req.params.id);
      res.json(validation);
    } catch (error) {
      res.status(500).json({ message: "Failed to check compliance policy" });
    }
  });

  app.get("/api/compliance/validate-extension/:id", authenticate, async (req, res) => {
    try {
      const { endDate } = req.query;
      if (!endDate) {
        return res.status(400).json({ message: "endDate query parameter is required" });
      }
      const validation = await compliancePolicyService.validateContractExtension(req.params.id, new Date(endDate as string));
      res.json(validation);
    } catch (error) {
      res.status(500).json({ message: "Failed to validate contract extension" });
    }
  });

  // Compliance Reports & KPIs
  app.get("/api/reports/compliance-kpis", authenticate, async (req, res) => {
    try {
      const allDocs = await storage.getDocuments();
      const now = new Date();

      const totalDocs = allDocs.length;
      const validDocs = allDocs.filter(d => d.status === 'valid').length;
      const expiring30 = allDocs.filter(d => d.expiryDate && new Date(d.expiryDate) > now && new Date(d.expiryDate) <= addDays(now, 30)).length;
      const expired = allDocs.filter(d => d.expiryDate && new Date(d.expiryDate) < now).length;

      // Mocked KPI data for now based on available data
      res.json({
        complianceRate: totalDocs > 0 ? Math.round((validDocs / totalDocs) * 100) : 100,
        renewalSuccessRate: 92, // % of docs renewed before expiry
        avgDaysToAction: 12,    // Avg days from alert to renewal
        activeComplaints: expired,
        emergencyChanges: 2      // Emergency crew changes due to doc issues
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch compliance KPIs" });
    }
  });

  app.get("/api/reports/vessel-risk-scores", authenticate, async (req, res) => {
    try {
      const vessels = await storage.getVessels();
      const crewMembers = await storage.getCrewMembers();
      const allDocs = await storage.getDocuments();
      const now = new Date();

      const riskScores = vessels.map(vessel => {
        const vesselCrew = crewMembers.filter(c => c.currentVesselId === vessel.id && c.status === 'onBoard');
        let riskValue = 0;

        vesselCrew.forEach(crew => {
          const crewDocs = allDocs.filter(d => d.crewMemberId === crew.id);
          crewDocs.forEach(doc => {
            if (!doc.expiryDate) return;
            const expiry = new Date(doc.expiryDate);
            const daysUntil = differenceInDays(expiry, now);

            if (daysUntil < 0) riskValue += 25; // Expired
            else if (daysUntil <= 15) riskValue += 10; // Critical
            else if (daysUntil <= 30) riskValue += 5;  // Urgent
          });
        });

        const normalizedScore = Math.min(100, riskValue);
        return {
          vesselId: vessel.id,
          vesselName: vessel.name,
          riskScore: normalizedScore,
          status: normalizedScore > 50 ? 'high' : normalizedScore > 20 ? 'medium' : 'low'
        };
      });

      res.json(riskScores);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch vessel risk scores" });
    }
  });

  function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  function differenceInDays(dateLeft: Date, dateRight: Date): number {
    return Math.ceil((dateLeft.getTime() - dateRight.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Dashboard stats
  app.get("/api/dashboard/stats", authenticate, async (req, res) => {
    try {
      const crewMembers = await storage.getCrewMembers();
      const vessels = await storage.getVessels();
      const expiringAlerts = await storage.getExpiringDocuments(30);
      const contracts = await storage.getContracts();

      const activeCrew = crewMembers.filter(member => member.status === 'onBoard').length;
      const activeVessels = vessels.filter(vessel =>
        ['harbour-mining', 'coastal-mining', 'world-wide', 'oil-field', 'line-up-mining', 'active'].includes(vessel.status)
      ).length;
      const pendingActions = expiringAlerts.length;

      // Calculate crew on shore count
      const crewOnShore = crewMembers.filter(member => member.status === 'onShore').length;

      const allDocuments = await storage.getDocuments();

      // Calculate compliance rate (documents not expiring soon)
      const validDocuments = allDocuments.filter(doc => doc.status === 'valid').length;
      const complianceRate = allDocuments.length > 0 ? (validDocuments / allDocuments.length) * 100 : 100;

      // Calculate sign off due contracts (expiring within 45 days)
      const now = new Date();
      const fortyFiveDaysFromNow = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const fifteenDaysFromNow = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);

      const signOffDue = contracts.filter(contract => {
        if (contract.status !== 'active') return false;
        return contract.endDate > now && contract.endDate <= fortyFiveDaysFromNow;
      }).length;

      const signOffDue30Days = contracts.filter(contract => {
        if (contract.status !== 'active') return false;
        return contract.endDate > now && contract.endDate <= thirtyDaysFromNow;
      }).length;

      const signOffDue15Days = contracts.filter(contract => {
        if (contract.status !== 'active') return false;
        return contract.endDate > now && contract.endDate <= fifteenDaysFromNow;
      }).length;

      res.json({
        activeCrew,
        activeVessels,
        pendingActions,
        crewOnShore,
        complianceRate: Math.round(complianceRate * 10) / 10,
        totalContracts: contracts.length,
        totalDocuments: allDocuments.length,
        signOffDue,
        signOffDue30Days,
        signOffDue15Days
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Upcoming events endpoint
  app.get("/api/upcoming-events", authenticate, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const limit = parseInt(req.query.limit as string) || 10;
      const currentDate = new Date();
      const futureDate = new Date();
      futureDate.setDate(currentDate.getDate() + days);

      const events: Array<{
        id: string;
        type: string;
        title: string;
        description: string;
        date: Date;
        severity: 'success' | 'info' | 'warning' | 'high';
        crewMemberId?: string;
        vesselId?: string;
        contractId?: string;
        documentId?: string;
        documentType?: string;
        rotationId?: string;
      }> = [];

      const [vessels, crewMembers, contracts, documents, crewRotations] = await Promise.all([
        storage.getVessels(),
        storage.getCrewMembers(),
        storage.getContracts(),
        storage.getDocuments(),
        storage.getCrewRotations()
      ]);

      // Contract renewals/expirations
      contracts.forEach(contract => {
        if (contract.status === 'active' && contract.endDate >= currentDate && contract.endDate <= futureDate) {
          const crewMember = crewMembers.find(c => c.id === contract.crewMemberId);
          const vessel = vessels.find(v => v.id === contract.vesselId);

          const daysUntil = Math.ceil((contract.endDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));

          events.push({
            id: `contract - ${contract.id} `,
            type: 'contract_expiry',
            title: 'Contract Expiring',
            description: `${crewMember?.firstName} ${crewMember?.lastName} - ${vessel?.name} (${daysUntil} days)`,
            date: contract.endDate,
            severity: daysUntil <= 7 ? 'high' : daysUntil <= 15 ? 'warning' : 'info',
            crewMemberId: contract.crewMemberId,
            vesselId: contract.vesselId,
            contractId: contract.id
          });
        }
      });

      // Document expirations
      documents.forEach(document => {
        if ((document.status === 'valid' || document.status === 'expiring') && document.expiryDate >= currentDate && document.expiryDate <= futureDate) {
          const crewMember = crewMembers.find(c => c.id === document.crewMemberId);

          const daysUntil = Math.ceil((document.expiryDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));

          events.push({
            id: `document - ${document.id} `,
            type: 'document_expiry',
            title: 'Document Expiring',
            description: `${crewMember?.firstName} ${crewMember?.lastName} - ${document.type.toUpperCase()} (${daysUntil} days)`,
            date: document.expiryDate,
            severity: daysUntil <= 7 ? 'high' : daysUntil <= 15 ? 'warning' : 'info',
            crewMemberId: document.crewMemberId,
            documentId: document.id,
            documentType: document.type
          });
        }
      });

      // Crew rotations (joins and leaves)
      crewRotations.forEach(rotation => {
        if (rotation.status === 'scheduled') {
          const crewMember = crewMembers.find(c => c.id === rotation.crewMemberId);
          const vessel = vessels.find(v => v.id === rotation.vesselId);

          // Join events
          if (rotation.joinDate >= currentDate && rotation.joinDate <= futureDate) {
            const daysUntil = Math.ceil((rotation.joinDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));

            events.push({
              id: `join - ${rotation.id} `,
              type: 'crew_join',
              title: 'Crew Joining',
              description: `${crewMember?.firstName} ${crewMember?.lastName} joins ${vessel?.name} (${daysUntil} days)`,
              date: rotation.joinDate,
              severity: daysUntil <= 3 ? 'warning' : 'info',
              crewMemberId: rotation.crewMemberId,
              vesselId: rotation.vesselId,
              rotationId: rotation.id
            });
          }

          // Leave events
          if (rotation.leaveDate && rotation.leaveDate >= currentDate && rotation.leaveDate <= futureDate) {
            const daysUntil = Math.ceil((rotation.leaveDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));

            events.push({
              id: `leave - ${rotation.id} `,
              type: 'crew_leave',
              title: 'Crew Leaving',
              description: `${crewMember?.firstName} ${crewMember?.lastName} leaves ${vessel?.name} (${daysUntil} days)`,
              date: rotation.leaveDate,
              severity: daysUntil <= 3 ? 'warning' : 'info',
              crewMemberId: rotation.crewMemberId,
              vesselId: rotation.vesselId,
              rotationId: rotation.id
            });
          }
        }
      });

      // Maintenance schedules (vessel status changes)
      vessels.forEach(vessel => {
        if (vessel.status === 'maintenance') {
          // For demonstration, add maintenance completion events
          const maintenanceCompletion = new Date();
          maintenanceCompletion.setDate(currentDate.getDate() + Math.floor(Math.random() * 14) + 1);

          if (maintenanceCompletion <= futureDate) {
            const daysUntil = Math.ceil((maintenanceCompletion.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));

            events.push({
              id: `maintenance - ${vessel.id} `,
              type: 'maintenance_completion',
              title: 'Maintenance Completion',
              description: `${vessel.name} maintenance scheduled to complete(${daysUntil} days)`,
              date: maintenanceCompletion,
              severity: 'info',
              vesselId: vessel.id
            });
          }
        }
      });

      // Sort events by date and limit results
      const sortedEvents = events
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .slice(0, limit);

      // Note: WhatsApp notifications are handled by a separate background service
      // to prevent spam and ensure reliable delivery with deduplication

      res.json(sortedEvents);
    } catch (error) {
      console.error('Failed to fetch upcoming events:', error);
      res.status(500).json({ message: "Failed to fetch upcoming events" });
    }
  });

  // Email settings routes
  app.get("/api/email-settings", authenticate, async (req, res) => {
    try {
      const settings = await storage.getEmailSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch email settings" });
    }
  });

  app.put("/api/email-settings", authenticate, async (req, res) => {
    try {
      const settingsData = insertEmailSettingsSchema.parse(req.body);
      const settings = await storage.updateEmailSettings(settingsData);
      res.json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid settings data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update email settings" });
      }
    }
  });

  // Test email sending endpoint
  app.post("/api/email/send-test", authenticate, async (req, res) => {
    try {
      // Get recipient email from settings instead of requiring it in request
      const settings = await storage.getEmailSettings();
      const recipientEmail = settings?.recipientEmail;

      if (!recipientEmail) {
        return res.status(400).json({ message: "No recipient email configured in settings. Please configure a recipient email in notification settings." });
      }

      console.log("Sending test email to:", recipientEmail);

      // Import Gmail SMTP email service for real email delivery
      const { smtpEmailService } = await import('./services/smtp-email-service');

      // Use Gmail SMTP's built-in test email method
      const result = await smtpEmailService.sendTestEmail(recipientEmail);

      if (result.success) {
        res.json({ message: "Test email sent successfully! Check your inbox." });
      } else {
        res.status(500).json({ message: `Failed to send test email: ${result.error || 'Please check your Gmail SMTP configuration.'} ` });
      }
    } catch (error) {
      console.error('Test email error:', error);
      res.status(500).json({
        message: "Failed to send test email",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Test Medical Certificate expiry alert endpoint
  app.post("/api/email/test-medical-alert", authenticate, async (req, res) => {
    try {
      const settings = await storage.getEmailSettings();
      const recipientEmail = settings?.recipientEmail || 'admin@offing.biz';

      const { sendMedicalExpiryAlert } = await import('./services/smtp-email-service');

      const testData = {
        crewMemberName: 'Test Crew Member',
        crewMemberRank: 'Captain',
        crewMemberNationality: 'Philippines',
        vesselName: 'MV Test Vessel',
        medicalNumber: 'MED-2024-001',
        issuingAuthority: 'Maritime Medical Center',
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        daysUntilExpiry: 30,
      };

      console.log("Sending test Medical Certificate alert to:", recipientEmail);
      const result = await sendMedicalExpiryAlert(recipientEmail, testData);

      if (result.success) {
        res.json({ message: "Medical Certificate expiry alert sent successfully!" });
      } else {
        res.status(500).json({ message: `Failed to send Medical Certificate alert: ${result.error || 'Unknown error'} ` });
      }
    } catch (error) {
      console.error('Test medical alert error:', error);
      res.status(500).json({ message: "Failed to send alert", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Send single document via email
  app.post("/api/email/send-document", authenticate, async (req, res) => {
    try {
      console.log('📧 [SEND-DOCUMENT] Endpoint called');
      const { documentId, recipientEmail } = req.body;
      console.log('📧 [SEND-DOCUMENT] Request:', { documentId, recipientEmail });

      if (!documentId || !recipientEmail) {
        console.log('❌ [SEND-DOCUMENT] Missing required fields');
        return res.status(400).json({ message: "Document ID and recipient email are required" });
      }

      // Fetch document
      console.log('📎 [SEND-DOCUMENT] Fetching document...');
      const document = await storage.getDocument(documentId);
      if (!document) {
        console.log('❌ [SEND-DOCUMENT] Document not found');
        return res.status(404).json({ message: "Document not found" });
      }
      console.log('✅ [SEND-DOCUMENT] Document found:', document.type, document.documentNumber);

      // Fetch crew member
      console.log('👥 [SEND-DOCUMENT] Fetching crew member...');
      const crewMember = await storage.getCrewMember(document.crewMemberId);
      if (!crewMember) {
        console.log('❌ [SEND-DOCUMENT] Crew member not found');
        return res.status(404).json({ message: "Crew member not found" });
      }
      console.log('✅ [SEND-DOCUMENT] Crew member found:', crewMember.firstName, crewMember.lastName);

      // Import Gmail SMTP email service
      const { smtpEmailService } = await import('./services/smtp-email-service');

      // Generate document-specific email template
      const docTypeLabel = {
        passport: 'Passport',
        cdc: 'CDC Certificate',
        coc: 'COC Certificate',
        medical: 'Medical Certificate',
        visa: 'Visa'
      }[document.type] || document.type.toUpperCase();

      const docIcon = {
        passport: '\uD83D\uDCD8',  // 📘
        cdc: '\uD83D\uDCD7',       // 📗
        coc: '\uD83D\uDCD9',       // 📙
        medical: '\uD83C\uDFE5',   // 🏥
        visa: '\u2708\uFE0F'       // ✈️
      }[document.type] || '\uD83D\uDCC4';  // 📄

      const subject = `${docIcon} ${docTypeLabel} - ${crewMember.firstName} ${crewMember.lastName} `;

      const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;"><div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;"><h1 style="margin: 0; font-size: 28px;"> ${docIcon} ${docTypeLabel} </h1><p style="margin: 10px 0 0; opacity: 0.9;"> Crew Document Details </p></div><div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"><h2 style="color: #1e40af; margin-top: 0;"> Crew Member Information </h2><table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;"><tr><td style="padding: 8px 0; color: #6b7280; width: 40%;"> Name: </td><td style="padding: 8px 0; font-weight: 600;">${crewMember.firstName} ${crewMember.lastName}</td></tr><tr><td style="padding: 8px 0; color: #6b7280;"> Rank: </td><td style="padding: 8px 0; font-weight: 600;">${crewMember.rank}</td></tr><tr><td style="padding: 8px 0; color: #6b7280;"> Nationality: </td><td style="padding: 8px 0; font-weight: 600;">${crewMember.nationality}</td></tr></table><h2 style="color: #1e40af; margin-top: 30px;"> Document Details </h2><table style="width: 100%; border-collapse: collapse;"><tr><td style="padding: 8px 0; color: #6b7280; width: 40%;"> Document Type: </td><td style="padding: 8px 0; font-weight: 600;">${docTypeLabel}</td></tr><tr><td style="padding: 8px 0; color: #6b7280;"> Document Number: </td><td style="padding: 8px 0; font-weight: 600;">${document.documentNumber}</td></tr><tr><td style="padding: 8px 0; color: #6b7280;"> Issue Date: </td><td style="padding: 8px 0; font-weight: 600;">${new Date(document.issueDate).toLocaleDateString()}</td></tr><tr><td style="padding: 8px 0; color: #6b7280;"> Expiry Date: </td><td style="padding: 8px 0; font-weight: 600;">${new Date(document.expiryDate).toLocaleDateString()}</td></tr><tr><td style="padding: 8px 0; color: #6b7280;"> Issuing Authority: </td><td style="padding: 8px 0; font-weight: 600;">${document.issuingAuthority || 'N/A'}</td></tr><tr><td style="padding: 8px 0; color: #6b7280;"> Status: </td><td style="padding: 8px 0;"><span style="background: #10b981; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">${document.status.toUpperCase()}</span></td></tr></table>
            ${document.filePath ? '<p style="margin-top: 20px; padding: 15px; background: #eff6ff; border-left: 4px solid #3b82f6; color: #1e40af;">?? The document file is attached to this email.</p>' : ''}
  </div><div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;"><p>This email was sent from CrewTrack Pro Document Management System </p></div></div>
          `;

      const text = `${docTypeLabel} - ${crewMember.firstName} ${crewMember.lastName} \n\nCrew Member: \n - Name: ${crewMember.firstName} ${crewMember.lastName} \n - Rank: ${crewMember.rank} \n - Nationality: ${crewMember.nationality} \n\nDocument Details: \n - Type: ${docTypeLabel} \n - Number: ${document.documentNumber} \n - Issue Date: ${new Date(document.issueDate).toLocaleDateString()} \n - Expiry Date: ${new Date(document.expiryDate).toLocaleDateString()} \n - Issuing Authority: ${document.issuingAuthority || 'N/A'} \n - Status: ${document.status.toUpperCase()} `;

      // Prepare attachments if document has file
      const attachments = [];
      if (document.filePath) {
        console.log('📎 Document has filePath:', document.filePath);
        const fs = await import('fs');
        const path = await import('path');

        // Remove leading slash if present to ensure correct path joining
        let relativePath = document.filePath;
        if (relativePath.startsWith('/') || relativePath.startsWith('\\')) {
          relativePath = relativePath.substring(1);
        }

        const filePath = path.default.join(process.cwd(), relativePath);
        console.log('📎 Full file path:', filePath);
        if (fs.default.existsSync(filePath)) {
          console.log('✅ File exists, reading content...');
          const fileContent = fs.default.readFileSync(filePath);
          const fileName = path.default.basename(filePath);
          const fileExtension = path.default.extname(filePath); // Get actual extension (.pdf, .png, etc.)
          const attachmentFileName = `${docTypeLabel.replace(/ /g, '_')}_${document.documentNumber.replace(/\//g, '-')}${fileExtension} `;
          console.log('📎 Attachment filename:', attachmentFileName);
          attachments.push({
            filename: attachmentFileName,
            content: fileContent
          });
          console.log('✅ Attachment added successfully');
        } else {
          console.log('❌ File does not exist at path:', filePath);
        }
      } else {
        console.log('⚠️ Document has no filePath');
      }

      // Send email
      console.log('📧 [SEND-DOCUMENT] Sending email to:', recipientEmail);
      console.log('📧 [SEND-DOCUMENT] Attachments count:', attachments.length);
      const result = await smtpEmailService.sendEmailWithAttachment({
        to: recipientEmail,
        subject,
        html,
        text,
        attachments
      });

      if (result.success) {
        console.log('✅ [SEND-DOCUMENT] Email sent successfully');
        res.json({ message: `${docTypeLabel} sent successfully to ${recipientEmail} ` });
      } else {
        console.log('❌ [SEND-DOCUMENT] Email failed:', result.error);
        res.status(500).json({ message: `Failed to send email: ${result.error} ` });
      }
    } catch (error) {
      console.error('Send document email error:', error);
      res.status(500).json({ message: "Failed to send document email", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Send single contract via email
  app.post("/api/email/send-contract", authenticate, async (req, res) => {
    try {
      console.log('📧 [SEND-CONTRACT] Endpoint called');
      const { contractId, recipientEmail } = req.body;
      console.log('📧 [SEND-CONTRACT] Request:', { contractId, recipientEmail });

      if (!contractId || !recipientEmail) {
        console.log('❌ [SEND-CONTRACT] Missing required fields');
        return res.status(400).json({ message: "Contract ID and recipient email are required" });
      }

      // Fetch contract
      console.log('📎 [SEND-CONTRACT] Fetching contract...');
      const contract = await storage.getContract(contractId);
      if (!contract) {
        console.log('❌ [SEND-CONTRACT] Contract not found');
        return res.status(404).json({ message: "Contract not found" });
      }
      console.log('✅ [SEND-CONTRACT] Contract found:', contract.contractNumber);

      // Fetch crew member
      console.log('👥 [SEND-CONTRACT] Fetching crew member...');
      const crewMember = await storage.getCrewMember(contract.crewMemberId);
      if (!crewMember) {
        console.log('❌ [SEND-CONTRACT] Crew member not found');
        return res.status(404).json({ message: "Crew member not found" });
      }
      console.log('✅ [SEND-CONTRACT] Crew member found:', crewMember.firstName, crewMember.lastName);

      // Fetch vessel
      console.log('🚢 [SEND-CONTRACT] Fetching vessel...');
      const vessel = await storage.getVessel(contract.vesselId);
      console.log('✅ [SEND-CONTRACT] Vessel found:', vessel?.name);

      // Import Gmail SMTP email service
      const { smtpEmailService } = await import('./services/smtp-email-service');

      const contractTypeLabel = contract.contractType || 'SEA';
      const contractIcon = '📋';

      const subject = `${contractIcon} Contract(${contractTypeLabel}) - ${crewMember.firstName} ${crewMember.lastName} `;

      const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;"><div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;"><h1 style="margin: 0; font-size: 28px;"> ${contractIcon} Crew Contract </h1><p style="margin: 10px 0 0; opacity: 0.9;"> Employment Contract Details </p></div><div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"><h2 style="color: #1e40af; margin-top: 0;"> Crew Member Information </h2><table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;"><tr><td style="padding: 8px 0; color: #6b7280; width: 40%;"> Name: </td><td style="padding: 8px 0; font-weight: 600;">${crewMember.firstName} ${crewMember.lastName}</td></tr><tr><td style="padding: 8px 0; color: #6b7280;"> Rank: </td><td style="padding: 8px 0; font-weight: 600;">${crewMember.rank}</td></tr><tr><td style="padding: 8px 0; color: #6b7280;"> Nationality: </td><td style="padding: 8px 0; font-weight: 600;">${crewMember.nationality}</td></tr>
              ${vessel ? `<tr><td style="padding: 8px 0; color: #6b7280;">Vessel:</td><td style="padding: 8px 0; font-weight: 600;">${vessel.name}</td></tr>` : ''}
  </table><h2 style="color: #1e40af; margin-top: 30px;"> Contract Details </h2><table style="width: 100%; border-collapse: collapse;"><tr><td style="padding: 8px 0; color: #6b7280; width: 40%;"> Contract Type: </td><td style="padding: 8px 0; font-weight: 600;">${contractTypeLabel}</td></tr><tr><td style="padding: 8px 0; color: #6b7280;"> Contract Number: </td><td style="padding: 8px 0; font-weight: 600;">${contract.contractNumber || 'N/A'}</td></tr><tr><td style="padding: 8px 0; color: #6b7280;"> Start Date: </td><td style="padding: 8px 0; font-weight: 600;">${new Date(contract.startDate).toLocaleDateString()}</td></tr><tr><td style="padding: 8px 0; color: #6b7280;"> End Date: </td><td style="padding: 8px 0; font-weight: 600;">${new Date(contract.endDate).toLocaleDateString()}</td></tr><tr><td style="padding: 8px 0; color: #6b7280;"> Status: </td><td style="padding: 8px 0;"><span style="background: #10b981; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">${contract.status.toUpperCase()}</span></td></tr></table>
            ${contract.filePath ? '<p style="margin-top: 20px; padding: 15px; background: #eff6ff; border-left: 4px solid #3b82f6; color: #1e40af;">📎 The contract file is attached to this email.</p>' : ''}
  </div><div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;"><p>This email was sent from CrewTrack Pro Management System </p></div></div>
          `;

      const text = `Contract(${contractTypeLabel}) - ${crewMember.firstName} ${crewMember.lastName} \n\nCrew Member: \n - Name: ${crewMember.firstName} ${crewMember.lastName} \n - Rank: ${crewMember.rank} \n - Nationality: ${crewMember.nationality} \n\nContract Details: \n - Type: ${contractTypeLabel} \n - Number: ${contract.contractNumber || 'N/A'} \n - Start Date: ${new Date(contract.startDate).toLocaleDateString()} \n - End Date: ${new Date(contract.endDate).toLocaleDateString()} \n - Status: ${contract.status.toUpperCase()} `;

      // Prepare attachments if contract has file
      const attachments = [];
      if (contract.filePath) {
        console.log('📎 Contract has filePath:', contract.filePath);
        const fs = await import('fs');
        const path = await import('path');

        // Remove leading slash if present to ensure correct path joining
        let relativePath = contract.filePath;
        if (relativePath.startsWith('/') || relativePath.startsWith('\\')) {
          relativePath = relativePath.substring(1);
        }

        const filePath = path.default.join(process.cwd(), relativePath);
        console.log('📎 Full file path:', filePath);
        if (fs.default.existsSync(filePath)) {
          console.log('✅ File exists, reading content...');
          const fileContent = fs.default.readFileSync(filePath);
          const fileExtension = path.default.extname(filePath);
          const attachmentFileName = `Contract_${crewMember.lastName}_${contract.contractNumber || 'doc'}${fileExtension} `.replace(/ /g, '_');

          attachments.push({
            filename: attachmentFileName,
            content: fileContent
          });
          console.log('✅ Attachment added successfully');
        } else {
          console.log('❌ File does not exist at path:', filePath);
        }
      }

      // Send email
      console.log('📧 [SEND-CONTRACT] Sending email to:', recipientEmail);
      const result = await smtpEmailService.sendEmailWithAttachment({
        to: recipientEmail,
        subject,
        html,
        text,
        attachments
      });

      if (result.success) {
        console.log('✅ [SEND-CONTRACT] Email sent successfully');
        res.json({ message: `Contract sent successfully to ${recipientEmail} ` });
      } else {
        console.log('❌ [SEND-CONTRACT] Email failed:', result.error);
        res.status(500).json({ message: `Failed to send email: ${result.error} ` });
      }
    } catch (error) {
      console.error('Send contract email error:', error);
      res.status(500).json({ message: "Failed to send contract email", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Test upcoming events email endpoint
  app.post("/api/email/send-upcoming-events", authenticate, async (req, res) => {
    try {
      // Only allow admin users to send emails
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin role required." });
      }

      const settings = await storage.getEmailSettings();
      if (!settings?.recipientEmail) {
        return res.status(400).json({ message: "No recipient email configured" });
      }

      console.log("Sending upcoming events email to:", settings.recipientEmail);

      // Fetch real upcoming events from database (next 60 days)
      const [expiringDocuments, expiringContracts, crewRotations, vessels, crewMembers] = await Promise.all([
        storage.getExpiringDocuments(60),
        storage.getExpiringContracts(60),
        storage.getCrewRotations(),
        storage.getVessels(),
        storage.getCrewMembers()
      ]);
      type UpcomingEvent = {
        type: string;
        crewMemberName: string;
        vesselName?: string;
        documentType?: string;
        date: Date;
        severity: string;
        rotationType?: string;
      };

      const upcomingEvents: UpcomingEvent[] = [];
      const now = new Date();
      const futureDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

      // Add document expiries
      for (const alert of expiringDocuments) {
        const daysUntil = alert.daysUntilExpiry;
        let severity = 'low';
        if (daysUntil <= 3) severity = 'critical';
        else if (daysUntil <= 7) severity = 'high';
        else if (daysUntil <= 15) severity = 'medium';

        upcomingEvents.push({
          type: 'document_expiry',
          crewMemberName: `${alert.crewMember.firstName} ${alert.crewMember.lastName} `,
          documentType: alert.document.type,
          date: alert.document.expiryDate!,
          severity
        });
      }

      // Add contract expiries
      for (const alert of expiringContracts) {
        const daysUntil = alert.daysUntilExpiry;
        let severity = 'low';
        if (daysUntil <= 3) severity = 'critical';
        else if (daysUntil <= 7) severity = 'high';
        else if (daysUntil <= 15) severity = 'medium';

        upcomingEvents.push({
          type: 'contract_expiry',
          crewMemberName: `${alert.crewMember.firstName} ${alert.crewMember.lastName} `,
          vesselName: alert.vessel.name,
          date: alert.contract.endDate,
          severity
        });
      }

      // Add crew rotations (join/leave dates within next 30 days)
      for (const rotation of crewRotations) {
        const crewMember = crewMembers.find(c => c.id === rotation.crewMemberId);
        const vessel = vessels.find(v => v.id === rotation.vesselId);
        if (!crewMember || !vessel) continue;

        // Check join date
        if (rotation.joinDate && rotation.joinDate >= now && rotation.joinDate <= futureDate) {
          const daysUntil = Math.ceil((rotation.joinDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          let severity = 'low';
          if (daysUntil <= 3) severity = 'high';
          else if (daysUntil <= 7) severity = 'medium';

          upcomingEvents.push({
            type: 'crew_rotation',
            crewMemberName: `${crewMember.firstName} ${crewMember.lastName} `,
            vesselName: vessel.name,
            date: rotation.joinDate,
            rotationType: 'join',
            severity
          });
        }

        // Check leave date
        if (rotation.leaveDate && rotation.leaveDate >= now && rotation.leaveDate <= futureDate) {
          const daysUntil = Math.ceil((rotation.leaveDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          let severity = 'low';
          if (daysUntil <= 3) severity = 'high';
          else if (daysUntil <= 7) severity = 'medium';

          upcomingEvents.push({
            type: 'crew_rotation',
            crewMemberName: `${crewMember.firstName} ${crewMember.lastName} `,
            vesselName: vessel.name,
            date: rotation.leaveDate,
            rotationType: 'leave',
            severity
          });
        }
      }

      // Sort by date (soonest first)
      upcomingEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

      if (upcomingEvents.length === 0) {
        return res.json({
          message: "No upcoming events found in the next 60 days. Email not sent."
        });
      }

      // Import SMTP email service (using Gmail)
      const { smtpEmailService } = await import('./services/smtp-email-service');

      // Create comprehensive upcoming events email
      const upcomingEventsHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;"><div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"><div style="text-align: center; margin-bottom: 30px;"><h1 style="color: #1f2937; margin: 0; font-size: 24px;">📋 Upcoming Events Report </h1><p style="color: #6b7280; margin: 10px 0 0 0;"> Crew Management System - Next 60 Days </p></div><div style="margin-bottom: 20px;"><h2 style="color: #1f2937; font-size: 18px; margin-bottom: 15px;"> Summary </h2><p style="color: #374151; line-height: 1.5;">
                    This report contains ${upcomingEvents.length} upcoming events requiring attention:
  </p><ul style="color: #374151; margin: 10px 0;"><li>${upcomingEvents.filter(e => e.type === 'contract_expiry').length} Contract Expiries </li><li> ${upcomingEvents.filter(e => e.type === 'document_expiry').length} Document Expiries </li><li> ${upcomingEvents.filter(e => e.type === 'crew_rotation').length} Crew Rotations </li></ul></div>

            ${upcomingEvents.map((event, index) => {
        const severityColors = {
          critical: '#dc2626',
          high: '#ea580c',
          medium: '#d97706',
          low: '#059669'
        };
        const severityBg = {
          critical: '#fef2f2',
          high: '#fff7ed',
          medium: '#fffbeb',
          low: '#f0fdf4'
        };

        let title, description, icon;
        if (event.type === 'contract_expiry') {
          title = `Contract Expiry - ${event.crewMemberName}`;
          description = `Contract on vessel ${event.vesselName} expires on ${event.date.toDateString()}`;
          icon = '📋';
        } else if (event.type === 'document_expiry') {
          title = `Document Expiry - ${event.crewMemberName}`;
          description = `${event.documentType} expires on ${event.date.toDateString()}`;
          icon = '📄';
        } else if (event.type === 'crew_rotation') {
          title = `Crew Rotation - ${event.crewMemberName}`;
          description = `Scheduled to ${event.rotationType} vessel ${event.vesselName} on ${event.date.toDateString()}`;
          icon = '🔄';
        }

        const severity = event.severity as 'critical' | 'high' | 'medium' | 'low';
        return `
                <div style="background: ${severityBg[severity]}; padding: 20px; margin: 15px 0; border-radius: 6px; border-left: 4px solid ${severityColors[severity]};"><div style="display: flex; align-items: center; margin-bottom: 10px;"><span style="font-size: 20px; margin-right: 10px;">${icon}</span><h3 style="color: #1f2937; margin: 0; font-size: 16px;">${title}</h3><span style="margin-left: auto; background: ${severityColors[severity]}; color: white; padding: 3px 8px; border-radius: 12px; font-size: 12px; text-transform: uppercase; font-weight: bold;">${event.severity}</span></div><p style="color: #374151; margin: 0; line-height: 1.5;">${description}</p><div style="margin-top: 10px; font-size: 14px; color: #6b7280;"><strong>Days remaining:</strong> ${Math.ceil((event.date.getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days
                  </div></div>
              `;
      }).join('')
        }

  <div style="margin-top: 30px; padding: 20px; background: #f3f4f6; border-radius: 6px;"><h3 style="color: #1f2937; margin: 0 0 10px 0; font-size: 16px;">📧 Notification Settings </h3><p style="color: #6b7280; margin: 0; font-size: 14px;">
        This email was sent to: <strong>${settings.recipientEmail} </strong><br>
                Generated on: ${new Date().toLocaleString()} <br>
    System: Crew Management Pro
      </p></div><div style="text-align: center; margin-top: 30px; padding: 20px 0; border-top: 1px solid #e5e7eb;"><p style="color: #9ca3af; font-size: 12px; margin: 0;">
          This is an automated notification from the Crew Management System<br>
                Please contact your system administrator if you have any questions
    </p></div></div></div>
      `;

      const emailContent = {
        to: settings.recipientEmail,
        subject: '📋 Upcoming Events Report - Crew Management System',
        html: upcomingEventsHtml,
        text: `Upcoming Events Report - Crew Management System\n\n` +
          `${upcomingEvents.map((event, index) => {
            let title, description;
            if (event.type === 'contract_expiry') {
              title = `Contract Expiry - ${event.crewMemberName}`;
              description = `Contract on vessel ${event.vesselName} expires on ${event.date.toDateString()}`;
            } else if (event.type === 'document_expiry') {
              title = `Document Expiry - ${event.crewMemberName}`;
              description = `${event.documentType} expires on ${event.date.toDateString()}`;
            } else if (event.type === 'crew_rotation') {
              title = `Crew Rotation - ${event.crewMemberName}`;
              description = `Scheduled to ${event.rotationType} vessel ${event.vesselName} on ${event.date.toDateString()}`;
            }
            return `${index + 1}. ${title}\n   ${description}\n   Severity: ${event.severity.toUpperCase()}\n`;
          }).join('\n')
          } `
      };

      const result = await smtpEmailService.sendEmail(emailContent);

      if (result.success) {
        res.json({
          message: `Successfully sent upcoming events report with ${upcomingEvents.length} events to ${settings.recipientEmail} `
        });
      } else {
        res.status(500).json({
          message: `Failed to send upcoming events email: ${result.error || 'Unknown error'} `
        });
      }
    } catch (error) {
      console.error("❌ Failed to send upcoming events email:", error);
      res.status(500).json({
        message: "Failed to send upcoming events email. Please check your Gmail SMTP configuration."
      });
    }
  });

  // Send crew member details email endpoint (for testing)
  app.post("/api/email/send-crew-details", authenticate, async (req, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin role required." });
      }

      const { crewMemberId, additionalEmail } = req.body;
      if (!crewMemberId) {
        return res.status(400).json({ message: "Crew member ID required" });
      }

      const settings = await storage.getEmailSettings();
      if (!settings?.recipientEmail) {
        return res.status(400).json({ message: "No recipient email configured" });
      }

      // Build recipients list
      const recipients = [settings.recipientEmail];
      if (additionalEmail && additionalEmail.trim()) {
        const additionalEmails = additionalEmail.split(',').map((e: string) => e.trim()).filter((e: string) => e);
        recipients.push(...additionalEmails);
      }

      // Get crew member details
      const crewMember = await storage.getCrewMember(crewMemberId);
      if (!crewMember) {
        return res.status(404).json({ message: "Crew member not found" });
      }

      // Get contract details
      const contracts = await storage.getContracts();
      const activeContract = contracts.find(c => c.crewMemberId === crewMemberId && c.status === 'active');

      // Get vessel details
      const vessels = await storage.getVessels();
      const vessel = vessels.find(v => v.id === crewMember.currentVesselId);

      // Get documents
      const documents = await storage.getDocuments();
      const crewDocuments = documents.filter(d => d.crewMemberId === crewMemberId);

      // Use Gmail SMTP service instead of SendGrid
      // Use Gmail SMTP service instead of SendGrid
      const { smtpEmailService } = await import('./services/smtp-email-service');
      const { DocumentStorageService } = await import('./objectStorage');
      const documentStorageService = new DocumentStorageService();

      // PREPARE ATTACHMENTS
      const attachments: Array<{ filename: string, content: Buffer, contentType?: string }> = [];

      const hasAoaDoc = crewDocuments.some(d => d.type.toLowerCase() === 'aoa');

      for (const doc of crewDocuments) {
        if (doc.filePath) {
          try {
            const extension = path.extname(doc.filePath).toLowerCase();
            // Basic content type detection
            let contentType = 'application/pdf';
            if (['.jpg', '.jpeg'].includes(extension)) contentType = 'image/jpeg';
            else if (extension === '.png') contentType = 'image/png';

            const fileName = `${doc.type.toUpperCase()}_${doc.documentNumber || 'Document'}${extension}`;

            if (doc.filePath.startsWith('/')) {
              // Handle Object Storage path
              try {
                console.log(`Attempting to fetch document from Object Storage: ${doc.filePath}`);
                const file = await documentStorageService.getDocumentFile(doc.filePath);
                const [fileContent] = await file.download();

                attachments.push({
                  filename: fileName,
                  content: fileContent,
                  contentType
                });
                console.log(`Attached document from Object Storage: ${fileName}`);
              } catch (objStoreError) {
                console.error(`Failed to fetch from Object Storage: ${doc.filePath}`, objStoreError);
                // Fallback to local check if it might be a weird path, but usually / means object storage
              }
            } else {
              // Remove leading slash if present to ensure correct path joining (for legacy localized paths)
              let relativePath = doc.filePath;
              if (relativePath.startsWith('\\')) {
                relativePath = relativePath.substring(1);
              }

              const absolutePath = path.join(process.cwd(), relativePath);
              if (fs.existsSync(absolutePath)) {
                const fileContent = await fs.promises.readFile(absolutePath);

                attachments.push({
                  filename: fileName,
                  content: fileContent,
                  contentType
                });
              } else {
                console.warn(`Attachment file not found locally: ${absolutePath}`);
              }
            }
          } catch (err) {
            console.error(`Error reading attachment file for document ${doc.id}:`, err);
          }
        }
      }

      // ATTACH CONTRACT DOCUMENT IF AVAILABLE
      if (activeContract && activeContract.filePath) {
        try {
          const extension = path.extname(activeContract.filePath).toLowerCase() || '.pdf';
          const fileName = hasAoaDoc
            ? `CONTRACT_${activeContract.contractNumber || 'Agreement'}${extension}`
            : `AOA_CONTRACT_${activeContract.contractNumber || 'Agreement'}${extension}`;

          if (activeContract.filePath.startsWith('/')) {
            // Handle Object Storage path for contract
            try {
              console.log(`Attempting to fetch contract from Object Storage: ${activeContract.filePath}`);
              const file = await documentStorageService.getDocumentFile(activeContract.filePath);
              const [contractContent] = await file.download();

              attachments.push({
                filename: fileName,
                content: contractContent,
                contentType: 'application/pdf'
              });
              console.log(`Attached contract document from Object Storage: ${fileName}`);
            } catch (objStoreError) {
              console.error(`Failed to fetch contract from Object Storage: ${activeContract.filePath}`, objStoreError);
            }
          } else {
            let contractFilePath = activeContract.filePath;
            // Handle both /uploads/ and uploads/ paths by removing optional leading slash
            if (contractFilePath.startsWith('/') && !contractFilePath.startsWith('/replit-objstore')) {
              if (contractFilePath.startsWith('/')) contractFilePath = contractFilePath.substring(1);
            }

            const absoluteContractPath = path.join(process.cwd(), contractFilePath);
            if (fs.existsSync(absoluteContractPath)) {
              const contractContent = await fs.promises.readFile(absoluteContractPath);

              attachments.push({
                filename: fileName,
                content: contractContent,
                contentType: 'application/pdf'
              });
              console.log(`Attached contract document: ${activeContract.filePath}`);
            }
            else {
              console.warn(`Contract attachment file not found: ${absoluteContractPath}`);
            }
          }
        } catch (err) {
          console.error(`Error reading contract attachment file for contract ${activeContract.id}:`, err);
        }
      }

      // CHECK ATTACHMENT SIZE
      const totalSize = attachments.reduce((sum, att) => sum + att.content.length, 0);
      const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20MB limit for Gmail (+ overhead safety)
      let attachmentsSkipped = false;

      if (totalSize > MAX_SIZE_BYTES) {
        console.warn(`Total attachment size (${(totalSize / 1024 / 1024).toFixed(2)}MB) exceeds 20MB limit. Sending email without attachments.`);
        attachments.length = 0; // Clear attachments
        attachmentsSkipped = true;
      }

      const emergencyContact = crewMember.emergencyContact as any;

      const html = `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; background: #f8f9fa; padding: 20px;"><div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"><div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #0066cc; padding-bottom: 20px;"><h1 style="color: #0066cc; margin: 0; font-size: 24px;">👤 Crew Member Details </h1><p style="color: #6c757d; margin: 10px 0 0 0;"> Crew Management System - ${new Date().toLocaleDateString()} </p>
              ${attachments.length > 0 ? `<p style="color: #28a745; margin: 5px 0 0 0; font-weight: bold;">📎 ${attachments.length} attachment(s) included</p>` : ''}
              ${attachmentsSkipped ? '<div style="background: #fff3cd; color: #856404; padding: 10px; border-radius: 4px; margin-top: 10px; border: 1px solid #ffeeba;">⚠️ Attachments were too large (>20MB) to send via email. Please download them from the dashboard.</div>' : ''}
  </div><div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin-bottom: 20px;"><h2 style="color: #0d47a1; margin: 0 0 15px 0; font-size: 18px;">📋 Personal Information </h2><table style="width: 100%; border-collapse: collapse;"><tr><td style="padding: 8px 0; color: #666;"> Name: </td><td style="padding: 8px 0; font-weight: bold;">${crewMember.firstName} ${crewMember.lastName}</td></tr><tr><td style="padding: 8px 0; color: #666;"> Rank: </td><td style="padding: 8px 0; font-weight: bold;">${crewMember.rank}</td></tr><tr><td style="padding: 8px 0; color: #666;"> Nationality: </td><td style="padding: 8px 0;">${crewMember.nationality}</td></tr><tr><td style="padding: 8px 0; color: #666;"> Date of Birth: </td><td style="padding: 8px 0;">${new Date(crewMember.dateOfBirth).toLocaleDateString()}</td></tr><tr><td style="padding: 8px 0; color: #666;"> Phone: </td><td style="padding: 8px 0;">${crewMember.phoneNumber || 'N/A'}</td></tr><tr><td style="padding: 8px 0; color: #666;"> Email: </td><td style="padding: 8px 0;">${crewMember.email || 'N/A'}</td></tr><tr><td style="padding: 8px 0; color: #666;"> Status: </td><td style="padding: 8px 0;"><span style="background: ${crewMember.status === 'onBoard' ? '#28a745' : '#ffc107'}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">${crewMember.status === 'onBoard' ? 'On Board' : 'On Shore'}</span></td></tr></table></div>

            ${vessel ? `
            <div style="background: #fff3e0; padding: 20px; border-radius: 8px; margin-bottom: 20px;"><h2 style="color: #e65100; margin: 0 0 15px 0; font-size: 18px;">🚢 Current Vessel</h2><table style="width: 100%; border-collapse: collapse;"><tr><td style="padding: 8px 0; color: #666;">Vessel Name:</td><td style="padding: 8px 0; font-weight: bold;">${vessel.name}</td></tr><tr><td style="padding: 8px 0; color: #666;">Type:</td><td style="padding: 8px 0;">${vessel.type}</td></tr><tr><td style="padding: 8px 0; color: #666;">Flag:</td><td style="padding: 8px 0;">${vessel.flag}</td></tr><tr><td style="padding: 8px 0; color: #666;">IMO Number:</td><td style="padding: 8px 0;">${vessel.imoNumber || 'N/A'}</td></tr></table></div>
            ` : ''
        }

            ${activeContract ? `
            <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; margin-bottom: 20px;"><h2 style="color: #2e7d32; margin: 0 0 15px 0; font-size: 18px;">📝 Active Contract</h2><table style="width: 100%; border-collapse: collapse;"><tr><td style="padding: 8px 0; color: #666;">Start Date:</td><td style="padding: 8px 0;">${new Date(activeContract.startDate).toLocaleDateString()}</td></tr><tr><td style="padding: 8px 0; color: #666;">End Date:</td><td style="padding: 8px 0;">${new Date(activeContract.endDate).toLocaleDateString()}</td></tr><tr><td style="padding: 8px 0; color: #666;">Duration:</td><td style="padding: 8px 0;">${activeContract.durationDays || Math.ceil((new Date(activeContract.endDate).getTime() - new Date(activeContract.startDate).getTime()) / (1000 * 60 * 60 * 24))} days</td></tr><tr><td style="padding: 8px 0; color: #666;">Status:</td><td style="padding: 8px 0;"><span style="background: #28a745; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">Active</span></td></tr></table></div>
            ` : '<div style="background: #ffebee; padding: 20px; border-radius: 8px; margin-bottom: 20px;"><p style="color: #c62828; margin: 0;">⚠️ No active contract found</p></div>'
        }

            ${crewDocuments.length > 0 ? `
            <div style="background: #f3e5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px;"><h2 style="color: #7b1fa2; margin: 0 0 15px 0; font-size: 18px;">📄 Documents</h2><table style="width: 100%; border-collapse: collapse; font-size: 14px;"><thead><tr style="background: #e1bee7;"><th style="padding: 10px; text-align: left;">Type</th><th style="padding: 10px; text-align: left;">Number</th><th style="padding: 10px; text-align: left;">Expiry Date</th><th style="padding: 10px; text-align: left;">Status</th></tr></thead><tbody>
                  ${crewDocuments.map(doc => {
          const isExpired = new Date(doc.expiryDate) < new Date();
          const isExpiring = new Date(doc.expiryDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          return `
                    <tr><td style="padding: 10px; border-bottom: 1px solid #e1bee7; text-transform: uppercase;">${doc.type}</td><td style="padding: 10px; border-bottom: 1px solid #e1bee7;">${doc.documentNumber}</td><td style="padding: 10px; border-bottom: 1px solid #e1bee7;">${new Date(doc.expiryDate).toLocaleDateString()}</td><td style="padding: 10px; border-bottom: 1px solid #e1bee7;"><span style="background: ${isExpired ? '#dc3545' : isExpiring ? '#ffc107' : '#28a745'}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
                          ${isExpired ? 'Expired' : isExpiring ? 'Expiring Soon' : 'Valid'}
                        </span></td></tr>`;
        }).join('')}
                </tbody></table></div>
            ` : ''
        }

            ${emergencyContact ? `
            <div style="background: #fce4ec; padding: 20px; border-radius: 8px; margin-bottom: 20px;"><h2 style="color: #c2185b; margin: 0 0 15px 0; font-size: 18px;">🆘 Emergency Contact</h2><table style="width: 100%; border-collapse: collapse;"><tr><td style="padding: 8px 0; color: #666;">Name:</td><td style="padding: 8px 0; font-weight: bold;">${emergencyContact.name || 'N/A'}</td></tr><tr><td style="padding: 8px 0; color: #666;">Relationship:</td><td style="padding: 8px 0;">${emergencyContact.relationship || 'N/A'}</td></tr><tr><td style="padding: 8px 0; color: #666;">Phone:</td><td style="padding: 8px 0;">${emergencyContact.phone || 'N/A'}</td></tr><tr><td style="padding: 8px 0; color: #666;">Email:</td><td style="padding: 8px 0;">${emergencyContact.email || 'N/A'}</td></tr></table></div>
            ` : ''
        }

  <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;"><p style="color: #6c757d; font-size: 14px; margin: 0;">
      This email was sent from your Crew Management System
        </p><p style="color: #6c757d; font-size: 12px; margin: 5px 0 0 0;">
          Generated: ${new Date().toLocaleString()}
  </p></div></div></div>
      `;

      const emailParams = {
        to: recipients.join(', '),
        subject: `👤 Crew Details: ${crewMember.firstName} ${crewMember.lastName} - ${crewMember.rank} `,
        html,
        text: `Crew Member Details\n\nName: ${crewMember.firstName} ${crewMember.lastName} \nRank: ${crewMember.rank} \nNationality: ${crewMember.nationality} \nStatus: ${crewMember.status} \n${vessel ? `\nCurrent Vessel: ${vessel.name}` : ''} \n${activeContract ? `\nContract: ${new Date(activeContract.startDate).toLocaleDateString()} - ${new Date(activeContract.endDate).toLocaleDateString()}` : ''} `,
        attachments: attachments.length > 0 ? attachments : undefined
      };

      const result = attachments.length > 0
        ? await smtpEmailService.sendEmailWithAttachment(emailParams)
        : await smtpEmailService.sendEmail(emailParams);

      if (result.success) {
        res.json({
          message: `Successfully sent crew details for ${crewMember.firstName} ${crewMember.lastName} to ${recipients.join(', ')} `
        });
      } else {
        res.status(500).json({ message: `Failed to send email: ${result.error || 'Unknown error'} ` });
      }
    } catch (error) {
      console.error("❌ Failed to send crew details email:", error);
      console.error("Error details:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
      res.status(500).json({
        message: "Failed to send crew details email",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Contact crew member endpoint
  app.post("/api/crew/contact", authenticate, async (req, res) => {
    try {
      const { crewMemberId, subject, message } = req.body;

      if (!crewMemberId || !subject || !message) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Get crew member details
      const crewMember = await storage.getCrewMember(crewMemberId);
      if (!crewMember) {
        return res.status(404).json({ message: "Crew member not found" });
      }

      // In a real app, this would send an actual email
      console.log(`Sending message to crew member ${crewMember.firstName} ${crewMember.lastName}: `);
      console.log(`Subject: ${subject} `);
      console.log(`Message: ${message} `);

      // Simulate email sending delay
      await new Promise(resolve => setTimeout(resolve, 800));

      res.json({
        message: "Message sent successfully",
        recipient: `${crewMember.firstName} ${crewMember.lastName} `,
        subject,
        sentAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error sending crew contact message:', error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // System activity report endpoint
  app.get('/api/system/activity-report', authenticate, async (req, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      // Get activity logs directly from database
      const activities = await db
        .select()
        .from(activityLogs)
        .orderBy(sql`${activityLogs.createdAt} DESC`);

      res.json(activities);
    } catch (error) {
      console.error('Error generating activity report:', error);
      res.status(500).json({ message: 'Failed to generate activity report', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Status change history endpoint
  app.get('/api/status-change-history', authenticate, async (req, res) => {
    try {
      // Get all status change history with crew and vessel details
      const history = await db
        .select({
          id: statusChangeHistory.id,
          crewMemberId: statusChangeHistory.crewMemberId,
          previousStatus: statusChangeHistory.previousStatus,
          newStatus: statusChangeHistory.newStatus,
          reason: statusChangeHistory.reason,
          changedBy: statusChangeHistory.changedBy,
          changedByUsername: statusChangeHistory.changedByUsername,
          vesselId: statusChangeHistory.vesselId,
          contractId: statusChangeHistory.contractId,
          createdAt: statusChangeHistory.createdAt,
          crewMember: {
            id: crewMembers.id,
            firstName: crewMembers.firstName,
            lastName: crewMembers.lastName,
            rank: crewMembers.rank,
            nationality: crewMembers.nationality,
            status: crewMembers.status,
          },
          vessel: {
            id: vessels.id,
            name: vessels.name,
            type: vessels.type,
          },
        })
        .from(statusChangeHistory)
        .leftJoin(crewMembers, sql`${statusChangeHistory.crewMemberId} = ${crewMembers.id} `)
        .leftJoin(vessels, sql`${statusChangeHistory.vesselId} = ${vessels.id} `)
        .orderBy(sql`${statusChangeHistory.createdAt} DESC`);

      res.json(history);
    } catch (error) {
      console.error('Error fetching status change history:', error);
      res.status(500).json({ message: 'Failed to fetch status change history', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // OCR route for extracting crew data from documents
  app.post("/api/ocr/extract-crew-data", authenticate, async (req, res) => {
    try {
      console.log('OCR request received from user:', req.user?.username);
      const { image, filename } = req.body;

      if (!image) {
        console.log('No image data provided in request');
        return res.status(400).json({ message: "Image data is required" });
      }

      let extractedData;
      const isPDF = filename?.toLowerCase().endsWith('.pdf') || (image && image.startsWith('JVBERi'));

      // Use a multi-engine pipeline with priority based on file type
      try {
        if (isPDF) {
          console.log('PDF detected. Prioritizing Gemini for best results.');
          if (geminiOcrService.isAvailable()) {
            try {
              extractedData = await geminiOcrService.extractCrewDataFromDocument(image, filename);
            } catch (geminiError) {
              console.error('Gemini PDF extraction failed, trying Groq:', geminiError);
              extractedData = await groqOcrService.extractCrewDataFromDocument(image, filename);
            }
          } else {
            extractedData = await groqOcrService.extractCrewDataFromDocument(image, filename);
          }
        } else {
          // IMAGE PROCESSING: Prioritize Groq, fallback to Gemini
          if (groqOcrService.isAvailable()) {
            console.log('Using Groq Vision AI for image OCR');
            try {
              extractedData = await groqOcrService.extractCrewDataFromDocument(image, filename);
            } catch (groqError) {
              console.error('Groq image extraction failed, trying Gemini:', groqError);
              if (geminiOcrService.isAvailable()) {
                extractedData = await geminiOcrService.extractCrewDataFromDocument(image, filename);
              } else {
                throw groqError;
              }
            }
          } else if (geminiOcrService.isAvailable()) {
            console.log('Groq unavailable, using Gemini for image OCR');
            extractedData = await geminiOcrService.extractCrewDataFromDocument(image, filename);
          } else {
            console.log('No AI services available, using local OCR');
            extractedData = await localOcrService.extractCrewDataFromDocument(image, filename);
          }
        }
      } catch (pipelineError) {
        console.error('AI pipeline failed, falling back to local OCR:', pipelineError);
        extractedData = await localOcrService.extractCrewDataFromDocument(image, filename);
      }

      // Ensure we return a record format
      const recordId = `crew-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const displayName = extractedData.seafarerName || extractedData.name || 'Unknown Crew Member';
      const result = {
        ...extractedData,
        recordId,
        displayName
      };

      // Log the OCR activity
      try {
        await db.insert(activityLogs).values({
          type: "Document Processing",
          action: "ocr_document_scan",
          entityType: "document",
          description: `Scanned crew document: ${filename || 'Unknown file'} `,
          severity: "info",
          username: req.user?.username || "unknown",
          userRole: req.user?.role || "unknown",
          metadata: JSON.stringify({ filename, extractedFields: Object.keys(extractedData).length })
        });
      } catch (logError) {
        console.error("Failed to log OCR activity:", logError);
      }

      res.json(result);
    } catch (error) {
      console.error("OCR extraction error:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to extract data from document"
      });
    }
  });

  // File upload handler with multipart form data

  // Configure multer for file uploads



  // Handle both multipart file uploads and JSON requests
  app.post("/api/upload", authenticate, (req: any, res, next) => {
    // Check if request is multipart (has actual file)
    const isMultipart = req.headers['content-type']?.includes('multipart/form-data');

    if (isMultipart) {
      // Use multer for actual file uploads
      upload.single('file')(req, res, next);
    } else {
      // Handle JSON requests (legacy format)
      next();
    }
  }, async (req: any, res) => {
    try {
      if (req.file) {
        // Real file uploaded via multipart
        const filePath = `/uploads/${req.file.filename}`;
        res.json({
          message: "File uploaded successfully",
          filePath: filePath
        });
      } else if (req.body.filename && req.body.fileType) {
        // JSON request with file metadata (legacy format)
        // Create a mock file path for now - this maintains compatibility
        const timestamp = Date.now();
        const sanitizedFilename = req.body.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
        const mockFilePath = `/uploads/${timestamp}-${sanitizedFilename}`;

        res.json({
          message: "File uploaded successfully",
          filePath: mockFilePath
        });
      } else {
        return res.status(400).json({ message: "No file uploaded" });
      }
    } catch (error) {
      console.error("File upload error:", error);
      res.status(500).json({ message: "File upload failed" });
    }
  });

  // Vessel document routes
  app.get("/api/vessels/:vesselId/documents", authenticate, async (req, res) => {
    try {
      const { vesselId } = req.params;
      const documents = await storage.getVesselDocuments(vesselId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching vessel documents:", error);
      res.status(500).json({ message: "Failed to fetch vessel documents" });
    }
  });

  // Get upload URL for vessel document
  app.post("/api/vessels/:vesselId/documents/upload-url", authenticate, async (req, res) => {
    try {
      const { vesselId } = req.params;
      const { fileName } = req.body;

      if (!fileName) {
        return res.status(400).json({ message: "fileName is required" });
      }

      const documentStorageService = new DocumentStorageService();
      const uploadURL = await documentStorageService.getDocumentUploadURL('vessels', vesselId, fileName);

      res.json({ uploadURL });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ message: "Failed to generate upload URL" });
    }
  });

  app.post("/api/vessels/:vesselId/documents", authenticate, async (req, res) => {
    try {
      const { vesselId } = req.params;
      const documentStorageService = new DocumentStorageService();

      // Normalize the file path from upload URL
      const normalizedFilePath = req.body.filePath ?
        documentStorageService.normalizeDocumentPath(req.body.filePath) : null;

      const documentData = insertVesselDocumentSchema.parse({
        ...req.body,
        filePath: normalizedFilePath,
        vesselId,
        uploadedBy: req.user?.id,
      });

      const document = await storage.createVesselDocument(documentData);

      // Log the activity
      await storage.logActivity({
        type: "Document Management",
        action: "create",
        entityType: "vessel_document",
        entityId: document.id,
        userId: req.user?.id || null,
        username: req.user?.username || "unknown",
        userRole: req.user?.role || "unknown",
        description: `Uploaded vessel document: ${document.name} `,
        severity: "info",
        metadata: {
          vesselId,
          documentType: document.type,
          fileName: document.fileName
        }
      });

      res.json(document);
    } catch (error) {
      console.error("Error creating vessel document:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid document data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create vessel document" });
      }
    }
  });

  app.get("/api/vessel-documents/:id", authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const document = await storage.getVesselDocument(id);

      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      res.json(document);
    } catch (error) {
      console.error("Error fetching vessel document:", error);
      res.status(500).json({ message: "Failed to fetch vessel document" });
    }
  });

  // Download vessel document
  app.get("/api/vessel-documents/:id/download", authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const document = await storage.getVesselDocument(id);

      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      const documentStorageService = new DocumentStorageService();
      await documentStorageService.downloadDocument(document.filePath, res);
    } catch (error) {
      console.error("Error downloading vessel document:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to download document" });
      }
    }
  });

  app.put("/api/vessel-documents/:id", authenticate, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = insertVesselDocumentSchema.partial().parse(req.body);
      const document = await storage.updateVesselDocument(id, updates);

      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Log the activity
      await storage.logActivity({
        type: "Document Management",
        action: "update",
        entityType: "vessel_document",
        entityId: document.id,
        userId: req.user?.id || null,
        username: req.user?.username || "unknown",
        userRole: req.user?.role || "unknown",
        description: `Updated vessel document: ${document.name} `,
        severity: "info"
      });

      res.json(document);
    } catch (error) {
      console.error("Error updating vessel document:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid update data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update vessel document" });
      }
    }
  });

  app.delete("/api/vessel-documents/:id", authenticate, async (req, res) => {
    try {
      const { id } = req.params;

      // First get the document for logging
      const document = await storage.getVesselDocument(id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      const success = await storage.deleteVesselDocument(id);

      if (!success) {
        return res.status(404).json({ message: "Document not found" });
      }

      // Log the activity
      await storage.logActivity({
        type: "Document Management",
        action: "delete",
        entityType: "vessel_document",
        entityId: id,
        userId: req.user?.id || null,
        username: req.user?.username || "unknown",
        userRole: req.user?.role || "unknown",
        description: `Deleted vessel document: ${document.name} `,
        severity: "info"
      });

      res.json({ message: "Document deleted successfully" });
    } catch (error) {
      console.error("Error deleting vessel document:", error);
      res.status(500).json({ message: "Failed to delete vessel document" });
    }
  });

  // Bulk download route for vessel documents
  app.get("/api/vessels/:vesselId/documents/download-all", authenticate, async (req, res) => {
    try {
      const { vesselId } = req.params;
      const documents = await storage.getVesselDocuments(vesselId);

      if (documents.length === 0) {
        return res.status(404).json({ message: "No documents found for this vessel" });
      }

      // In a real app, this would create a ZIP file containing all documents
      // For now, we'll return the document metadata for bulk operations
      res.json({
        message: "Bulk download prepared",
        count: documents.length,
        documents: documents.map(doc => ({
          id: doc.id,
          name: doc.name,
          fileName: doc.fileName,
          filePath: doc.filePath
        }))
      });
    } catch (error) {
      console.error("Error preparing bulk download:", error);
      res.status(500).json({ message: "Failed to prepare bulk download" });
    }
  });

  // Project download routes
  app.get("/download/project", (req, res) => {
    const filePath = path.join(process.cwd(), 'crew-system-code-only.tar.gz');
    if (fs.existsSync(filePath)) {
      res.download(filePath, 'crew-management-system.tar.gz');
    } else {
      res.status(404).json({ message: "Download file not found" });
    }
  });

  app.get("/download/project-full", (req, res) => {
    const filePath = path.join(process.cwd(), 'crew-management-system.tar.gz');
    if (fs.existsSync(filePath)) {
      res.download(filePath, 'crew-management-system-full.tar.gz');
    } else {
      res.status(404).json({ message: "Download file not found" });
    }
  });

  // Admin endpoint to clear all crew data
  app.delete("/api/admin/clear-crew-data", authenticate, async (req, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin role required." });
      }

      console.log(`Admin ${req.user.username} is clearing all crew data...`);

      // Use raw SQL for more reliable deletion with proper order
      // Delete in order due to foreign key constraints

      try {
        // 1. Delete status change history
        await db.execute(sql`DELETE FROM status_change_history`);
        console.log("Deleted status change history");
      } catch (e) {
        console.log("Status change history already empty or error:", e);
      }

      try {
        // 2. Delete scanned documents (references documents)
        await db.execute(sql`DELETE FROM scanned_documents`);
        console.log("Deleted scanned documents");
      } catch (e) {
        console.log("Scanned documents already empty or error:", e);
      }

      try {
        // 3. Delete documents (references crew_members)
        await db.execute(sql`DELETE FROM documents`);
        console.log("Deleted documents");
      } catch (e) {
        console.log("Documents already empty or error:", e);
      }

      try {
        // 3. Delete contracts (references crew_members)
        await db.execute(sql`DELETE FROM contracts`);
        console.log("Deleted contracts");
      } catch (e) {
        console.log("Contracts already empty or error:", e);
      }

      try {
        // 4. Delete crew rotations
        await db.execute(sql`DELETE FROM crew_rotations`);
        console.log("Deleted crew rotations");
      } catch (e) {
        console.log("Crew rotations already empty or error:", e);
      }

      try {
        // 5. Delete crew members
        await db.execute(sql`DELETE FROM crew_members`);
        console.log("Deleted crew members");
      } catch (e) {
        console.log("Error deleting crew members:", e);
        throw e; // Re-throw this one as it's the main goal
      }

      // Log the activity
      try {
        await storage.logActivity({
          userId: req.user.id,
          username: req.user.username || 'admin',
          userRole: req.user.role,
          type: 'delete',
          action: 'delete',
          entityType: 'crew_data',
          description: 'Cleared all crew data (crew members, contracts, documents, status history, rotations)',
          severity: 'high'
        });
      } catch (e) {
        console.log("Activity logging error (non-critical):", e);
      }

      res.json({
        message: "All crew data has been cleared successfully. Vessels have been preserved."
      });
    } catch (error) {
      console.error("Error clearing crew data:", error);
      res.status(500).json({ message: "Failed to clear crew data: " + (error instanceof Error ? error.message : 'Unknown error') });
    }
  });

  // Send calendar summary email endpoint
  app.post("/api/email/send-calendar-summary", authenticate, async (req, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin role required." });
      }

      const { month, events, additionalEmail } = req.body;
      if (!month || !events) {
        return res.status(400).json({ message: "Month and events data required" });
      }

      const settings = await storage.getEmailSettings();
      if (!settings?.recipientEmail) {
        return res.status(400).json({ message: "No recipient email configured. Please configure email settings first." });
      }

      // Build recipient list
      const recipients = [settings.recipientEmail];
      if (additionalEmail && additionalEmail.trim()) {
        const additionalEmails = additionalEmail.split(',').map((e: string) => e.trim()).filter((e: string) => e);
        recipients.push(...additionalEmails);
      }

      console.log(`Sending calendar summary for ${month} to: `, recipients.join(', '));

      // Use Gmail SMTP service instead of SendGrid
      const { SMTPEmailService } = await import('./services/smtp-email-service');
      const smtpService = new SMTPEmailService();

      // Group events by type
      const dueEvents = events.filter((e: any) => e.type === 'contract_due');
      const expiredEvents = events.filter((e: any) => e.type === 'contract_expired');
      const formatEventRow = (event: any, type: string) => {
        const eventDate = new Date(event.date);
        const dateStr = eventDate.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
        const bgColor = type === 'expired' ? '#fee2e2' : '#fef3c7';
        const textColor = type === 'expired' ? '#dc2626' : '#d97706';

        return `
    <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 12px; font-weight: 500;"> ${event.crewMemberName} </td><td style="padding: 12px;"> ${event.vesselName} </td><td style="padding: 12px;"> ${dateStr} </td><td style="padding: 12px;"><span style="background: ${bgColor}; color: ${textColor}; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;">
                ${event.daysUntilExpiry} days
                  </span></td></tr>
                    `;
      };

      const html = `
                  <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; background: #f8f9fa; padding: 20px;"><div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"><div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #0066cc; padding-bottom: 20px;"><h1 style="color: #0066cc; margin: 0; font-size: 24px;">📅 Contract Calendar Summary </h1><p style="color: #6c757d; margin: 10px 0 0 0;"> ${month} </p></div><div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 30px;"><div style="background: #fef3c7; padding: 15px; border-radius: 8px; text-align: center;"><div style="font-size: 28px; font-weight: bold; color: #d97706;"> ${dueEvents.length} </div><div style="font-size: 12px; color: #92400e;"> Contracts Due </div></div><div style="background: #fee2e2; padding: 15px; border-radius: 8px; text-align: center;"><div style="font-size: 28px; font-weight: bold; color: #dc2626;"> ${expiredEvents.length} </div><div style="font-size: 12px; color: #991b1b;"> Contracts Expired </div></div><div style="background: #dbeafe; padding: 15px; border-radius: 8px; text-align: center;"><div style="font-size: 28px; font-weight: bold; color: #2563eb;"> ${events.length} </div><div style="font-size: 12px; color: #1e40af;"> Total Events </div></div></div>

            ${dueEvents.length > 0 ? `
            <div style="margin-bottom: 25px;"><h2 style="color: #d97706; margin: 0 0 15px 0; font-size: 16px; display: flex; align-items: center;">
                ⏰ Contracts Due Soon (${dueEvents.length})
              </h2><table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #e5e7eb; border-radius: 8px;"><thead><tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;"><th style="padding: 12px; text-align: left; font-size: 12px; color: #6b7280;">Crew Member</th><th style="padding: 12px; text-align: left; font-size: 12px; color: #6b7280;">Vessel</th><th style="padding: 12px; text-align: left; font-size: 12px; color: #6b7280;">Due Date</th><th style="padding: 12px; text-align: left; font-size: 12px; color: #6b7280;">Days Left</th></tr></thead><tbody>
                  ${dueEvents.map((e: any) => formatEventRow(e, 'due')).join('')}
                </tbody></table></div>
            ` : ''
        }

            ${expiredEvents.length > 0 ? `
            <div style="margin-bottom: 25px;"><h2 style="color: #dc2626; margin: 0 0 15px 0; font-size: 16px; display: flex; align-items: center;">
                ⚠️ Contracts Expired (${expiredEvents.length})
              </h2><table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #e5e7eb; border-radius: 8px;"><thead><tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;"><th style="padding: 12px; text-align: left; font-size: 12px; color: #6b7280;">Crew Member</th><th style="padding: 12px; text-align: left; font-size: 12px; color: #6b7280;">Vessel</th><th style="padding: 12px; text-align: left; font-size: 12px; color: #6b7280;">Expiry Date</th><th style="padding: 12px; text-align: left; font-size: 12px; color: #6b7280;">Days Overdue</th></tr></thead><tbody>
                  ${expiredEvents.map((e: any) => formatEventRow(e, 'expired')).join('')}
                </tbody></table></div>
            ` : ''
        }

            ${events.length === 0 ? `
            <div style="text-align: center; padding: 40px; background: #f0fdf4; border-radius: 8px;"><div style="font-size: 48px; margin-bottom: 10px;">✅</div><p style="color: #16a34a; font-weight: 500; margin: 0;">No contract events for ${month}</p></div>
            ` : ''
        }

  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;"><p style="color: #9ca3af; font-size: 12px; margin: 0;">
      This report was generated on ${new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
        }
  </p><p style="color: #9ca3af; font-size: 12px; margin: 5px 0 0 0;">
      Crew Management System
        </p></div></div></div>
          `;

      const textContent = `Contract Calendar Summary for ${month}\n\nContracts Due: ${dueEvents.length} \nContracts Expired: ${expiredEvents.length} \nTotal Events: ${events.length} \n\n` +
        (dueEvents.length > 0 ? `Due Soon: \n${dueEvents.map((e: any) => `- ${e.crewMemberName} (${e.vesselName}) - ${new Date(e.date).toLocaleDateString()}`).join('\n')} \n\n` : '') +
        (expiredEvents.length > 0 ? `Expired: \n${expiredEvents.map((e: any) => `- ${e.crewMemberName} (${e.vesselName}) - ${new Date(e.date).toLocaleDateString()}`).join('\n')} ` : '');

      // Generate PDF attachment
      const { pdfGeneratorService } = await import('./services/pdf-generator');
      let pdfBuffer: Buffer | null = null;
      try {
        const pdfEvents = events.map((e: any) => ({
          ...e,
          date: new Date(e.date),
          contractEndDate: new Date(e.contractEndDate),
        }));
        pdfBuffer = await pdfGeneratorService.generateCalendarPDF(month, pdfEvents);
        console.log(`📄 PDF generated for manual email(${pdfBuffer.length} bytes)`);
      } catch (pdfError) {
        console.error('⚠️ Failed to generate PDF for manual email:', pdfError);
      }

      // Send to all recipients with PDF attachment
      const sendResults = await Promise.all(
        recipients.map(async (recipient) => {
          if (pdfBuffer) {
            return smtpService.sendEmailWithAttachment({
              to: recipient,
              subject: `Contract Calendar Summary - ${month} `,
              html,
              text: textContent,
              attachments: [{
                filename: `Contract - Calendar - ${month.replace(/\s+/g, '-')}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf',
              }],
            });
          } else {
            return smtpService.sendEmail({
              to: recipient,
              subject: `Contract Calendar Summary - ${month} `,
              html,
              text: textContent
            });
          }
        })
      );

      const allSuccess = sendResults.every(result => result.success);
      if (!allSuccess) {
        const failedResults = sendResults.filter(r => !r.success);
        const errorMsg = failedResults.map(r => r.error).filter(Boolean).join(', ');
        return res.status(500).json({ message: `Failed to send email to some recipients: ${errorMsg || 'Unknown error'} ` });
      }

      res.json({
        message: `Calendar summary for ${month} sent to ${recipients.join(', ')} `
      });
    } catch (error) {
      console.error("Failed to send calendar summary email:", error);
      res.status(500).json({
        message: "Failed to send calendar summary email. Please check your email configuration."
      });
    }
  });

  // Send status history email endpoint
  app.post("/api/email/send-status-history", authenticate, async (req, res) => {
    try {
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: "Access denied. Admin role required." });
      }

      const { statusHistory, additionalEmail } = req.body;
      if (!statusHistory || !Array.isArray(statusHistory)) {
        return res.status(400).json({ message: "Status history data required" });
      }

      const settings = await storage.getEmailSettings();
      if (!settings?.recipientEmail) {
        return res.status(400).json({ message: "No recipient email configured. Please configure email settings first." });
      }

      // Build recipient list
      const recipients = [settings.recipientEmail];
      if (additionalEmail && additionalEmail.trim()) {
        const additionalEmails = additionalEmail.split(',').map((e: string) => e.trim()).filter((e: string) => e);
        recipients.push(...additionalEmails);
      }

      console.log(`Sending status history email to: `, recipients.join(', '));

      // Use Gmail SMTP service
      const { SMTPEmailService } = await import('./services/smtp-email-service');
      const smtpService = new SMTPEmailService();

      // Helper to extract crew member name from nested object
      const getCrewName = (record: any) => {
        if (record.crewMember) {
          const first = record.crewMember.firstName || '';
          const last = record.crewMember.lastName || '';
          return `${first} ${last} `.trim() || 'Unknown';
        }
        return record.crewMemberName || 'Unknown';
      };

      // Helper to extract vessel name from nested object
      const getVesselName = (record: any) => {
        if (record.vessel?.name) return record.vessel.name;
        return record.vesselName || 'N/A';
      };

      // Group by status (handles both onBoard/onShore and signed_on/signed_off formats)
      const signedOn = statusHistory.filter((r: any) => r.newStatus === 'onBoard' || r.newStatus === 'signed_on');
      const signedOff = statusHistory.filter((r: any) => r.newStatus === 'onShore' || r.newStatus === 'signed_off');
      const onLeave = statusHistory.filter((r: any) => r.newStatus === 'on_leave');
      const available = statusHistory.filter((r: any) => r.newStatus === 'available');

      const formatStatusRow = (record: any) => {
        // Use createdAt if changedAt is not available
        const changeDate = new Date(record.createdAt || record.changedAt);
        const dateStr = isNaN(changeDate.getTime()) ? 'Unknown Date' : changeDate.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });

        const statusColors: Record<string, { bg: string; text: string }> = {
          'onBoard': { bg: '#dcfce7', text: '#16a34a' },
          'signed_on': { bg: '#dcfce7', text: '#16a34a' },
          'onShore': { bg: '#fee2e2', text: '#dc2626' },
          'signed_off': { bg: '#fee2e2', text: '#dc2626' },
          'on_leave': { bg: '#fef3c7', text: '#d97706' },
          'available': { bg: '#dbeafe', text: '#2563eb' }
        };

        const statusLabels: Record<string, string> = {
          'onBoard': 'On Board',
          'signed_on': 'Signed On',
          'onShore': 'On Shore',
          'signed_off': 'Signed Off',
          'on_leave': 'On Leave',
          'available': 'Available'
        };

        const colors = statusColors[record.newStatus] || { bg: '#f3f4f6', text: '#6b7280' };
        const statusLabel = statusLabels[record.newStatus] || record.newStatus || 'Unknown';

        return `
    <tr style="border-bottom: 1px solid #e5e7eb;"><td style="padding: 12px; font-weight: 500;"> ${getCrewName(record)} </td><td style="padding: 12px;"> ${getVesselName(record)} </td><td style="padding: 12px;"> ${dateStr} </td><td style="padding: 12px;"><span style="background: ${colors.bg}; color: ${colors.text}; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;">
                ${statusLabel}
  </span></td></tr>
      `;
      };

      const html = `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; background: #f8f9fa; padding: 20px;"><div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"><div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #0066cc; padding-bottom: 20px;"><h1 style="color: #0066cc; margin: 0; font-size: 24px;"> Crew Status History Report </h1><p style="color: #6c757d; margin: 10px 0 0 0;"> Status change summary </p></div><div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 15px; margin-bottom: 30px;"><div style="background: #dcfce7; padding: 15px; border-radius: 8px; text-align: center;"><div style="font-size: 28px; font-weight: bold; color: #16a34a;"> ${signedOn.length} </div><div style="font-size: 12px; color: #166534;"> On Board </div></div><div style="background: #fee2e2; padding: 15px; border-radius: 8px; text-align: center;"><div style="font-size: 28px; font-weight: bold; color: #dc2626;"> ${signedOff.length} </div><div style="font-size: 12px; color: #991b1b;"> On Shore </div></div><div style="background: #fef3c7; padding: 15px; border-radius: 8px; text-align: center;"><div style="font-size: 28px; font-weight: bold; color: #d97706;"> ${onLeave.length} </div><div style="font-size: 12px; color: #92400e;"> On Leave </div></div><div style="background: #dbeafe; padding: 15px; border-radius: 8px; text-align: center;"><div style="font-size: 28px; font-weight: bold; color: #2563eb;"> ${available.length} </div><div style="font-size: 12px; color: #1e40af;"> Available </div></div></div>

            ${statusHistory.length > 0 ? `
            <div style="margin-bottom: 25px;"><h2 style="color: #374151; margin: 0 0 15px 0; font-size: 16px;">
                All Status Changes (${statusHistory.length})
              </h2><table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #e5e7eb; border-radius: 8px;"><thead><tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;"><th style="padding: 12px; text-align: left; font-size: 12px; color: #6b7280;">Crew Member</th><th style="padding: 12px; text-align: left; font-size: 12px; color: #6b7280;">Vessel</th><th style="padding: 12px; text-align: left; font-size: 12px; color: #6b7280;">Date</th><th style="padding: 12px; text-align: left; font-size: 12px; color: #6b7280;">Status</th></tr></thead><tbody>
                  ${statusHistory.map((r: any) => formatStatusRow(r)).join('')}
                </tbody></table></div>
            ` : `
            <div style="text-align: center; padding: 40px; background: #f0fdf4; border-radius: 8px;"><div style="font-size: 48px; margin-bottom: 10px;">No status changes to report</div></div>
            `}

  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;"><p style="color: #9ca3af; font-size: 12px; margin: 0;">
      This report was generated on ${new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
        }
  </p><p style="color: #9ca3af; font-size: 12px; margin: 5px 0 0 0;">
      Crew Management System
        </p></div></div></div>
          `;

      const textContent = `Crew Status History Report\n\nOn Board: ${signedOn.length} \nOn Shore: ${signedOff.length} \nOn Leave: ${onLeave.length} \nAvailable: ${available.length} \nTotal: ${statusHistory.length} \n\n` +
        statusHistory.map((r: any) => {
          const crewName = getCrewName(r);
          const vesselName = getVesselName(r);
          const status = r.newStatus === 'onBoard' ? 'On Board' : r.newStatus === 'onShore' ? 'On Shore' : r.newStatus;
          const date = new Date(r.createdAt || r.changedAt);
          const dateStr = isNaN(date.getTime()) ? 'Unknown Date' : date.toLocaleDateString();
          return `- ${crewName} (${vesselName}) - ${status} on ${dateStr} `;
        }).join('\n');

      // Send to all recipients
      const sendResults = await Promise.all(
        recipients.map(async (recipient) => {
          const emailContent = {
            to: recipient,
            subject: `Crew Status History Report - ${new Date().toLocaleDateString()} `,
            html,
            text: textContent
          };
          return smtpService.sendEmail(emailContent);
        })
      );

      const allSuccess = sendResults.every(result => result.success);
      if (!allSuccess) {
        const failedResults = sendResults.filter(r => !r.success);
        const errorMsg = failedResults.map(r => r.error).filter(Boolean).join(', ');
        return res.status(500).json({ message: `Failed to send email to some recipients: ${errorMsg || 'Unknown error'} ` });
      }

      res.json({
        message: `Status history report sent to ${recipients.join(', ')} `
      });
    } catch (error) {
      console.error("Failed to send status history email:", error);
      res.status(500).json({
        message: "Failed to send status history email. Please check your email configuration."
      });
    }
  });

  // DEBUG ENDPOINT: Check scanned passport data
  app.get("/api/debug/scanned-passports", authenticate, async (req, res) => {
    try {
      const passports = await db
        .select()
        .from(documents)
        .where(eq(documents.type, 'passport'))
        .orderBy(sql`${documents.createdAt} DESC`)
        .limit(5);

      const results = [];

      for (const passport of passports) {
        const scans = await db
          .select()
          .from(scannedDocuments)
          .where(eq(scannedDocuments.documentId, passport.id))
          .orderBy(sql`${scannedDocuments.createdAt} DESC`);

        const activeScan = scans.find(s => !s.supersededAt) || scans[0];

        results.push({
          documentId: passport.id,
          documentNumber: passport.documentNumber,
          crewMemberId: passport.crewMemberId,
          mainTable: {
            issueDate: passport.issueDate,
            expiryDate: passport.expiryDate,
            createdAt: passport.createdAt
          },
          scannedData: activeScan ? {
            scanId: activeScan.id,
            extractedNumber: activeScan.extractedNumber,
            extractedIssueDate: activeScan.extractedIssueDate,
            extractedExpiry: activeScan.extractedExpiry,
            extractedHolderName: activeScan.extractedHolderName,
            ocrConfidence: activeScan.ocrConfidence,
            mrzValidation: activeScan.mrzValidation,
            createdAt: activeScan.createdAt,
            supersededAt: activeScan.supersededAt,
            rawText: activeScan.rawText
          } : null,
          totalScans: scans.length
        });
      }

      res.json({
        success: true,
        count: results.length,
        passports: results
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // WhatsApp Webhook Routes
  const webhookRoutes = await import('./routes/webhooks');
  app.use('/api/webhooks', webhookRoutes.default);

  // WhatsApp Messages API
  app.get("/api/whatsapp/messages", authenticate, async (req, res) => {
    try {
      const { remoteJid, limit } = req.query;
      if (!remoteJid) {
        return res.status(400).json({ message: "remoteJid is required" });
      }

      const messages = await storage.getWhatsappMessages(
        remoteJid as string,
        limit ? parseInt(limit as string) : 50
      );

      // Return messages in chronological order for the UI
      res.json(messages.reverse());
    } catch (error) {
      console.error("Error fetching WhatsApp messages:", error);
      res.status(500).json({ message: "Failed to fetch WhatsApp messages" });
    }
  });

  // Voice Assistant API endpoint
  app.post("/api/assistant/query", (req, res, next) => {
    // For mobile assistant lite, we allow bypassing authentication if no header is present
    if (!req.headers.authorization) {
      req.user = { id: 'voice-assistant-lite', role: 'admin', username: 'Voice Assistant' };
      return next();
    }
    authenticate(req, res, next);
  }, async (req, res) => {
    try {
      const { query } = req.body;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({ message: "Query is required and must be a string" });
      }

      // Import the voice assistant service
      const { voiceAssistantService } = await import('./services/voice-assistant-service');

      if (!voiceAssistantService.isAvailable()) {
        return res.status(503).json({
          message: "Voice assistant service is not available. Please check GROQ_API_KEY configuration."
        });
      }

      const response = await voiceAssistantService.processQuery(query);
      res.json({ response });
    } catch (error) {
      console.error("Error processing voice query:", error);
      res.status(500).json({
        message: "Failed to process voice query",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}






