import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Invoice, Customer, Payment, Quotation, DeliveryNote } from './supabase-db';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

// ── Template helpers ─────────────────────────────────────────────────────────

interface DocumentTemplate {
  id: string;
  template_url: string;
  is_active: boolean;
  document_type: string;
}

async function getActiveTemplate(docType: string): Promise<DocumentTemplate | null> {
  const { data } = await supabase
    .from('document_templates')
    .select('*')
    .eq('document_type', docType)
    .eq('is_active', true)
    .maybeSingle();
  return data as DocumentTemplate | null;
}

async function loadImageAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function buildTemplateDoc(templateUrl: string): Promise<jsPDF> {
  const doc = new jsPDF();
  const imgData = await loadImageAsBase64(templateUrl);
  // A4 page: 210 x 297 mm
  doc.addImage(imgData, 'PNG', 0, 0, 210, 297);
  return doc;
}

// Overlay company info + document data on top of the custom template image
function overlayInvoiceOnTemplate(doc: jsPDF, invoice: Invoice, payments?: Payment[], cur = '$') {
  const textColor: [number, number, number] = [31, 41, 55];
  const mutedColor: [number, number, number] = [80, 80, 80];

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...textColor);

  // Invoice number top-right
  doc.setFontSize(10);
  doc.text(invoice.invoice_number, 190, 20, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...mutedColor);

  // Dates
  doc.text(`Date: ${format(new Date(invoice.created_at), 'dd MMM yyyy')}`, 190, 27, { align: 'right' });
  if (invoice.due_date) doc.text(`Due: ${format(new Date(invoice.due_date), 'dd MMM yyyy')}`, 190, 33, { align: 'right' });

  // Customer block
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textColor);
  doc.text('Bill To:', 15, 55);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(invoice.customer_name, 15, 62);
  if (invoice.customer_email) doc.text(invoice.customer_email, 15, 67);
  if (invoice.customer_address) {
    const lines = invoice.customer_address.split('\n');
    lines.forEach((line, i) => doc.text(line, 15, 72 + i * 5));
  }

  // Items table
  const items = invoice.items || [];
  autoTable(doc, {
    startY: 85,
    head: [['Description', 'Qty', `Unit Price (${cur})`, 'Total']],
    body: items.map(item => [
      item.description,
      item.quantity.toString(),
      item.unit_price.toFixed(2),
      item.total.toFixed(2),
    ]),
    theme: 'plain',
    headStyles: { fontStyle: 'bold', fontSize: 9, fillColor: [240, 240, 240], textColor: [50, 50, 50] },
    bodyStyles: { fontSize: 8, textColor: textColor },
    margin: { left: 15, right: 15 },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedColor);
  doc.text(`Subtotal: ${cur}${invoice.subtotal.toFixed(2)}`, 190, finalY, { align: 'right' });
  doc.text(`Tax: ${cur}${invoice.tax_total.toFixed(2)}`, 190, finalY + 6, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textColor);
  doc.setFontSize(11);
  doc.text(`Total: ${cur}${invoice.total.toFixed(2)}`, 190, finalY + 14, { align: 'right' });

  if (payments && payments.length > 0) {
    const paid = payments.reduce((s, p) => s + p.amount, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedColor);
    doc.text(`Paid: ${cur}${paid.toFixed(2)}`, 190, finalY + 22, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textColor);
    doc.text(`Balance: ${cur}${(invoice.total - paid).toFixed(2)}`, 190, finalY + 29, { align: 'right' });
  }
}

