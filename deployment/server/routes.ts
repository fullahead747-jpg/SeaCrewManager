import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { 
  insertCrewMemberSchema,
  insertVesselSchema,
  insertDocumentSchema,
  insertContractSchema,
  insertCrewRotationSchema,
  insertEmailSettingsSchema,
  activityLogs
} from "@shared/schema";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { localOcrService } from "./localOcrService";
import { randomUUID } from "crypto";

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: string; username?: string };
    }
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Authentication middleware (simplified for demo)
  const authenticate = (req: any, res: any, next: any) => {
    // In a real app, you'd verify JWT tokens here
    // For demo, we'll just check for a basic auth header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    // Mock authentication - in real app, decode JWT and get user
    const mockUserId = req.headers['x-user-id'] || 'admin-id';
    const mockRole = req.headers['x-user-role'] || 'admin';
    const mockUsername = req.headers['x-username'] || 'admin';
    req.user = { id: mockUserId, role: mockRole, username: mockUsername };
    next();
  };

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

  app.put("/api/vessels/:id", authenticate, async (req, res) => {
    try {
      const updateVesselSchema = insertVesselSchema.omit({ id: true });
      const vesselData = updateVesselSchema.parse(req.body);
      
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
      // Convert dateOfBirth string to Date object before validation
      const requestBody = {
        ...req.body,
        dateOfBirth: new Date(req.body.dateOfBirth)
      };
      
      const crewData = insertCrewMemberSchema.parse(requestBody);
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
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid crew data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create crew member" });
      }
    }
  });

  app.put("/api/crew/:id", authenticate, async (req, res) => {
    try {
      const updates = insertCrewMemberSchema.partial().parse(req.body);
      const crewMember = await storage.updateCrewMember(req.params.id, updates);
      
      if (!crewMember) {
        return res.status(404).json({ message: "Crew member not found" });
      }
      
      res.json(crewMember);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid update data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update crew member" });
      }
    }
  });

  app.delete("/api/crew/:id", authenticate, async (req, res) => {
    try {
      // Get crew member details before deletion for logging
      const crewMember = await storage.getCrewMember(req.params.id);
      
      const deleted = await storage.deleteCrewMember(req.params.id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Crew member not found" });
      }
      
      // Log crew deletion activity
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
      const document = await storage.createDocument(documentData);
      res.json(document);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid document data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create document" });
      }
    }
  });

  app.put("/api/documents/:id", authenticate, async (req, res) => {
    try {
      const updates = insertDocumentSchema.partial().parse(req.body);
      const document = await storage.updateDocument(req.params.id, updates);
      
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
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

  app.delete("/api/documents/:id", authenticate, async (req, res) => {
    try {
      const success = await storage.deleteDocument(req.params.id);
      
      if (!success) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      res.json({ message: "Document deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete document" });
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
      const contractData = insertContractSchema.parse(req.body);
      const contract = await storage.createContract(contractData);
      res.json(contract);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid contract data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create contract" });
      }
    }
  });

  // Crew rotation routes
  app.get("/api/rotations", authenticate, async (req, res) => {
    try {
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
      const success = await storage.deleteCrewRotation(id);
      if (!success) {
        return res.status(404).json({ message: "Rotation not found" });
      }
      res.json({ message: "Rotation deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete rotation" });
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

  // Dashboard stats
  app.get("/api/dashboard/stats", authenticate, async (req, res) => {
    try {
      const crewMembers = await storage.getCrewMembers();
      const vessels = await storage.getVessels();
      const expiringAlerts = await storage.getExpiringDocuments(30);
      const contracts = await storage.getContracts();
      
      const activeCrew = crewMembers.filter(member => member.status === 'active').length;
      const activeVessels = vessels.filter(vessel => vessel.status === 'active').length;
      const pendingActions = expiringAlerts.length;
      
      // Calculate compliance rate (documents not expiring soon)
      const allDocuments = await storage.getDocuments();
      const validDocuments = allDocuments.filter(doc => doc.status === 'valid').length;
      const complianceRate = allDocuments.length > 0 ? (validDocuments / allDocuments.length) * 100 : 100;
      
      res.json({
        activeCrew,
        activeVessels,
        pendingActions,
        complianceRate: Math.round(complianceRate * 10) / 10,
        totalContracts: contracts.length,
        totalDocuments: allDocuments.length
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
            id: `contract-${contract.id}`,
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
            id: `document-${document.id}`,
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
              id: `join-${rotation.id}`,
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
              id: `leave-${rotation.id}`,
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
              id: `maintenance-${vessel.id}`,
              type: 'maintenance_completion',
              title: 'Maintenance Completion',
              description: `${vessel.name} maintenance scheduled to complete (${daysUntil} days)`,
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

  // Mock email sending endpoint
  app.post("/api/email/send-test", authenticate, async (req, res) => {
    try {
      // In a real app, this would integrate with SendGrid, AWS SES, etc.
      console.log("Sending test email...");
      
      // Simulate email sending delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      res.json({ message: "Test email sent successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to send test email" });
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
      console.log(`Sending message to crew member ${crewMember.firstName} ${crewMember.lastName}:`);
      console.log(`Subject: ${subject}`);
      console.log(`Message: ${message}`);
      
      // Simulate email sending delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      res.json({ 
        message: "Message sent successfully",
        recipient: `${crewMember.firstName} ${crewMember.lastName}`,
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

  // OCR route for extracting crew data from documents
  app.post("/api/ocr/extract-crew-data", authenticate, async (req, res) => {
    try {
      console.log('OCR request received from user:', req.user?.username);
      const { image, filename } = req.body;
      
      if (!image) {
        console.log('No image data provided in request');
        return res.status(400).json({ message: "Image data is required" });
      }

      console.log('Processing OCR request for file:', filename);
      const extractedData = await localOcrService.extractCrewDataFromDocument(image, filename);
      
      // Log the OCR activity
      try {
        await db.insert(activityLogs).values({
          type: "Document Processing",
          action: "ocr_document_scan",
          entityType: "document",
          description: `Scanned crew document: ${filename || 'Unknown file'}`,
          severity: "info",
          username: req.user?.username || "unknown",  
          userRole: req.user?.role || "unknown",
          metadata: JSON.stringify({ filename, extractedFields: Object.keys(extractedData).length })
        });
      } catch (logError) {
        console.error("Failed to log OCR activity:", logError);
      }

      res.json(extractedData);
    } catch (error) {
      console.error("OCR extraction error:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Failed to extract data from document" 
      });
    }
  });

  // File upload simulation
  app.post("/api/upload", authenticate, async (req, res) => {
    try {
      // In a real app, this would handle file uploads to AWS S3, etc.
      const { filename, fileType } = req.body;
      
      // Simulate file processing delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const mockFilePath = `/uploads/${Date.now()}-${filename}`;
      
      res.json({ 
        message: "File uploaded successfully",
        filePath: mockFilePath 
      });
    } catch (error) {
      res.status(500).json({ message: "File upload failed" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
