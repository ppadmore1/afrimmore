import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Invoice, Customer, Payment } from './supabase-db';
import { format } from 'date-fns';

export function generateInvoicePDF(invoice: Invoice, customer?: Customer, payments?: Payment[]): jsPDF {
  const doc = new jsPDF();
  
  // Colors
  const primaryColor: [number, number, number] = [37, 99, 235]; // Blue
  const textColor: [number, number, number] = [31, 41, 55];
  const mutedColor: [number, number, number] = [107, 114, 128];

  // Header
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 220, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', 20, 28);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.invoice_number, 190, 28, { align: 'right' });

  // Company Info (left side)
  doc.setTextColor(...textColor);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Your Company Name', 20, 55);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...mutedColor);
  doc.text('123 Business Street', 20, 62);
  doc.text('City, State 12345', 20, 68);
  doc.text('contact@company.com', 20, 74);

  // Invoice Details (right side)
  doc.setTextColor(...textColor);
  doc.setFontSize(10);
  const detailsX = 120;
  doc.setFont('helvetica', 'bold');
  doc.text('Invoice Date:', detailsX, 55);
  doc.text('Due Date:', detailsX, 62);
  doc.text('Status:', detailsX, 69);
  
  doc.setFont('helvetica', 'normal');
  doc.text(format(new Date(invoice.created_at), 'MMM dd, yyyy'), 160, 55);
  doc.text(invoice.due_date ? format(new Date(invoice.due_date), 'MMM dd, yyyy') : '-', 160, 62);
  
  // Status badge
  const statusColors: Record<string, [number, number, number]> = {
    paid: [34, 197, 94],
    pending: [234, 179, 8],
    draft: [156, 163, 175],
    approved: [59, 130, 246],
    cancelled: [107, 114, 128],
  };
  const statusColor = statusColors[invoice.status] || mutedColor;
  doc.setTextColor(...statusColor);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.status.toUpperCase(), 160, 69);

  // Bill To
  doc.setTextColor(...textColor);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Bill To:', 20, 95);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(invoice.customer_name, 20, 103);
  
  doc.setTextColor(...mutedColor);
  if (invoice.customer_email) doc.text(invoice.customer_email, 20, 110);
  if (invoice.customer_address) {
    const addressLines = invoice.customer_address.split('\n');
    let yPos = 117;
    addressLines.forEach((line) => {
      doc.text(line, 20, yPos);
      yPos += 6;
    });
  }

  // Items table
  const items = invoice.items || [];
  const tableData = items.map(item => [
    item.description,
    item.quantity.toString(),
    `$${item.unit_price.toFixed(2)}`,
    item.tax_rate ? `${item.tax_rate}%` : '-',
    item.discount ? `${item.discount}%` : '-',
    `$${item.total.toFixed(2)}`,
  ]);

  autoTable(doc, {
    startY: 135,
    head: [['Description', 'Qty', 'Unit Price', 'Tax', 'Discount', 'Total']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: textColor,
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 30, halign: 'right' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 25, halign: 'center' },
      5: { cellWidth: 30, halign: 'right' },
    },
    margin: { left: 20, right: 20 },
  });

  // Totals
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  
  doc.setFontSize(10);
  doc.setTextColor(...mutedColor);
  doc.text('Subtotal:', 130, finalY);
  doc.text('Tax:', 130, finalY + 8);
  doc.text('Discount:', 130, finalY + 16);
  
  doc.setTextColor(...textColor);
  doc.text(`$${invoice.subtotal.toFixed(2)}`, 190, finalY, { align: 'right' });
  doc.text(`$${invoice.tax_total.toFixed(2)}`, 190, finalY + 8, { align: 'right' });
  doc.text(`-$${invoice.discount_total.toFixed(2)}`, 190, finalY + 16, { align: 'right' });
  
  // Total line
  doc.setDrawColor(...primaryColor);
  doc.line(120, finalY + 22, 190, finalY + 22);
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Total:', 130, finalY + 32);
  doc.setTextColor(...primaryColor);
  doc.text(`$${invoice.total.toFixed(2)}`, 190, finalY + 32, { align: 'right' });

  // Amount Paid & Balance
  if (payments && payments.length > 0) {
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const balance = invoice.total - totalPaid;
    
    doc.setFontSize(10);
    doc.setTextColor(34, 197, 94);
    doc.text('Amount Paid:', 130, finalY + 42);
    doc.text(`$${totalPaid.toFixed(2)}`, 190, finalY + 42, { align: 'right' });
    
    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'bold');
    doc.text('Balance Due:', 130, finalY + 50);
    doc.text(`$${balance.toFixed(2)}`, 190, finalY + 50, { align: 'right' });
  }

  // Payment Terms & Notes
  const notesStartY = payments && payments.length > 0 ? finalY + 65 : finalY + 50;
  
  if (invoice.payment_terms || invoice.notes) {
    doc.setFontSize(10);
    doc.setTextColor(...textColor);
    
    if (invoice.payment_terms) {
      doc.setFont('helvetica', 'bold');
      doc.text('Payment Terms:', 20, notesStartY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...mutedColor);
      doc.text(invoice.payment_terms, 20, notesStartY + 7);
    }
    
    if (invoice.notes) {
      const notesY = invoice.payment_terms ? notesStartY + 20 : notesStartY;
      doc.setTextColor(...textColor);
      doc.setFont('helvetica', 'bold');
      doc.text('Notes:', 20, notesY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...mutedColor);
      const noteLines = doc.splitTextToSize(invoice.notes, 170);
      doc.text(noteLines, 20, notesY + 7);
    }
  }

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(...mutedColor);
  doc.text('Thank you for your business!', 105, 280, { align: 'center' });

  return doc;
}

export function downloadInvoicePDF(invoice: Invoice, customer?: Customer, payments?: Payment[]): void {
  const doc = generateInvoicePDF(invoice, customer, payments);
  doc.save(`${invoice.invoice_number}.pdf`);
}

export function printInvoice(invoice: Invoice, customer?: Customer, payments?: Payment[]): void {
  const doc = generateInvoicePDF(invoice, customer, payments);
  doc.autoPrint();
  window.open(doc.output('bloburl'), '_blank');
}
