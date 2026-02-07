import PDFDocument from 'pdfkit';

interface ContractEvent {
  id: string;
  type: 'contract_due' | 'contract_expired';
  date: Date;
  crewMemberId: string;
  crewMemberName: string;
  vesselId: string;
  vesselName: string;
  contractId: string;
  contractEndDate: Date;
  daysUntilExpiry: number;
}

export class PDFGeneratorService {
  async generateCalendarPDF(month: string, events: ContractEvent[]): Promise<Buffer> {
    console.log(`📄 Generating PDF for ${month} with ${events.length} events...`);

    const dueEvents = events.filter(e => e.type === 'contract_due');
    const expiredEvents = events.filter(e => e.type === 'contract_expired');

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(chunks);
          console.log(`✅ PDF generated successfully (${pdfBuffer.length} bytes)`);
          resolve(pdfBuffer);
        });
        doc.on('error', reject);

        // Header
        doc.fontSize(24).fillColor('#0066cc').text('Monthly Contract Calendar', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(14).fillColor('#6c757d').text(month, { align: 'center' });
        doc.moveDown(0.3);
        doc.fontSize(10).fillColor('#28a745').text(`Generated on ${new Date().toLocaleDateString('en-US', { 
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        })}`, { align: 'center' });
        
        doc.moveDown(1.5);

        // Stats boxes
        const statsY = doc.y;
        const boxWidth = 150;
        const boxHeight = 60;
        const startX = (doc.page.width - (boxWidth * 3 + 40)) / 2;

        // Contracts Due box
        doc.rect(startX, statsY, boxWidth, boxHeight).fillAndStroke('#fef3c7', '#d97706');
        doc.fillColor('#d97706').fontSize(28).text(String(dueEvents.length), startX, statsY + 10, { width: boxWidth, align: 'center' });
        doc.fontSize(10).fillColor('#92400e').text('Contracts Due', startX, statsY + 40, { width: boxWidth, align: 'center' });

        // Contracts Expiring box
        doc.rect(startX + boxWidth + 20, statsY, boxWidth, boxHeight).fillAndStroke('#fee2e2', '#dc2626');
        doc.fillColor('#dc2626').fontSize(28).text(String(expiredEvents.length), startX + boxWidth + 20, statsY + 10, { width: boxWidth, align: 'center' });
        doc.fontSize(10).fillColor('#991b1b').text('Contracts Expiring', startX + boxWidth + 20, statsY + 40, { width: boxWidth, align: 'center' });

        // Total Events box
        doc.rect(startX + (boxWidth + 20) * 2, statsY, boxWidth, boxHeight).fillAndStroke('#dbeafe', '#2563eb');
        doc.fillColor('#2563eb').fontSize(28).text(String(events.length), startX + (boxWidth + 20) * 2, statsY + 10, { width: boxWidth, align: 'center' });
        doc.fontSize(10).fillColor('#1e40af').text('Total Events', startX + (boxWidth + 20) * 2, statsY + 40, { width: boxWidth, align: 'center' });

        doc.y = statsY + boxHeight + 30;

        // No events message
        if (events.length === 0) {
          doc.moveDown(2);
          doc.fontSize(16).fillColor('#166534').text('No Contract Events This Month', { align: 'center' });
          doc.moveDown(0.5);
          doc.fontSize(12).fillColor('#15803d').text(`There are no contracts due or expiring during ${month}.`, { align: 'center' });
          doc.text('The crew schedule is clear for this month.', { align: 'center' });
        }

        // Contracts Due Table
        if (dueEvents.length > 0) {
          doc.moveDown(1);
          doc.fontSize(14).fillColor('#d97706').text(`Contracts Due Soon (${dueEvents.length})`, 50);
          doc.moveDown(0.5);
          
          this.drawTable(doc, dueEvents, '#fef3c7');
        }

        // Contracts Expiring Table
        if (expiredEvents.length > 0) {
          doc.moveDown(1.5);
          doc.fontSize(14).fillColor('#dc2626').text(`Contracts Expiring (${expiredEvents.length})`, 50);
          doc.moveDown(0.5);
          
          this.drawTable(doc, expiredEvents, '#fee2e2');
        }

        // Footer
        doc.moveDown(2);
        doc.fontSize(10).fillColor('#6c757d').text(
          'This is an automated monthly report sent on the 1st of each month to help the crew department plan their schedule.',
          50,
          doc.page.height - 80,
          { align: 'center', width: doc.page.width - 100 }
        );

        doc.end();
      } catch (error) {
        console.error('❌ Failed to generate PDF:', error);
        reject(error);
      }
    });
  }

  private drawTable(doc: PDFKit.PDFDocument, events: ContractEvent[], headerColor: string) {
    const tableLeft = 50;
    const colWidths = [150, 120, 120, 80];
    const headers = ['Crew Member', 'Vessel', 'Date', 'Days Left'];
    
    let y = doc.y;
    
    // Header row
    doc.rect(tableLeft, y, colWidths.reduce((a, b) => a + b, 0), 25).fill(headerColor);
    doc.fillColor('#333333').fontSize(10);
    
    let x = tableLeft;
    headers.forEach((header, i) => {
      doc.text(header, x + 5, y + 8, { width: colWidths[i] - 10 });
      x += colWidths[i];
    });
    
    y += 25;

    // Data rows
    events.forEach((event, index) => {
      if (y > doc.page.height - 100) {
        doc.addPage();
        y = 50;
      }

      const rowColor = index % 2 === 0 ? '#ffffff' : '#f9fafb';
      doc.rect(tableLeft, y, colWidths.reduce((a, b) => a + b, 0), 22).fill(rowColor);
      
      doc.fillColor('#333333').fontSize(9);
      x = tableLeft;
      
      const dateStr = event.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const rowData = [event.crewMemberName, event.vesselName, dateStr, `${event.daysUntilExpiry} days`];
      
      rowData.forEach((cell, i) => {
        doc.text(cell, x + 5, y + 6, { width: colWidths[i] - 10 });
        x += colWidths[i];
      });
      
      y += 22;
    });

    doc.y = y;
  }
}

export const pdfGeneratorService = new PDFGeneratorService();
