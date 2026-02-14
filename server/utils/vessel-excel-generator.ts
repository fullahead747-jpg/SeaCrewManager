import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { IStorage } from '../storage';

export async function generateVesselExcelBuffer(vesselId: string, storage: IStorage): Promise<{ buffer: Buffer; fileName: string; vesselName: string }> {
    try {
        const vessel = await storage.getVessel(vesselId);
        if (!vessel) {
            throw new Error('Vessel not found');
        }

        const crewMembers = await storage.getCrewMembersByVessel(vesselId);
        const allDocuments = await storage.getDocuments();

        // Helper to get document details
        const getDocumentDetails = (crewMemberId: string, docType: string) => {
            const doc = allDocuments.find(d => d.crewMemberId === crewMemberId && d.type?.toLowerCase() === docType.toLowerCase());
            return {
                no: doc?.documentNumber || '---',
                expiry: doc?.expiryDate ? format(new Date(doc.expiryDate), 'dd-MM-yyyy') : '---'
            };
        };

        // Process crew data
        const crewData = crewMembers.map(member => {
            const activeContract = member.activeContract;
            let contractNo = activeContract?.contractNumber || '---';
            let contractType = activeContract?.contractType || '---';
            let contractEndDate = '---';
            let daysRemaining = '---';

            if (activeContract?.endDate) {
                contractEndDate = format(new Date(activeContract.endDate), 'dd-MM-yyyy');
                const today = new Date();
                const endDate = new Date(activeContract.endDate);
                const diffTime = endDate.getTime() - today.getTime();
                daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24)).toString();
            }

            const passport = getDocumentDetails(member.id, 'passport');
            const cdc = getDocumentDetails(member.id, 'cdc');
            const coc = getDocumentDetails(member.id, 'coc');
            const medical = getDocumentDetails(member.id, 'medical');

            // Next of Kin formatting
            let nok = '---';
            if (member.emergencyContact) {
                const contact = member.emergencyContact as any;
                nok = `${contact.name || ''} ${contact.relationship ? `(${contact.relationship})` : ''} ${contact.phone ? `- ${contact.phone}` : ''}`.trim() || '---';
            }

            return {
                'Full Name': `${member.firstName} ${member.lastName}`.toUpperCase(),
                'Rank': member.rank || '---',
                'Nationality': member.nationality || '---',
                'DOB': member.dateOfBirth ? format(new Date(member.dateOfBirth), 'dd-MM-yyyy') : '---',
                'Passport No': passport.no,
                'Passport Expiry': passport.expiry,
                'CDC No': cdc.no,
                'CDC Expiry': cdc.expiry,
                'COC No': coc.no,
                'COC Expiry': coc.expiry,
                'Medical No': medical.no,
                'Medical Expiry': medical.expiry,
                'Status': member.status === 'onBoard' ? 'ON BOARD' : 'ON SHORE',
                'Contract No': contractNo,
                'Contract End': contractEndDate,
                'Days Left': daysRemaining,
                'Next of Kin': nok,
                'Email': member.email || '---',
                'Phone': member.phoneNumber || '---'
            };
        });

        const workbook = XLSX.utils.book_new();

        // Summary data for first sheet
        const summaryData = [
            { 'Field': 'OFFING VESSEL CREW REPORT', 'Value': '' },
            { 'Field': 'Generated On', 'Value': format(new Date(), 'dd-MM-yyyy HH:mm') },
            { 'Field': '', 'Value': '' },
            { 'Field': 'VESSEL DETAILS', 'Value': '' },
            { 'Field': 'Vessel Name', 'Value': vessel.name },
            { 'Field': 'IMO Number', 'Value': vessel.imoNumber || '---' },
            { 'Field': 'Flag', 'Value': vessel.flag || '---' },
            { 'Field': '', 'Value': '' },
            { 'Field': 'CREW SUMMARY', 'Value': '' },
            { 'Field': 'Total Crew Count', 'Value': crewMembers.length },
            { 'Field': 'On Board', 'Value': crewMembers.filter(m => m.status === 'onBoard').length },
            { 'Field': 'On Shore', 'Value': crewMembers.filter(m => m.status === 'onShore').length }
        ];

        const summarySheet = XLSX.utils.json_to_sheet(summaryData, { skipHeader: true });
        summarySheet['!cols'] = [{ wch: 20 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Report Summary');

        const crewSheet = XLSX.utils.json_to_sheet(crewData);

        // Set column widths for crew sheet
        crewSheet['!cols'] = [
            { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 12 },
            { wch: 18 }, { wch: 15 }, { wch: 18 }, { wch: 15 },
            { wch: 18 }, { wch: 15 }, { wch: 18 }, { wch: 15 },
            { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 10 },
            { wch: 35 }, { wch: 25 }, { wch: 15 }
        ];

        XLSX.utils.book_append_sheet(workbook, crewSheet, 'Crew Details');

        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
        const fileName = `${vessel.name.replace(/\s+/g, '_')}_CrewReport_${format(new Date(), 'ddMMyyyy')}.xlsx`;

        return { buffer: excelBuffer, fileName, vesselName: vessel.name };
    } catch (error) {
        console.error('Excel generation error:', error);
        throw error;
    }
}