function overlayQuotationOnTemplate(doc: jsPDF, quotation: Quotation, cur = '$') {
  const textColor: [number, number, number] = [31, 41, 55];
  const mutedColor: [number, number, number] = [80, 80, 80];

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...textColor);
  doc.text(quotation.quotation_number, 190, 20, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...mutedColor);
  doc.text(`Date: ${format(new Date(quotation.created_at), 'dd MMM yyyy')}`, 190, 27, { align: 'right' });
  if (quotation.valid_until) doc.text(`Valid Until: ${format(new Date(quotation.valid_until), 'dd MMM yyyy')}`, 190, 33, { align: 'right' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textColor);
  doc.text('Quote For:', 15, 55);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(quotation.customer_name, 15, 62);
  if (quotation.customer_email) doc.text(quotation.customer_email, 15, 67);

  autoTable(doc, {
    startY: 85,
    head: [['Description', 'Qty', `Unit Price (${cur})`, 'Total']],
    body: (quotation.items || []).map(item => [
      item.description,
      item.quantity.toString(),
      item.unit_price.toFixed(2),
      item.total.toFixed(2),
    ]),
    theme: 'plain',
    headStyles: { fontStyle: 'bold', fontSize: 9, fillColor: [240, 240, 240], textColor: [50, 50, 50] },
    bodyStyles: { fontSize: 8, textColor: textColor },
    margin: { left: 15, right: 15 },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 6;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textColor);
  doc.text(`Total: ${cur}${quotation.total.toFixed(2)}`, 190, finalY + 8, { align: 'right' });
}

function overlayDeliveryNoteOnTemplate(doc: jsPDF, deliveryNote: DeliveryNote) {
  const textColor: [number, number, number] = [31, 41, 55];
  const mutedColor: [number, number, number] = [80, 80, 80];

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...textColor);
  doc.text(deliveryNote.delivery_number, 190, 20, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...mutedColor);
  doc.text(`Date: ${format(new Date(deliveryNote.created_at), 'dd MMM yyyy')}`, 190, 27, { align: 'right' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textColor);
  doc.text('Deliver To:', 15, 55);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(deliveryNote.customer_name, 15, 62);
  if (deliveryNote.customer_address) doc.text(deliveryNote.customer_address, 15, 67);

  autoTable(doc, {
    startY: 85,
    head: [['Item Description', 'Quantity']],
    body: (deliveryNote.items || []).map(item => [item.description, item.quantity.toString()]),
    theme: 'plain',
    headStyles: { fontStyle: 'bold', fontSize: 9, fillColor: [240, 240, 240], textColor: [50, 50, 50] },
    bodyStyles: { fontSize: 8, textColor: textColor },
    margin: { left: 15, right: 15 },
  });
}

export interface CompanySettings {
  company_name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  tax_id: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  currency_symbol: string | null;
  footer_text: string | null;
  header_text: string | null;
}

export async function getCompanySettingsForPDF(): Promise<CompanySettings> {
  const { data } = await supabase
    .from('company_settings')
    .select('*')
    .limit(1)
    .maybeSingle();
  
  return {
    company_name: data?.company_name || 'My Company',
    address: data?.address || null,
    city: data?.city || null,
    country: data?.country || null,
    phone: data?.phone || null,
    email: data?.email || null,
    website: data?.website || null,
    tax_id: data?.tax_id || null,
    logo_url: data?.logo_url || null,
    primary_color: data?.primary_color || '#3B82F6',
    secondary_color: data?.secondary_color || '#1E40AF',
    currency_symbol: data?.currency_symbol || '$',
    footer_text: data?.footer_text || null,
    header_text: data?.header_text || null,
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [59, 130, 246];
}

function drawCompanyInfo(doc: jsPDF, settings: CompanySettings, mutedColor: [number, number, number], textColor: [number, number, number]) {
  doc.setTextColor(...textColor);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(settings.company_name, 20, 55);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...mutedColor);
  let yPos = 62;
  if (settings.address) { doc.text(settings.address, 20, yPos); yPos += 6; }
  if (settings.city) { doc.text([settings.city, settings.country].filter(Boolean).join(', '), 20, yPos); yPos += 6; }
  if (settings.email) { doc.text(settings.email, 20, yPos); yPos += 6; }
  if (settings.phone) { doc.text(settings.phone, 20, yPos); yPos += 6; }
  if (settings.tax_id) { doc.text(`Tax ID: ${settings.tax_id}`, 20, yPos); }
}

export function generateInvoicePDF(invoice: Invoice, customer?: Customer, payments?: Payment[], settings?: CompanySettings): jsPDF {
  const doc = new jsPDF();
  const cs = settings || { company_name: 'My Company', address: null, city: null, country: null, phone: null, email: null, website: null, tax_id: null, logo_url: null, primary_color: '#3B82F6', secondary_color: '#1E40AF', currency_symbol: '$', footer_text: null, header_text: null };
  const cur = cs.currency_symbol || '$';
  
  // Colors from company settings
  const primaryColor: [number, number, number] = hexToRgb(cs.primary_color || '#3B82F6');
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

  // Company Info
  drawCompanyInfo(doc, cs, mutedColor, textColor);

  // Invoice Details (right side)
  doc.setTextColor(...textColor);
  doc.setFontSize(10);
  const detailsX = 120;
  doc.setFont('helvetica', 'bold');
  doc.text('Invoice Date:', detailsX, 55);
  doc.text('Due Date:', detailsX, 62);
  doc.text('Status:', detailsX, 69);
  if (invoice.project_code) {
    doc.text('Project Code:', detailsX, 76);
  }
  
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
  
  if (invoice.project_code) {
    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'normal');
    doc.text(invoice.project_code, 160, 76);
  }

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
    `${cur}${item.unit_price.toFixed(2)}`,
    item.tax_rate ? `${item.tax_rate}%` : '-',
    item.discount ? `${item.discount}%` : '-',
    `${cur}${item.total.toFixed(2)}`,
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
  doc.text(`${cur}${invoice.subtotal.toFixed(2)}`, 190, finalY, { align: 'right' });
  doc.text(`${cur}${invoice.tax_total.toFixed(2)}`, 190, finalY + 8, { align: 'right' });
  doc.text(`-${cur}${invoice.discount_total.toFixed(2)}`, 190, finalY + 16, { align: 'right' });
  
  // Total line
  doc.setDrawColor(...primaryColor);
  doc.line(120, finalY + 22, 190, finalY + 22);
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Total:', 130, finalY + 32);
  doc.setTextColor(...primaryColor);
  doc.text(`${cur}${invoice.total.toFixed(2)}`, 190, finalY + 32, { align: 'right' });

  // Amount Paid & Balance
  if (payments && payments.length > 0) {
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const balance = invoice.total - totalPaid;
    
    doc.setFontSize(10);
    doc.setTextColor(34, 197, 94);
    doc.text('Amount Paid:', 130, finalY + 42);
    doc.text(`${cur}${totalPaid.toFixed(2)}`, 190, finalY + 42, { align: 'right' });
    
    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'bold');
    doc.text('Balance Due:', 130, finalY + 50);
    doc.text(`${cur}${balance.toFixed(2)}`, 190, finalY + 50, { align: 'right' });
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
  doc.text(cs.footer_text || 'Thank you for your business!', 105, 280, { align: 'center' });

  return doc;
}

