import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DocumentEmailRequest {
  type: "invoice" | "quotation";
  documentNumber: string;
  customerName: string;
  customerEmail: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  total: number;
  dueDate?: string;
  validUntil?: string;
  notes?: string;
}

function generateEmailHtml(data: DocumentEmailRequest): string {
  const title = data.type === "invoice" ? "Invoice" : "Quotation";
  const dateLabel = data.type === "invoice" ? "Due Date" : "Valid Until";
  const dateValue = data.type === "invoice" ? data.dueDate : data.validUntil;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title} ${data.documentNumber}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .container {
            background: white;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #3b82f6;
            padding-bottom: 20px;
            margin-bottom: 20px;
          }
          .header h1 {
            color: #3b82f6;
            margin: 0 0 10px 0;
            font-size: 28px;
          }
          .header p {
            color: #666;
            margin: 0;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            padding: 5px 0;
          }
          .info-label {
            color: #666;
            font-weight: 500;
          }
          .info-value {
            font-weight: 600;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          .items-table th {
            background: #f8f9fa;
            padding: 12px;
            text-align: left;
            border-bottom: 2px solid #e9ecef;
            font-weight: 600;
            color: #495057;
          }
          .items-table td {
            padding: 12px;
            border-bottom: 1px solid #e9ecef;
          }
          .items-table .amount {
            text-align: right;
            font-family: monospace;
          }
          .totals {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 2px solid #e9ecef;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
          }
          .total-row.grand {
            font-size: 20px;
            font-weight: bold;
            color: #3b82f6;
            border-top: 2px solid #3b82f6;
            padding-top: 15px;
            margin-top: 10px;
          }
          .notes {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
            margin-top: 20px;
          }
          .notes-title {
            font-weight: 600;
            margin-bottom: 8px;
            color: #495057;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
            color: #666;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>AFRIMMORE</h1>
            <p>${title}</p>
          </div>
          
          <div class="info-section">
            <div class="info-row">
              <span class="info-label">${title} Number:</span>
              <span class="info-value">${data.documentNumber}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Customer:</span>
              <span class="info-value">${data.customerName}</span>
            </div>
            ${dateValue ? `
            <div class="info-row">
              <span class="info-label">${dateLabel}:</span>
              <span class="info-value">${dateValue}</span>
            </div>
            ` : ''}
          </div>
          
          <table class="items-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Qty</th>
                <th class="amount">Price</th>
                <th class="amount">Total</th>
              </tr>
            </thead>
            <tbody>
              ${data.items.map(item => `
                <tr>
                  <td>${item.description}</td>
                  <td>${item.quantity}</td>
                  <td class="amount">$${item.unitPrice.toFixed(2)}</td>
                  <td class="amount">$${item.total.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="totals">
            <div class="total-row">
              <span>Subtotal:</span>
              <span>$${data.subtotal.toFixed(2)}</span>
            </div>
            ${data.discountTotal > 0 ? `
            <div class="total-row">
              <span>Discount:</span>
              <span>-$${data.discountTotal.toFixed(2)}</span>
            </div>
            ` : ''}
            ${data.taxTotal > 0 ? `
            <div class="total-row">
              <span>Tax:</span>
              <span>$${data.taxTotal.toFixed(2)}</span>
            </div>
            ` : ''}
            <div class="total-row grand">
              <span>Total:</span>
              <span>$${data.total.toFixed(2)}</span>
            </div>
          </div>
          
          ${data.notes ? `
          <div class="notes">
            <div class="notes-title">Notes:</div>
            <p>${data.notes}</p>
          </div>
          ` : ''}
          
          <div class="footer">
            <p>Thank you for your business!</p>
            <p>If you have any questions, please contact us.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-document-email function called");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: DocumentEmailRequest = await req.json();
    console.log("Received request:", { type: data.type, documentNumber: data.documentNumber, customerEmail: data.customerEmail });

    if (!data.customerEmail) {
      console.error("No customer email provided");
      return new Response(
        JSON.stringify({ error: "Customer email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const title = data.type === "invoice" ? "Invoice" : "Quotation";
    const subject = `${title} ${data.documentNumber} from AFRIMMORE`;

    const html = generateEmailHtml(data);

    console.log("Sending email to:", data.customerEmail);

    const emailResponse = await resend.emails.send({
      from: "AFRIMMORE <onboarding@resend.dev>",
      to: [data.customerEmail],
      subject: subject,
      html: html,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, data: emailResponse }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-document-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
