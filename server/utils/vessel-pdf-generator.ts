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
                doc.text('Flag:', 300, startY + 12);
                doc.text('Total Crew:', 300, startY + 28);
                doc.text('On Board:', 550, startY + 12);
                doc.text('On Shore:', 550, startY + 28);

                doc.font('Helvetica');
                doc.text(vessel.imoNumber || 'N/A', 130, startY + 12);
                doc.text(vessel.type || 'N/A', 130, startY + 28);
                doc.text(vessel.flag || 'N/A', 360, startY + 12);
                doc.text(String(crewMembers.length), 360, startY + 28);
                doc.text(String(crewMembers.filter(m => m.status === 'onBoard').length), 610, startY + 12);
                doc.text(String(crewMembers.filter(m => m.status === 'onShore').length), 610, startY + 28);

                doc.y = startY + 70;

                // Table Definition
                if (crewMembers.length === 0) {
                    doc.moveDown(2);
                    doc.fontSize(14).fillColor('#64748b').font('Helvetica-Oblique').text('No crew members assigned to this vessel.', { align: 'center' });
                } else {
                    const colWidths = [140, 90, 80, 100, 100, 100, 100];
                    const headers = ['Full Name', 'Rank', 'Nationality', 'Passport No', 'Contract Status', 'Start Date', 'End Date'];

                    const drawRow = (y: number, row: string[], isHeader = false) => {
                        let x = 40;
                        doc.fillColor(isHeader ? '#ffffff' : '#334155');
                        doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);

                        if (isHeader) {
                            doc.rect(x, y - 5, colWidths.reduce((a, b) => a + b, 0), 22).fill('#1e293b');
                            doc.fillColor('#ffffff');
                        }

                        row.forEach((cell, i) => {
                            // Truncate logic if needed
                            doc.text(cell, x + 5, y, { width: colWidths[i] - 10, lineBreak: false });
                            x += colWidths[i];
                        });
                    };

                    let currentY = doc.y;
                    drawRow(currentY, headers, true);
                    currentY += 25;

                    crewMembers.forEach((member, i) => {
                        if (currentY > doc.page.height - 80) {
                            doc.addPage();
                            currentY = 40;
                            drawRow(currentY, headers, true);
                            currentY += 25;
                        }

                        if (i % 2 === 0) {
                            doc.rect(40, currentY - 5, colWidths.reduce((a, b) => a + b, 0), 22).fill('#f1f5f9');
                        }

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

                        drawRow(currentY, [name, rank, nationality, passportNo, contractStatus, startDate, endDate]);
                        currentY += 22;
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

export async function generateFleetPDFBuffer(storage: IStorage): Promise<{ buffer: Buffer; fileName: string }> {
    try {
        const vessels = await storage.getVessels();
        const crewMembers = await storage.getCrewMembers();

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

                    if (index > 0 && doc.y > doc.page.height - 150) {
                        doc.addPage();
                    }

                    doc.moveDown(1);
                    doc.fillColor('#0f172a').fontSize(16).font('Helvetica-Bold').text(`Vessel: ${vessel.name}`, 40, doc.y);
                    doc.fillColor('#64748b').fontSize(10).font('Helvetica').text(`Type: ${vessel.type || 'N/A'}  |  IMO: ${vessel.imoNumber || 'N/A'}  |  Crew Count: ${crew.length}`, 40, doc.y);
                    doc.moveDown(0.5);

                    if (crew.length === 0) {
                        doc.fillColor('#94a3b8').fontSize(10).font('Helvetica-Oblique').text('No crew currently assigned.', 40, doc.y);
                    } else {
                        const colWidths = [180, 120, 100, 120, 120];
                        const headers = ['Crew Name', 'Rank', 'Status', 'Contract Start', 'Contract End'];

                        const drawFleetRow = (y: number, row: string[], isHeader = false) => {
                            let x = 40;
                            doc.fillColor(isHeader ? '#ffffff' : '#334155');
                            doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);

                            if (isHeader) {
                                doc.rect(x, y - 5, colWidths.reduce((a, b) => a + b, 0), 20).fill('#334155');
                                doc.fillColor('#ffffff');
                            }

                            row.forEach((cell, i) => {
                                doc.text(cell, x + 5, y, { width: colWidths[i] - 10, lineBreak: false });
                                x += colWidths[i];
                            });
                        };

                        let currentY = doc.y;
                        drawFleetRow(currentY, headers, true);
                        currentY += 22;

                        crew.forEach((member, i) => {
                            if (currentY > doc.page.height - 80) {
                                doc.addPage();
                                currentY = 40;
                                drawFleetRow(currentY, headers, true);
                                currentY += 22;
                            }

                            if (i % 2 === 0) {
                                doc.rect(40, currentY - 4, colWidths.reduce((a, b) => a + b, 0), 18).fill('#f8fafc');
                            }

                            const name = `${member.firstName} ${member.lastName}`.toUpperCase();
                            const rank = member.rank || 'N/A';
                            const status = member.status === 'onBoard' ? 'ON BOARD' : 'ON SHORE';

                            let start = 'N/A', end = 'N/A';
                            if (member.activeContract) {
                                if (member.activeContract.startDate) start = format(new Date(member.activeContract.startDate), 'MMM dd, yyyy');
                                if (member.activeContract.endDate) end = format(new Date(member.activeContract.endDate), 'MMM dd, yyyy');
                            }

                            drawFleetRow(currentY, [name, rank, status, start, end]);
                            currentY += 18;
                        });
                        doc.y = currentY + 10;
                    }
                });

                // Unassigned Crew
                if (unassignedCrew.length > 0) {
                    if (doc.y > doc.page.height - 150) doc.addPage();
                    doc.moveDown(1.5);
                    doc.fillColor('#b91c1c').fontSize(16).font('Helvetica-Bold').text('Unassigned Crew Members', 40, doc.y);
                    doc.fillColor('#64748b').fontSize(10).font('Helvetica').text(`Count: ${unassignedCrew.length}`, 40, doc.y);
                    doc.moveDown(0.5);

                    const colWidths = [200, 150, 150];
                    const headers = ['Crew Name', 'Rank', 'Status'];

                    let currentY = doc.y;

                    doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff');
                    doc.rect(40, currentY - 5, 500, 20).fill('#b91c1c');
                    doc.fillColor('#ffffff');
                    doc.text(headers[0], 45, currentY);
                    doc.text(headers[1], 245, currentY);
                    doc.text(headers[2], 395, currentY);
                    currentY += 22;

                    unassignedCrew.forEach((member, i) => {
                        if (currentY > doc.page.height - 80) {
                            doc.addPage();
                            currentY = 40;
                        }

                        if (i % 2 === 0) {
                            doc.rect(40, currentY - 4, 500, 18).fill('#fef2f2');
                        }

                        doc.fillColor('#334155').font('Helvetica');
                        const name = `${member.firstName} ${member.lastName}`.toUpperCase();
                        const rank = member.rank || 'N/A';
                        const status = member.status === 'onBoard' ? 'ON BOARD' : 'ON SHORE';

                        doc.text(name, 45, currentY);
                        doc.text(rank, 245, currentY);
                        doc.text(status, 395, currentY);
                        currentY += 18;
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