export async function downloadInvoicePDF(invoice: Invoice, customer?: Customer, payments?: Payment[]): Promise<void> {
  const template = await getActiveTemplate('invoice');
  if (template) {
    const settings = await getCompanySettingsForPDF();
    const cur = settings.currency_symbol || '$';
    const doc = await buildTemplateDoc(template.template_url);
    overlayInvoiceOnTemplate(doc, invoice, payments, cur);
    doc.save(`${invoice.invoice_number}.pdf`);
    return;
  }
  const settings = await getCompanySettingsForPDF();
  const doc = generateInvoicePDF(invoice, customer, payments, settings);
  doc.save(`${invoice.invoice_number}.pdf`);
}

export async function printInvoice(invoice: Invoice, customer?: Customer, payments?: Payment[]): Promise<void> {
  const template = await getActiveTemplate('invoice');
  if (template) {
    const settings = await getCompanySettingsForPDF();
    const cur = settings.currency_symbol || '$';
    const doc = await buildTemplateDoc(template.template_url);
    overlayInvoiceOnTemplate(doc, invoice, payments, cur);
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
    return;
  }
  const settings = await getCompanySettingsForPDF();
  const doc = generateInvoicePDF(invoice, customer, payments, settings);
  doc.autoPrint();
  window.open(doc.output('bloburl'), '_blank');
}

