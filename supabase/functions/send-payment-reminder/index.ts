import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PaymentReminderRequest {
  customerId: string;
  customerName: string;
  customerEmail: string;
  outstandingBalance: number;
  invoices: Array<{
    invoiceNumber: string;
    total: number;
    amountPaid: number;
    dueDate?: string;
  }>;
}

function generateReminderHtml(data: PaymentReminderRequest): string {
  const today = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Reminder</title>
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
            border-bottom: 2px solid #f59e0b;
            padding-bottom: 20px;
            margin-bottom: 20px;
          }
          .header h1 {
            color: #3b82f6;
            margin: 0 0 10px 0;
            font-size: 28px;
          }
          .header .subtitle {
            color: #f59e0b;
            font-weight: 600;
            font-size: 18px;
          }
          .greeting {
            font-size: 16px;
            margin-bottom: 20px;
          }
          .balance-box {
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            border: 2px solid #f59e0b;
            border-radius: 12px;
            padding: 20px;
            text-align: center;
            margin: 20px 0;
          }
          .balance-label {
            color: #92400e;
            font-size: 14px;
            font-weight: 500;
            margin-bottom: 5px;
          }
          .balance-amount {
            color: #92400e;
            font-size: 32px;
            font-weight: bold;
          }
          .invoices-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          .invoices-table th {
            background: #f8f9fa;
            padding: 12px;
            text-align: left;
            border-bottom: 2px solid #e9ecef;
            font-weight: 600;
            color: #495057;
            font-size: 14px;
          }
          .invoices-table td {
            padding: 12px;
            border-bottom: 1px solid #e9ecef;
            font-size: 14px;
          }
          .invoices-table .amount {
            text-align: right;
            font-family: monospace;
          }
          .invoices-table .balance-due {
            color: #dc2626;
            font-weight: 600;
          }
          .message {
            background: #eff6ff;
            border-left: 4px solid #3b82f6;
            padding: 15px;
            margin: 20px 0;
            border-radius: 0 6px 6px 0;
          }
          .cta-button {
            display: block;
            width: 100%;
            text-align: center;
            background: #3b82f6;
            color: white;
            text-decoration: none;
            padding: 15px 30px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            margin: 25px 0;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
            color: #666;
            font-size: 14px;
          }
          .date {
            color: #666;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>AFRIMMORE</h1>
            <p class="subtitle">Payment Reminder</p>
          </div>
          
          <p class="date">${today}</p>
          
          <p class="greeting">Dear ${sanitizeHtml(data.customerName)},</p>
          
          <p>This is a friendly reminder that you have an outstanding balance on your account.</p>
          
          <div class="balance-box">
            <div class="balance-label">Outstanding Balance</div>
            <div class="balance-amount">$${data.outstandingBalance.toFixed(2)}</div>
          </div>
          
          <h3>Outstanding Invoices</h3>
          <table class="invoices-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th class="amount">Total</th>
                <th class="amount">Paid</th>
                <th class="amount">Balance Due</th>
              </tr>
            </thead>
            <tbody>
              ${data.invoices.map(inv => `
                <tr>
                  <td>${sanitizeHtml(inv.invoiceNumber)}</td>
                  <td class="amount">$${inv.total.toFixed(2)}</td>
                  <td class="amount">$${inv.amountPaid.toFixed(2)}</td>
                  <td class="amount balance-due">$${(inv.total - inv.amountPaid).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="message">
            <strong>Payment Options:</strong><br>
            Please contact us to arrange payment or if you have any questions about your account. We accept cash, card, mobile money, and bank transfers.
          </div>
          
          <p>If you have already made this payment, please disregard this reminder.</p>
          
          <div class="footer">
            <p>Thank you for your business!</p>
            <p>If you have any questions, please don't hesitate to contact us.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

// Sanitize HTML to prevent XSS
function sanitizeHtml(input: string): string {
  if (typeof input !== 'string') return '';
  return input.replace(/[<>&"']/g, (char) => {
    switch (char) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return char;
    }
  });
}

// Validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-payment-reminder function called");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract and validate authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create Supabase client with user's auth token
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Missing Supabase configuration");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("User not authenticated:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if user has staff role
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    
    if (rolesError || !roles || roles.length === 0) {
      console.error("User lacks required permissions:", rolesError?.message);
      return new Response(
        JSON.stringify({ error: "Insufficient permissions" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("User authenticated:", user.id, "with roles:", roles.map(r => r.role));

    // Parse and validate request body
    const data: PaymentReminderRequest = await req.json();
    console.log("Received reminder request for customer:", data.customerName, "email:", data.customerEmail);

    // Validate required fields
    if (!data.customerEmail) {
      console.error("No customer email provided");
      return new Response(
        JSON.stringify({ error: "Customer email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate email format
    if (!isValidEmail(data.customerEmail)) {
      console.error("Invalid email format:", data.customerEmail);
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate customer name
    if (!data.customerName || data.customerName.length > 200) {
      console.error("Invalid customer name");
      return new Response(
        JSON.stringify({ error: "Invalid customer name" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate outstanding balance
    if (typeof data.outstandingBalance !== 'number' || data.outstandingBalance <= 0) {
      console.error("Invalid outstanding balance:", data.outstandingBalance);
      return new Response(
        JSON.stringify({ error: "Outstanding balance must be greater than 0" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate invoices array
    if (!Array.isArray(data.invoices) || data.invoices.length === 0) {
      console.error("No invoices provided");
      return new Response(
        JSON.stringify({ error: "At least one outstanding invoice is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const subject = `Payment Reminder - Outstanding Balance $${data.outstandingBalance.toFixed(2)}`;
    const html = generateReminderHtml(data);

    console.log("Sending payment reminder to:", data.customerEmail);

    const emailResponse = await resend.emails.send({
      from: "AFRIMMORE <onboarding@resend.dev>",
      to: [data.customerEmail],
      subject: subject,
      html: html,
    });

    console.log("Payment reminder sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, data: emailResponse }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-payment-reminder function:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send payment reminder" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
