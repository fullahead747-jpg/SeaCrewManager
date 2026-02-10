import { Router } from "express";
import { storage } from "./storage";
import { geminiOcrService } from "./geminiOcrService";
import { db } from "./db";
import { activityLogs } from "@shared/schema";

const router = Router();

// Middleware to check authentication (simplified to match routes.ts logic)
const authenticate = (req: any, res: any, next: any) => {
    if (req.user) return next();
    res.status(401).json({ message: "Authentication required" });
};

router.post("/upload", authenticate, async (req, res) => {
    try {
        const { base64Data, filename } = req.body;
        if (!base64Data) {
            return res.status(400).json({ message: "base64Data is required" });
        }

        console.log(`[ATTENDANCE] Processing upload: ${filename}`);
        const data = await geminiOcrService.extractAttendanceData(base64Data, filename);

        // Process matches
        const crewWithMatches = await Promise.all(data.crew.map(async (row) => {
            const match = await storage.findCrewMemberByNameAndRank(row.name, row.rank);
            return {
                ...row,
                matchStatus: match ? 'existing' : 'new',
                crewMemberId: match?.id || null,
                existingDetails: match ? {
                    firstName: match.firstName,
                    lastName: match.lastName,
                    rank: match.rank,
                    currentVesselId: match.currentVesselId
                } : null
            };
        }));

        res.json({ crew: crewWithMatches });
    } catch (error) {
        console.error("Attendance upload error:", error);
        res.status(500).json({ message: "Failed to process attendance sheet", error: error instanceof Error ? error.message : "Unknown error" });
    }
});

router.post("/bulk-save", authenticate, async (req, res) => {
    try {
        const { crewItems, vesselId, commonExpiryDate } = req.body;

        if (!Array.isArray(crewItems) || !vesselId) {
            return res.status(400).json({ message: "Invalid request data. crewItems and vesselId are required." });
        }

        console.log(`[ATTENDANCE] Bulk saving ${crewItems.length} items for vessel: ${vesselId}`);
        const results = [];
        const errors = [];

        for (const item of crewItems) {
            try {
                let crewMemberId = item.crewMemberId;

                if (item.matchStatus === 'new' || !crewMemberId) {
                    // Create new crew member
                    const nameParts = item.name.trim().split(/\s+/);
                    const firstName = nameParts[0] || 'Unknown';
                    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Unknown';

                    const newCrew = await storage.createCrewMember({
                        firstName,
                        lastName,
                        rank: item.rank,
                        nationality: item.nationality || 'Indian',
                        dateOfBirth: new Date('1990-01-01'), // Placeholder
                        status: 'onBoard',
                        currentVesselId: vesselId,
                        cocNotApplicable: item.cocNotApplicable || false
                    });
                    crewMemberId = newCrew.id;
                } else {
                    // Update existing crew member
                    await storage.updateCrewMember(crewMemberId, {
                        currentVesselId: vesselId,
                        status: 'onBoard'
                    });
                }

                // Create contract
                const startDate = item.joinDate ? new Date(item.joinDate) : new Date();
                const expiryDate = item.expiryDate ? new Date(item.expiryDate) : (commonExpiryDate ? new Date(commonExpiryDate) : null);

                if (!expiryDate) {
                    throw new Error(`Expiry date is required for ${item.name}`);
                }

                await storage.createContract({
                    crewMemberId,
                    vesselId,
                    startDate: isNaN(startDate.getTime()) ? new Date() : startDate,
                    endDate: isNaN(expiryDate.getTime()) ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) : expiryDate,
                    status: 'active',
                    contractType: 'SEA'
                });

                results.push({ name: item.name, status: 'success' });
            } catch (itemError) {
                console.error(`Error processing item ${item.name}:`, itemError);
                errors.push({ name: item.name, error: itemError instanceof Error ? itemError.message : "Unknown error" });
            }
        }

        // Log activity
        try {
            await db.insert(activityLogs).values({
                type: 'Crew Management',
                action: 'bulk_create',
                entityType: 'attendance',
                entityId: 'multiple',
                username: req.user?.username || 'System',
                userRole: req.user?.role || 'admin',
                description: `Bulk processed attendance for ${results.length} crew members on vessel ${vesselId}`,
                severity: errors.length > 0 ? 'warning' : 'success',
                createdAt: new Date()
            });
        } catch (logError) {
            console.error('Failed to log activity:', logError);
        }

        res.json({ success: true, results, errors });
    } catch (error) {
        console.error("Bulk save error:", error);
        res.status(500).json({ message: "Failed to save attendance data", error: error instanceof Error ? error.message : "Unknown error" });
    }
});

export default router;