// Quotation PDF
export function generateQuotationPDF(quotation: Quotation, settings?: CompanySettings): jsPDF {
  const doc = new jsPDF();
  const cs = settings || { company_name: 'My Company', address: null, city: null, country: null, phone: null, email: null, website: null, tax_id: null, logo_url: null, primary_color: '#3B82F6', secondary_color: '#1E40AF', currency_symbol: '$', footer_text: null, header_text: null };
  const cur = cs.currency_symbol || '$';
  
  const primaryColor: [number, number, number] = hexToRgb(cs.primary_color || '#3B82F6');
  const textColor: [number, number, number] = [31, 41, 55];
  const mutedColor: [number, number, number] = [107, 114, 128];

  // Header
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 220, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('QUOTATION', 20, 28);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(quotation.quotation_number, 190, 28, { align: 'right' });

  // Company Info
  drawCompanyInfo(doc, cs, mutedColor, textColor);

  // Quotation Details
  doc.setTextColor(...textColor);
  doc.setFontSize(10);
  const detailsX = 120;
  doc.setFont('helvetica', 'bold');
  doc.text('Date:', detailsX, 55);
  doc.text('Valid Until:', detailsX, 62);
  doc.text('Status:', detailsX, 69);
  if (quotation.project_code) {
    doc.text('Project Code:', detailsX, 76);
  }
  
  doc.setFont('helvetica', 'normal');
  doc.text(format(new Date(quotation.created_at), 'MMM dd, yyyy'), 160, 55);
  doc.text(quotation.valid_until ? format(new Date(quotation.valid_until), 'MMM dd, yyyy') : '-', 160, 62);
  
  const statusColors: Record<string, [number, number, number]> = {
    draft: [156, 163, 175],
    pending: [234, 179, 8],
    approved: [34, 197, 94],
    cancelled: [107, 114, 128],
  };
  const statusColor = statusColors[quotation.status] || mutedColor;
  doc.setTextColor(...statusColor);
  doc.setFont('helvetica', 'bold');
  doc.text(quotation.status.toUpperCase(), 160, 69);

  if (quotation.project_code) {
    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'normal');
    doc.text(quotation.project_code, 160, 76);
  }

  // Customer Info
  doc.setTextColor(...textColor);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Quote For:', 20, 95);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(quotation.customer_name, 20, 103);
  
  doc.setTextColor(...mutedColor);
  if (quotation.customer_email) doc.text(quotation.customer_email, 20, 110);
  if (quotation.customer_address) {
    const addressLines = quotation.customer_address.split('\n');
    let yPos = 117;
    addressLines.forEach((line) => {
      doc.text(line, 20, yPos);
      yPos += 6;
    });
  }

  // Items table
  const items = quotation.items || [];
  const tableData = items.map(item => [
    item.description,
    item.quantity.toString(),
    `${cur}${item.unit_price.toFixed(2)}`,
    item.tax_rate ? `${item.tax_rate}%` : '-',
    item.discount ? `${item.discount}%` : '-',
    `${cur}${item.total.toFixed(2)}`,
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
  doc.text(`${cur}${quotation.subtotal.toFixed(2)}`, 190, finalY, { align: 'right' });
  doc.text(`${cur}${quotation.tax_total.toFixed(2)}`, 190, finalY + 8, { align: 'right' });
  doc.text(`-${cur}${quotation.discount_total.toFixed(2)}`, 190, finalY + 16, { align: 'right' });
  
  doc.setDrawColor(...primaryColor);
  doc.line(120, finalY + 22, 190, finalY + 22);
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Total:', 130, finalY + 32);
  doc.setTextColor(...primaryColor);
  doc.text(`${cur}${quotation.total.toFixed(2)}`, 190, finalY + 32, { align: 'right' });

  // Notes
  if (quotation.notes) {
    const notesStartY = finalY + 50;
    doc.setFontSize(10);
    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes:', 20, notesStartY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedColor);
    const noteLines = doc.splitTextToSize(quotation.notes, 170);
    doc.text(noteLines, 20, notesStartY + 7);
  }

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(...mutedColor);
  doc.text(cs.footer_text || 'This quotation is valid for 30 days from the date of issue.', 105, 275, { align: 'center' });
  doc.text('Thank you for your interest!', 105, 282, { align: 'center' });

  return doc;
}

export async function downloadQuotationPDF(quotation: Quotation): Promise<void> {
  const template = await getActiveTemplate('quotation');
  if (template) {
    const settings = await getCompanySettingsForPDF();
    const cur = settings.currency_symbol || '$';
    const doc = await buildTemplateDoc(template.template_url);
    overlayQuotationOnTemplate(doc, quotation, cur);
    doc.save(`${quotation.quotation_number}.pdf`);
    return;
  }
  const settings = await getCompanySettingsForPDF();
  const doc = generateQuotationPDF(quotation, settings);
  doc.save(`${quotation.quotation_number}.pdf`);
}

// Delivery Note PDF
export function generateDeliveryNotePDF(deliveryNote: DeliveryNote, settings?: CompanySettings): jsPDF {
  const doc = new jsPDF();
  const cs = settings || { company_name: 'My Company', address: null, city: null, country: null, phone: null, email: null, website: null, tax_id: null, logo_url: null, primary_color: '#10B981', secondary_color: '#1E40AF', currency_symbol: '$', footer_text: null, header_text: null };
  
  const primaryColor: [number, number, number] = hexToRgb(cs.primary_color || '#10B981');
  const textColor: [number, number, number] = [31, 41, 55];
  const mutedColor: [number, number, number] = [107, 114, 128];

  // Header
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 220, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('DELIVERY NOTE', 20, 28);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(deliveryNote.delivery_number, 190, 28, { align: 'right' });

  // Company Info
  drawCompanyInfo(doc, cs, mutedColor, textColor);

  // Delivery Details
  doc.setTextColor(...textColor);
  doc.setFontSize(10);
  const detailsX = 120;
  doc.setFont('helvetica', 'bold');
  doc.text('Date:', detailsX, 55);
  doc.text('Delivery Date:', detailsX, 62);
  doc.text('Status:', detailsX, 69);
  
  doc.setFont('helvetica', 'normal');
  doc.text(format(new Date(deliveryNote.created_at), 'MMM dd, yyyy'), 165, 55);
  doc.text(deliveryNote.delivery_date ? format(new Date(deliveryNote.delivery_date), 'MMM dd, yyyy') : '-', 165, 62);
  
  const statusColors: Record<string, [number, number, number]> = {
    pending: [234, 179, 8],
    delivered: [34, 197, 94],
    cancelled: [107, 114, 128],
  };
  const statusColor = statusColors[deliveryNote.status] || mutedColor;
  doc.setTextColor(...statusColor);
  doc.setFont('helvetica', 'bold');
  doc.text(deliveryNote.status.toUpperCase(), 165, 69);

  // Delivery To
  doc.setTextColor(...textColor);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Deliver To:', 20, 95);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(deliveryNote.customer_name, 20, 103);
  
  doc.setTextColor(...mutedColor);
  if (deliveryNote.customer_address) {
    const addressLines = deliveryNote.customer_address.split('\n');
    let yPos = 110;
    addressLines.forEach((line) => {
      doc.text(line, 20, yPos);
      yPos += 6;
    });
  }

  // Items table
  const items = deliveryNote.items || [];
  const tableData = items.map(item => [
    item.description,
    item.quantity.toString(),
  ]);

  autoTable(doc, {
    startY: 130,
    head: [['Item Description', 'Quantity']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 10,
      textColor: textColor,
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
    columnStyles: {
      0: { cellWidth: 130 },
      1: { cellWidth: 40, halign: 'center' },
    },
    margin: { left: 20, right: 20 },
  });

  // Summary
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  
  doc.setFontSize(11);
  doc.setTextColor(...textColor);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Items: ${items.length}`, 20, finalY);
  doc.text(`Total Quantity: ${items.reduce((sum, item) => sum + item.quantity, 0)}`, 20, finalY + 8);

  // Notes
  if (deliveryNote.notes) {
    const notesStartY = finalY + 25;
    doc.setFontSize(10);
    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes:', 20, notesStartY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedColor);
    const noteLines = doc.splitTextToSize(deliveryNote.notes, 170);
    doc.text(noteLines, 20, notesStartY + 7);
  }

  // Signature Section
  const sigY = 230;
  doc.setDrawColor(...mutedColor);
  doc.setLineWidth(0.5);
  
  doc.setTextColor(...textColor);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Received By:', 20, sigY);
  doc.line(20, sigY + 20, 90, sigY + 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...mutedColor);
  doc.text('Signature', 55, sigY + 25, { align: 'center' });

  doc.setTextColor(...textColor);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Date:', 110, sigY);
  doc.line(110, sigY + 20, 180, sigY + 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...mutedColor);
  doc.text('Date', 145, sigY + 25, { align: 'center' });

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(...mutedColor);
  doc.text(cs.footer_text || 'Please sign and return a copy as proof of delivery.', 105, 280, { align: 'center' });

  return doc;
}

// Purchase Order PDF
export function generatePurchaseOrderPDF(po: {
  po_number: string;
  supplier_name: string;
  supplier_email?: string | null;
  branch_name?: string | null;
  order_date: string;
  expected_date?: string | null;
  status: string;
  notes?: string | null;
  subtotal: number;
  tax_total: number;
  total: number;
  items: { product_name: string; sku?: string | null; quantity: number; unit_cost: number; total: number }[];
}, settings?: CompanySettings): jsPDF {
  const doc = new jsPDF();
  const cs = settings || { company_name: 'My Company', address: null, city: null, country: null, phone: null, email: null, website: null, tax_id: null, logo_url: null, primary_color: '#3B82F6', secondary_color: '#1E40AF', currency_symbol: '$', footer_text: null, header_text: null };
  const cur = cs.currency_symbol || '$';
  const primaryColor: [number, number, number] = hexToRgb(cs.primary_color || '#6366F1');
  const textColor: [number, number, number] = [31, 41, 55];
  const mutedColor: [number, number, number] = [107, 114, 128];

  // Header
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 220, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('PURCHASE ORDER', 20, 28);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(po.po_number, 190, 28, { align: 'right' });

  // Company Info
  drawCompanyInfo(doc, cs, mutedColor, textColor);

  // PO Details (right side)
  doc.setTextColor(...textColor);
  doc.setFontSize(10);
  const dx = 120;
  doc.setFont('helvetica', 'bold');
  doc.text('Order Date:', dx, 55);
  doc.text('Expected Date:', dx, 62);
  doc.text('Status:', dx, 69);
  if (po.branch_name) doc.text('Branch:', dx, 76);

  doc.setFont('helvetica', 'normal');
  doc.text(format(new Date(po.order_date), 'MMM dd, yyyy'), 165, 55);
  doc.text(po.expected_date ? format(new Date(po.expected_date), 'MMM dd, yyyy') : 'TBD', 165, 62);
  doc.setTextColor(...primaryColor);
  doc.setFont('helvetica', 'bold');
  doc.text(po.status.toUpperCase(), 165, 69);
  if (po.branch_name) {
    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'normal');
    doc.text(po.branch_name, 165, 76);
  }

  // Supplier Info
  doc.setTextColor(...textColor);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Supplier:', 20, 95);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(po.supplier_name, 20, 103);
  doc.setTextColor(...mutedColor);
  if (po.supplier_email) doc.text(po.supplier_email, 20, 110);

  // Items table
  autoTable(doc, {
    startY: 125,
    head: [['Item', 'SKU', 'Quantity', `Unit Cost (${cur})`, `Total (${cur})`]],
    body: po.items.map(item => [
      item.product_name,
      item.sku || '-',
      item.quantity.toString(),
      item.unit_cost.toFixed(2),
      item.total.toFixed(2),
    ]),
    theme: 'striped',
    headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: textColor },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 30 },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 35, halign: 'right' },
      4: { cellWidth: 35, halign: 'right' },
    },
    margin: { left: 20, right: 20 },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.setTextColor(...mutedColor);
  doc.text('Subtotal:', 130, finalY);
  doc.setTextColor(...textColor);
  doc.text(`${cur}${po.subtotal.toFixed(2)}`, 190, finalY, { align: 'right' });
  doc.setDrawColor(...primaryColor);
  doc.line(120, finalY + 8, 190, finalY + 8);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Total:', 130, finalY + 18);
  doc.setTextColor(...primaryColor);
  doc.text(`${cur}${po.total.toFixed(2)}`, 190, finalY + 18, { align: 'right' });

  if (po.notes) {
    const ny = finalY + 35;
    doc.setFontSize(10);
    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes:', 20, ny);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedColor);
    const noteLines = doc.splitTextToSize(po.notes, 170);
    doc.text(noteLines, 20, ny + 7);
  }

  // Signature block
  const sigY = 250;
  doc.setTextColor(...textColor);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Authorized By:', 20, sigY);
  doc.setDrawColor(...mutedColor);
  doc.line(20, sigY + 20, 90, sigY + 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...mutedColor);
  doc.text('Signature & Date', 55, sigY + 26, { align: 'center' });

  doc.setFontSize(9);
  doc.text(cs.footer_text || 'This is an official purchase order. Please supply the goods as listed above.', 105, 280, { align: 'center' });

  return doc;
}

export async function downloadDeliveryNotePDF(deliveryNote: DeliveryNote): Promise<void> {
  const template = await getActiveTemplate('delivery_note');
  if (template) {
    const doc = await buildTemplateDoc(template.template_url);
    overlayDeliveryNoteOnTemplate(doc, deliveryNote);
    doc.save(`${deliveryNote.delivery_number}.pdf`);
    return;
  }
  const settings = await getCompanySettingsForPDF();
  const doc = generateDeliveryNotePDF(deliveryNote, settings);
  doc.save(`${deliveryNote.delivery_number}.pdf`);
}
