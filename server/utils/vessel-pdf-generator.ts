import PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import { IStorage } from '../storage';

export async function generateVesselPDFBuffer(vesselId: string, storage: IStorage): Promise<{ buffer: Buffer; fileName: string; vesselName: string }> {
    try {
        const vessel = await storage.getVessel(vesselId);
        if (!vessel) throw new Error('Vessel not found');

        const crewMembers = await storage.getCrewMembersByVessel(vesselId);
        const allDocuments = await storage.getDocuments();

        return new Promise((resolve, reject) => {
            try {
                // Use landscape for more columns
                const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
                const chunks: Buffer[] = [];

                doc.on('data', (chunk) => chunks.push(chunk));
                doc.on('end', () => {
                    const pdfBuffer = Buffer.concat(chunks);
                    const fileName = `${vessel.name.replace(/\s+/g, '_')}_CrewReport_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
                    resolve({ buffer: pdfBuffer, fileName, vesselName: vessel.name });
                });
                doc.on('error', reject);

                // Build Header
                doc.fillColor('#0f172a').fontSize(22).font('Helvetica-Bold').text(`Crew Report: ${vessel.name}`, { align: 'center' });
                doc.moveDown(0.2);
                doc.fillColor('#64748b').fontSize(12).font('Helvetica').text(`Generated on ${format(new Date(), 'MMMM dd, yyyy HH:mm')}`, { align: 'center' });

                doc.moveDown(1.5);

                // Vessel Details Box
                const startY = doc.y;
                doc.rect(40, startY, doc.page.width - 80, 50).fill('#f8fafc');
                doc.rect(40, startY, doc.page.width - 80, 50).stroke('#e2e8f0');

                doc.fillColor('#334155').fontSize(10).font('Helvetica-Bold');
                doc.text('IMO Number:', 55, startY + 12);
                doc.text('Vessel Type:', 55, startY + 28);
                doc.text('Flag:', 380, startY + 12);
                doc.text('Total Crew:', 380, startY + 28);
                doc.text('On Board:', 600, startY + 12);
                doc.text('On Shore:', 600, startY + 28);

                doc.font('Helvetica');
                doc.text(vessel.imoNumber || 'N/A', 130, startY + 12);
                doc.text(vessel.type || 'N/A', 130, startY + 28, { width: 230, height: 12, lineBreak: false });
                doc.text(vessel.flag || 'N/A', 450, startY + 12);
                doc.text(String(crewMembers.length), 450, startY + 28);
                doc.text(String(crewMembers.filter(m => m.status === 'onBoard').length), 670, startY + 12);
                doc.text(String(crewMembers.filter(m => m.status === 'onShore').length), 670, startY + 28);

                doc.y = startY + 60;
                doc.fillColor('#334155').fontSize(9).font('Helvetica-Bold').text('Compliance Status: ', 40, doc.y, { continued: true })
                   .fillColor('#ef4444').font('Helvetica-Oblique').text('Overdue (Expired)', { continued: true })
                   .fillColor('#94a3b8').font('Helvetica').text(' | ', { continued: true })
                   .fillColor('#f97316').font('Helvetica-Oblique').text('Critical (<= 15 Days)', { continued: true })
                   .fillColor('#94a3b8').font('Helvetica').text(' | ', { continued: true })
                   .fillColor('#ca8a04').font('Helvetica-Oblique').text('Upcoming (16-30 Days)', { continued: true })
                   .fillColor('#94a3b8').font('Helvetica').text(' | ', { continued: true })
                   .fillColor('#3b82f6').font('Helvetica-Oblique').text('Attention (31-45 Days)', { continued: true })
                   .fillColor('#94a3b8').font('Helvetica').text(' | ', { continued: true })
                   .fillColor('#10b981').font('Helvetica-Oblique').text('Not Due (> 45 Days)');

                let currentY = doc.y + 20;

                // Table Definition
                if (crewMembers.length === 0) {
                    doc.moveDown(2);
                    doc.fontSize(14).fillColor('#64748b').font('Helvetica-Oblique').text('No crew members assigned to this vessel.', { align: 'center' });
                } else {
                    const colWidths = [40, 120, 80, 100, 75, 85, 95, 75, 75];
                    const headers = ['Sr. No.', 'Full Name', 'Rank', 'Compliance Status', 'Nationality', 'Passport No', 'Contract Status', 'Start Date', 'End Date'];

                    const complianceColors: Record<string, string> = {
                        'Overdue':   '#ef4444', // red-500
                        'Critical':  '#f97316', // orange-500
                        'Upcoming':  '#ca8a04', // yellow-700
                        'Attention': '#3b82f6', // blue-500
                        'Not Due':   '#10b981', // emerald-500
                    };

                    const getRowHeight = (row: string[], isHeader = false) => {
                        doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
                        let maxHeight = 0;
                        row.forEach((cell, i) => {
                            const height = doc.heightOfString(cell, { width: colWidths[i] - 10 });
                            if (height > maxHeight) maxHeight = height;
                        });
                        return Math.max(maxHeight + 8, 22); // Minimum height padding
                    };

                    const drawRow = (y: number, row: string[], rowHeight: number, isHeader = false, cellColors: (string | null)[] = []) => {
                        let x = 40;
                        doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);

                        if (isHeader) {
                            doc.rect(x, y - 5, colWidths.reduce((a, b) => a + b, 0), rowHeight).fill('#1e293b');
                        }

                        row.forEach((cell, i) => {
                            const color = isHeader ? '#ffffff' : (cellColors[i] ?? '#334155');
                            doc.fillColor(color).text(cell, x + 5, y, { width: colWidths[i] - 10 });
                            x += colWidths[i];
                        });
                    };

                    let headerHeight = getRowHeight(headers, true);
                    drawRow(currentY, headers, headerHeight, true);
                    currentY += headerHeight;

                    crewMembers.forEach((member, i) => {
                        const passportDoc = allDocuments.find(d => d.crewMemberId === member.id && d.type === 'passport');
                        const passportNo = passportDoc?.documentNumber || 'N/A';

                        let contractStatus = 'N/A';
                        let startDate = 'N/A';
                        let endDate = 'N/A';

                        if (member.activeContract) {
                            contractStatus = member.activeContract.status.toUpperCase();
                            if (member.activeContract.startDate) startDate = format(new Date(member.activeContract.startDate), 'MMM dd, yyyy');
                            if (member.activeContract.endDate) endDate = format(new Date(member.activeContract.endDate), 'MMM dd, yyyy');
                        }

                        const name = `${member.firstName} ${member.lastName}`.toUpperCase();
                        const rank = member.rank || 'N/A';
                        const nationality = member.nationality || 'N/A';

                        const compliance = getComplianceStatus(member, allDocuments);
                        const complianceColor = complianceColors[compliance] ?? '#334155';

                        const rowData = [String(i + 1), name, rank, compliance, nationality, passportNo, contractStatus, startDate, endDate];
                        const rowHeight = getRowHeight(rowData, false);

                        if (currentY + rowHeight > doc.page.height - 80) {
                            doc.addPage();
                            currentY = 40;
                            drawRow(currentY, headers, headerHeight, true);
                            currentY += headerHeight;
                        }

                        if (i % 2 === 0) {
                            doc.rect(40, currentY - 5, colWidths.reduce((a, b) => a + b, 0), rowHeight).fill('#f1f5f9');
                        }

                        drawRow(currentY, rowData, rowHeight, false, [null, null, null, complianceColor, null, null, null, null, null]);
                        currentY += rowHeight;
                    });
                }

                doc.end();
            } catch (err) {
                reject(err);
            }
        });

    } catch (error) {
        console.error('PDF generation error:', error);
        throw error;
    }
}

// Helper: derive worst-case document compliance status for a crew member
function getComplianceStatus(crewMember: any, allDocs: any[]): string {
    const now = new Date();
    const memberDocs = allDocs.filter(d => d.crewMemberId === crewMember.id && d.expiryDate);
    
    let worst = 0; // 0=Not Due, 1=Attention, 2=Upcoming, 3=Critical, 4=Overdue

    // Evaluate explicit documents
    for (const doc of memberDocs) {
        const expiry = new Date(doc.expiryDate);
        if (expiry.getFullYear() < 2000) continue;
        const days = Math.ceil((expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        let level = 0;
        if (days < 0)        level = 4; // Overdue
        else if (days <= 15) level = 3; // Critical
        else if (days <= 30) level = 2; // Upcoming
        else if (days <= 45) level = 1; // Attention
        if (level > worst) worst = level;
    }

    // Evaluate Contract (inherits AOA logic from dashboard)
    if (crewMember.activeContract && crewMember.activeContract.endDate) {
        const expiry = new Date(crewMember.activeContract.endDate);
        if (expiry.getFullYear() >= 2000) {
            const days = Math.ceil((expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
            let level = 0;
            if (days < 0)        level = 4; // Overdue
            else if (days <= 15) level = 3; // Critical
            else if (days <= 30) level = 2; // Upcoming
            else if (days <= 45) level = 1; // Attention
            if (level > worst) worst = level;
        }
    }

    return ['Not Due', 'Attention', 'Upcoming', 'Critical', 'Overdue'][worst];
}

export async function generateFleetPDFBuffer(storage: IStorage): Promise<{ buffer: Buffer; fileName: string }> {
    try {
        const vessels = await storage.getVessels();
        const crewMembers = await storage.getCrewMembers();
        const allDocuments = await storage.getDocuments();

        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
                const chunks: Buffer[] = [];

                doc.on('data', (chunk) => chunks.push(chunk));
                doc.on('end', () => {
                    const pdfBuffer = Buffer.concat(chunks);
                    const fileName = `Fleet_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
                    resolve({ buffer: pdfBuffer, fileName });
                });
                doc.on('error', reject);

                // Fleet Header
                doc.fillColor('#0f172a').fontSize(24).font('Helvetica-Bold').text('Complete Fleet Report', { align: 'center' });
                doc.moveDown(0.2);
                doc.fillColor('#64748b').fontSize(12).font('Helvetica').text(`Generated on ${format(new Date(), 'MMMM dd, yyyy')}`, { align: 'center' });

                doc.moveDown(2);

                // Fleet Stats Summary Box
                const totalCrew = crewMembers.length;
                const onBoard = crewMembers.filter(m => m.status === 'onBoard').length;
                const onShore = crewMembers.filter(m => m.status === 'onShore').length;

                const statsY = doc.y;
                doc.rect(40, statsY, doc.page.width - 80, 50).fillAndStroke('#e0e7ff', '#818cf8');

                doc.fillColor('#1e40af').fontSize(11).font('Helvetica-Bold');
                doc.text(`Total Active Vessels: ${vessels.length}`, 60, statsY + 18);
                doc.text(`Total Fleet Crew: ${totalCrew}`, 260, statsY + 18);
                doc.text(`Crew On Board: ${onBoard}`, 460, statsY + 18);
                doc.text(`Crew On Shore: ${onShore}`, 660, statsY + 18);

                doc.y = statsY + 80;

                // Group Crew by Vessel
                const vesselGroups: { [key: string]: any[] } = {};
                const unassignedCrew: any[] = [];
                vessels.forEach(v => { vesselGroups[v.id] = []; });

                crewMembers.forEach(member => {
                    if (member.currentVesselId && vesselGroups[member.currentVesselId]) {
                        vesselGroups[member.currentVesselId].push(member);
                    } else {
                        unassignedCrew.push(member);
                    }
                });

                // Iterate through vessels
                vessels.forEach((vessel, index) => {
                    const crew = vesselGroups[vessel.id];

                    if (index > 0) {
                        doc.addPage();
                    }

                    doc.moveDown(1);
                    doc.fillColor('#0f172a').fontSize(16).font('Helvetica-Bold').text(`Vessel: ${vessel.name}`, 40, doc.y);
                    doc.fillColor('#64748b').fontSize(10).font('Helvetica').text(`Type: ${vessel.type || 'N/A'}  |  IMO: ${vessel.imoNumber || 'N/A'}  |  Crew Count: ${crew.length}`, 40, doc.y);
                    doc.moveDown(0.3);
                    doc.fillColor('#334155').fontSize(9).font('Helvetica-Bold').text('Compliance Status: ', 40, doc.y, { continued: true })
                       .fillColor('#ef4444').font('Helvetica-Oblique').text('Overdue (Expired)', { continued: true })
                       .fillColor('#94a3b8').font('Helvetica').text(' | ', { continued: true })
                       .fillColor('#f97316').font('Helvetica-Oblique').text('Critical (<= 15 Days)', { continued: true })
                       .fillColor('#94a3b8').font('Helvetica').text(' | ', { continued: true })
                       .fillColor('#ca8a04').font('Helvetica-Oblique').text('Upcoming (16-30 Days)', { continued: true })
                       .fillColor('#94a3b8').font('Helvetica').text(' | ', { continued: true })
                       .fillColor('#3b82f6').font('Helvetica-Oblique').text('Attention (31-45 Days)', { continued: true })
                       .fillColor('#94a3b8').font('Helvetica').text(' | ', { continued: true })
                       .fillColor('#10b981').font('Helvetica-Oblique').text('Not Due (> 45 Days)');
                    
                    doc.y = doc.y + 15; // Dynamic spacing

                    if (crew.length === 0) {
                        doc.fillColor('#94a3b8').fontSize(10).font('Helvetica-Oblique').text('No crew currently assigned.', 40, doc.y);
                    } else {
                        const colWidths = [45, 135, 100, 85, 110, 105, 105];
                        const headers = ['Sr. No.', 'Crew Name', 'Rank', 'Status', 'Compliance Status', 'Contract Start', 'Contract End'];

                        // Dashboard-matching colors for each compliance status
                        const complianceColors: Record<string, string> = {
                            'Overdue':   '#ef4444', // red-500
                            'Critical':  '#f97316', // orange-500
                            'Upcoming':  '#ca8a04', // yellow-700 (darker for readability on white)
                            'Attention': '#3b82f6', // blue-500
                            'Not Due':   '#10b981', // emerald-500
                        };

                        const getFleetRowHeight = (row: string[], isHeader = false) => {
                            doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
                            let maxHeight = 0;
                            row.forEach((cell, i) => {
                                const height = doc.heightOfString(cell, { width: colWidths[i] - 10 });
                                if (height > maxHeight) maxHeight = height;
                            });
                            return Math.max(maxHeight + 8, 20); // Minimum height
                        };

                        // cellColors: optional per-cell color overrides (null = use row default)
                        const drawFleetRow = (y: number, row: string[], rowHeight: number, isHeader = false, cellColors: (string | null)[] = []) => {
                            let x = 40;
                            doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);

                            if (isHeader) {
                                doc.rect(x, y - 5, colWidths.reduce((a, b) => a + b, 0), rowHeight).fill('#334155');
                            }

                            row.forEach((cell, i) => {
                                const color = isHeader ? '#ffffff' : (cellColors[i] ?? '#334155');
                                doc.fillColor(color).text(cell, x + 5, y, { width: colWidths[i] - 10 });
                                x += colWidths[i];
                            });
                        };

                        let currentY = doc.y;
                        let headerHeight = getFleetRowHeight(headers, true);
                        drawFleetRow(currentY, headers, headerHeight, true);
                        currentY += headerHeight;

                        crew.forEach((member, i) => {
                            const name = `${member.firstName} ${member.lastName}`.toUpperCase();
                            const rank = member.rank || 'N/A';
                            const status = member.status === 'onBoard' ? 'ON BOARD' : 'ON SHORE';
                            const compliance = getComplianceStatus(member, allDocuments);
                            const complianceColor = complianceColors[compliance] ?? '#334155';

                            let start = 'N/A', end = 'N/A';
                            if (member.activeContract) {
                                if (member.activeContract.startDate) start = format(new Date(member.activeContract.startDate), 'MMM dd, yyyy');
                                if (member.activeContract.endDate) end = format(new Date(member.activeContract.endDate), 'MMM dd, yyyy');
                            }

                            const rowData = [String(i + 1), name, rank, status, compliance, start, end];
                            const rowHeight = getFleetRowHeight(rowData, false);

                            if (currentY + rowHeight > doc.page.height - 80) {
                                doc.addPage();
                                currentY = 40;
                                drawFleetRow(currentY, headers, headerHeight, true);
                                currentY += headerHeight;
                            }

                            if (i % 2 === 0) {
                                doc.rect(40, currentY - 4, colWidths.reduce((a, b) => a + b, 0), rowHeight - 2).fill('#f8fafc');
                            }

                            // cellColors: null for default, color string for compliance column (index 4)
                            drawFleetRow(currentY, rowData, rowHeight, false, [null, null, null, null, complianceColor, null, null]);
                            currentY += rowHeight;
                        });
                        doc.y = currentY + 10;
                    }
                });

                // Unassigned Crew
                if (unassignedCrew.length > 0) {
                    doc.addPage();
                    doc.moveDown(1.5);
                    doc.fillColor('#b91c1c').fontSize(16).font('Helvetica-Bold').text('Unassigned Crew Members', 40, doc.y);
                    doc.fillColor('#64748b').fontSize(10).font('Helvetica').text(`Count: ${unassignedCrew.length}`, 40, doc.y);
                    doc.moveDown(0.5);

                    const colWidths = [45, 150, 110, 100, 115, 120];
                    const headers = ['Sr. No.', 'Crew Name', 'Rank', 'Status', 'Sign Off Date', 'Contact Number'];

                    const getUnassignedRowHeight = (row: string[], isHeader = false) => {
                        doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
                        let maxHeight = 0;
                        row.forEach((cell, i) => {
                            const height = doc.heightOfString(cell || 'N/A', { width: colWidths[i] - 10 });
                            if (height > maxHeight) maxHeight = height;
                        });
                        return Math.max(maxHeight + 8, 20); // Minimum height
                    };

                    const drawUnassignedRow = (y: number, row: string[], rowHeight: number, isHeader = false) => {
                        let x = 40;
                        doc.fillColor(isHeader ? '#ffffff' : '#334155');
                        doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);

                        if (isHeader) {
                            doc.rect(x, y - 5, colWidths.reduce((a, b) => a + b, 0), rowHeight).fill('#b91c1c');
                            doc.fillColor('#ffffff');
                        }

                        row.forEach((cell, i) => {
                            doc.text(cell || 'N/A', x + 5, y, { width: colWidths[i] - 10 });
                            x += colWidths[i];
                        });
                    };

                    let currentY = doc.y;
                    let headerHeight = getUnassignedRowHeight(headers, true);
                    drawUnassignedRow(currentY, headers, headerHeight, true);
                    currentY += headerHeight;

                    unassignedCrew.forEach((member, i) => {
                        const name = `${member.firstName} ${member.lastName}`.toUpperCase();
                        const rank = member.rank || 'N/A';
                        const status = member.status === 'onBoard' ? 'ON BOARD' : 'ON SHORE';
                        const signOffDate = member.signOffDate ? format(new Date(member.signOffDate), 'MMM dd, yyyy') : 'N/A';
                        const contact = member.phoneNumber || 'N/A';

                        const rowData = [String(i + 1), name, rank, status, signOffDate, contact];
                        const rowHeight = getUnassignedRowHeight(rowData, false);

                        if (currentY + rowHeight > doc.page.height - 80) {
                            doc.addPage();
                            currentY = 40;
                            drawUnassignedRow(currentY, headers, headerHeight, true);
                            currentY += headerHeight;
                        }

                        if (i % 2 === 0) {
                            doc.rect(40, currentY - 4, colWidths.reduce((a, b) => a + b, 0), rowHeight - 2).fill('#fef2f2');
                        }

                        drawUnassignedRow(currentY, rowData, rowHeight);
                        currentY += rowHeight;
                    });
                }

                doc.end();
            } catch (err) {
                reject(err);
            }
        });

    } catch (error) {
        console.error('Fleet PDF generation error:', error);
        throw error;
    }
}
