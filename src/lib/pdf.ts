import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Invoice, Customer } from './db';
import { format } from 'date-fns';

export function generateInvoicePDF(invoice: Invoice, customer?: Customer): jsPDF {
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
  doc.text(invoice.invoiceNumber, 190, 28, { align: 'right' });

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
  doc.text(format(new Date(invoice.createdAt), 'MMM dd, yyyy'), 160, 55);
  doc.text(format(new Date(invoice.dueDate), 'MMM dd, yyyy'), 160, 62);
  
  // Status badge
  const statusColors: Record<string, [number, number, number]> = {
    paid: [34, 197, 94],
    partial: [234, 179, 8],
    draft: [156, 163, 175],
    sent: [59, 130, 246],
    overdue: [239, 68, 68],
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
  doc.text(invoice.customerName, 20, 103);
  
  if (customer) {
    doc.setTextColor(...mutedColor);
    if (customer.email) doc.text(customer.email, 20, 110);
    if (customer.phone) doc.text(customer.phone, 20, 117);
    if (customer.billingAddress) {
      const addressLines = customer.billingAddress.split('\n');
      addressLines.forEach((line, i) => {
        doc.text(line, 20, 124 + (i * 6));
      });
    }
  }

  // Items table
  const tableData = invoice.items.map(item => [
    item.productName,
    item.description || '-',
    item.quantity.toString(),
    `$${item.unitPrice.toFixed(2)}`,
    item.tax > 0 ? `${item.tax}%` : '-',
    item.discount > 0 ? `${item.discount}%` : '-',
    `$${item.total.toFixed(2)}`,
  ]);

  autoTable(doc, {
    startY: 140,
    head: [['Product', 'Description', 'Qty', 'Unit Price', 'Tax', 'Discount', 'Total']],
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
      0: { cellWidth: 35 },
      1: { cellWidth: 40 },
      2: { cellWidth: 15, halign: 'center' },
      3: { cellWidth: 25, halign: 'right' },
      4: { cellWidth: 18, halign: 'center' },
      5: { cellWidth: 20, halign: 'center' },
      6: { cellWidth: 25, halign: 'right' },
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
  doc.text(`$${invoice.taxTotal.toFixed(2)}`, 190, finalY + 8, { align: 'right' });
  doc.text(`-$${invoice.discountTotal.toFixed(2)}`, 190, finalY + 16, { align: 'right' });
  
  // Total line
  doc.setDrawColor(...primaryColor);
  doc.line(120, finalY + 22, 190, finalY + 22);
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Total:', 130, finalY + 32);
  doc.setTextColor(...primaryColor);
  doc.text(`$${invoice.total.toFixed(2)}`, 190, finalY + 32, { align: 'right' });

  // Payment Terms & Notes
  if (invoice.paymentTerms || invoice.notes) {
    const notesY = finalY + 50;
    doc.setFontSize(10);
    doc.setTextColor(...textColor);
    
    if (invoice.paymentTerms) {
      doc.setFont('helvetica', 'bold');
      doc.text('Payment Terms:', 20, notesY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...mutedColor);
      doc.text(invoice.paymentTerms, 20, notesY + 7);
    }
    
    if (invoice.notes) {
      const notesStartY = invoice.paymentTerms ? notesY + 20 : notesY;
      doc.setTextColor(...textColor);
      doc.setFont('helvetica', 'bold');
      doc.text('Notes:', 20, notesStartY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...mutedColor);
      const noteLines = doc.splitTextToSize(invoice.notes, 170);
      doc.text(noteLines, 20, notesStartY + 7);
    }
  }

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(...mutedColor);
  doc.text('Thank you for your business!', 105, 280, { align: 'center' });

  return doc;
}

export function downloadInvoicePDF(invoice: Invoice, customer?: Customer): void {
  const doc = generateInvoicePDF(invoice, customer);
  doc.save(`${invoice.invoiceNumber}.pdf`);
}

export function printInvoice(invoice: Invoice, customer?: Customer): void {
  const doc = generateInvoicePDF(invoice, customer);
  doc.autoPrint();
  window.open(doc.output('bloburl'), '_blank');
}
