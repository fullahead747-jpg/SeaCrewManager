import PDFDocument from 'pdfkit';

interface ContractEvent {
  id: string;
  status: 'overdue' | 'critical' | 'upcoming' | 'attention';
  date: Date;
  crewMemberId: string;
  crewMemberName: string;
  vesselId: string;
  vesselName: string;
  contractId: string;
  contractEndDate: Date;
  daysUntilExpiry: number;
  remarks?: string;
}

export class PDFGeneratorService {
  async generateCalendarPDF(month: string, events: ContractEvent[]): Promise<Buffer> {
    console.log(`📄 Generating PDF for ${month} with ${events.length} events...`);

    const overdueEvents = events.filter(e => e.status === 'overdue');
    const criticalEvents = events.filter(e => e.status === 'critical');
    const upcomingEvents = events.filter(e => e.status === 'upcoming');
    const attentionEvents = events.filter(e => e.status === 'attention');

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
        const boxWidth = 110; // Narrower boxes since there are 5 now
        const boxHeight = 60;
        const boxSpacing = 10;
        const startX = (doc.page.width - (boxWidth * 5 + boxSpacing * 4)) / 2;
        let currentX = startX;

        // Overdue box
        doc.rect(currentX, statsY, boxWidth, boxHeight).fillAndStroke('#fee2e2', '#dc2626');
        doc.fillColor('#dc2626').fontSize(28).text(String(overdueEvents.length), currentX, statsY + 10, { width: boxWidth, align: 'center' });
        doc.fontSize(10).fillColor('#991b1b').text('Overdue', currentX, statsY + 40, { width: boxWidth, align: 'center' });
        currentX += boxWidth + boxSpacing;

        // Critical box
        doc.rect(currentX, statsY, boxWidth, boxHeight).fillAndStroke('#ffedd5', '#ea580c');
        doc.fillColor('#ea580c').fontSize(28).text(String(criticalEvents.length), currentX, statsY + 10, { width: boxWidth, align: 'center' });
        doc.fontSize(10).fillColor('#9a3412').text('Critical', currentX, statsY + 40, { width: boxWidth, align: 'center' });
        currentX += boxWidth + boxSpacing;

        // Upcoming box
        doc.rect(currentX, statsY, boxWidth, boxHeight).fillAndStroke('#fef9c3', '#ca8a04');
        doc.fillColor('#ca8a04').fontSize(28).text(String(upcomingEvents.length), currentX, statsY + 10, { width: boxWidth, align: 'center' });
        doc.fontSize(10).fillColor('#854d0e').text('Upcoming', currentX, statsY + 40, { width: boxWidth, align: 'center' });
        currentX += boxWidth + boxSpacing;

        // Attention box
        doc.rect(currentX, statsY, boxWidth, boxHeight).fillAndStroke('#dbeafe', '#2563eb');
        doc.fillColor('#2563eb').fontSize(28).text(String(attentionEvents.length), currentX, statsY + 10, { width: boxWidth, align: 'center' });
        doc.fontSize(10).fillColor('#1e40af').text('Attention', currentX, statsY + 40, { width: boxWidth, align: 'center' });
        currentX += boxWidth + boxSpacing;

        // Total Events box
        doc.rect(currentX, statsY, boxWidth, boxHeight).fillAndStroke('#f3f4f6', '#4b5563');
        doc.fillColor('#4b5563').fontSize(28).text(String(events.length), currentX, statsY + 10, { width: boxWidth, align: 'center' });
        doc.fontSize(10).fillColor('#374151').text('Total Events', currentX, statsY + 40, { width: boxWidth, align: 'center' });

        doc.y = statsY + boxHeight + 30;

        // No events message
        if (events.length === 0) {
          doc.moveDown(2);
          doc.fontSize(16).fillColor('#166534').text('No Contract Events This Month', { align: 'center' });
          doc.moveDown(0.5);
          doc.fontSize(12).fillColor('#15803d').text(`There are no contracts due or expiring during ${month}.`, { align: 'center' });
          doc.text('The crew schedule is clear for this month.', { align: 'center' });
        }

        // Overdue Contracts Table
        if (overdueEvents.length > 0) {
          doc.moveDown(1);
          doc.fontSize(14).fillColor('#dc2626').text(`Contracts Overdue (<0 Days) (${overdueEvents.length})`, 50);
          doc.moveDown(0.5);

          this.drawTable(doc, overdueEvents, '#fee2e2');
        }

        // Critical Contracts Table
        if (criticalEvents.length > 0) {
          doc.moveDown(1.5);
          doc.fontSize(14).fillColor('#ea580c').text(`Contracts Critical (<30 Days) (${criticalEvents.length})`, 50);
          doc.moveDown(0.5);

          this.drawTable(doc, criticalEvents, '#ffedd5');
        }

        // Upcoming Contracts Table
        if (upcomingEvents.length > 0) {
          doc.moveDown(1.5);
          doc.fontSize(14).fillColor('#ca8a04').text(`Contracts Upcoming (30-60 Days) (${upcomingEvents.length})`, 50);
          doc.moveDown(0.5);

          this.drawTable(doc, upcomingEvents, '#fef9c3');
        }

        // Attention Contracts Table
        if (attentionEvents.length > 0) {
          doc.moveDown(1.5);
          doc.fontSize(14).fillColor('#2563eb').text(`Contracts Attention (>60 Days) (${attentionEvents.length})`, 50);
          doc.moveDown(0.5);

          this.drawTable(doc, attentionEvents, '#dbeafe');
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
      const hasRemark = !!event.remarks;
      const rowHeight = hasRemark ? 34 : 22;

      if (y > doc.page.height - 100) {
        doc.addPage();
        y = 50;
      }

      const rowColor = index % 2 === 0 ? '#ffffff' : '#f9fafb';
      doc.rect(tableLeft, y, colWidths.reduce((a, b) => a + b, 0), rowHeight).fill(rowColor);

      doc.fillColor('#333333').fontSize(9);
      x = tableLeft;

      const dateStr = event.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const rowData = [event.crewMemberName, event.vesselName, dateStr, `${event.daysUntilExpiry} days`];

      rowData.forEach((cell, i) => {
        if (i === 0 && hasRemark) {
          doc.fillColor('#1e293b').font('Helvetica-Bold').text(cell, x + 5, y + 4, { width: colWidths[i] - 10 });
          doc.fillColor('#dc2626').font('Helvetica-Oblique').fontSize(8).text(event.remarks!, x + 5, y + 17, { width: colWidths[i] - 10 });
          doc.font('Helvetica').fontSize(9);
        } else {
          doc.fillColor('#333333').text(cell, x + 5, y + 6, { width: colWidths[i] - 10 });
        }
        x += colWidths[i];
      });

      y += rowHeight;
    });

    doc.y = y;
  }
}

export const pdfGeneratorService = new PDFGeneratorService();
