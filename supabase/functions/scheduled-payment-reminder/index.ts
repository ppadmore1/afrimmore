import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

const handler = async (req: Request): Promise<Response> => {
  console.log("scheduled-payment-reminder function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find overdue invoices (past due date, not fully paid, not cancelled)
    const today = new Date().toISOString().split("T")[0];
    
    const { data: overdueInvoices, error: invError } = await supabase
      .from("invoices")
      .select("id, invoice_number, customer_id, customer_name, customer_email, total, amount_paid, due_date, status")
      .neq("status", "cancelled")
      .neq("status", "paid")
      .lt("due_date", today)
      .not("customer_email", "is", null);

    if (invError) {
      console.error("Error fetching overdue invoices:", invError);
      throw invError;
    }

    if (!overdueInvoices || overdueInvoices.length === 0) {
      console.log("No overdue invoices found");
      return new Response(JSON.stringify({ message: "No overdue invoices", sent: 0 }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Group by customer
    const customerMap = new Map<string, typeof overdueInvoices>();
    for (const inv of overdueInvoices) {
      if (!inv.customer_email) continue;
      const balance = inv.total - inv.amount_paid;
      if (balance <= 0) continue;
      
      const key = inv.customer_email;
      if (!customerMap.has(key)) {
        customerMap.set(key, []);
      }
      customerMap.get(key)!.push(inv);
    }

    let sentCount = 0;
    const errors: string[] = [];

    for (const [email, invoices] of customerMap) {
      const customerName = invoices[0].customer_name;
      const totalOutstanding = invoices.reduce((sum, inv) => sum + (inv.total - inv.amount_paid), 0);
      
      const todayFormatted = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', month: 'long', day: 'numeric' 
      });

      const invoiceRows = invoices
        .map(inv => `
          <tr>
            <td style="padding:10px;border-bottom:1px solid #e9ecef;font-size:14px;">${sanitizeHtml(inv.invoice_number)}</td>
            <td style="padding:10px;border-bottom:1px solid #e9ecef;font-size:14px;">${inv.due_date || 'N/A'}</td>
            <td style="padding:10px;border-bottom:1px solid #e9ecef;font-size:14px;text-align:right;font-family:monospace;">$${inv.total.toFixed(2)}</td>
            <td style="padding:10px;border-bottom:1px solid #e9ecef;font-size:14px;text-align:right;font-family:monospace;">$${inv.amount_paid.toFixed(2)}</td>
            <td style="padding:10px;border-bottom:1px solid #e9ecef;font-size:14px;text-align:right;font-family:monospace;color:#dc2626;font-weight:600;">$${(inv.total - inv.amount_paid).toFixed(2)}</td>
          </tr>
        `)
        .join("");

      const html = `
        <!DOCTYPE html>
        <html>
        <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;background:#f5f5f5;">
          <div style="background:white;border-radius:8px;padding:30px;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
            <div style="text-align:center;border-bottom:2px solid #f59e0b;padding-bottom:20px;margin-bottom:20px;">
              <h1 style="color:#3b82f6;margin:0 0 10px;font-size:28px;">AFRIMMORE</h1>
              <p style="color:#f59e0b;font-weight:600;font-size:18px;margin:0;">Payment Reminder</p>
            </div>
            <p style="color:#666;font-size:14px;">${todayFormatted}</p>
            <p>Dear ${sanitizeHtml(customerName)},</p>
            <p>This is an automated reminder that you have <strong>overdue invoices</strong> on your account.</p>
            <div style="background:linear-gradient(135deg,#fef3c7,#fde68a);border:2px solid #f59e0b;border-radius:12px;padding:20px;text-align:center;margin:20px 0;">
              <div style="color:#92400e;font-size:14px;font-weight:500;">Total Outstanding</div>
              <div style="color:#92400e;font-size:32px;font-weight:bold;">$${totalOutstanding.toFixed(2)}</div>
            </div>
            <h3>Overdue Invoices</h3>
            <table style="width:100%;border-collapse:collapse;margin:20px 0;">
              <thead>
                <tr>
                  <th style="background:#f8f9fa;padding:12px;text-align:left;border-bottom:2px solid #e9ecef;font-weight:600;font-size:14px;">Invoice #</th>
                  <th style="background:#f8f9fa;padding:12px;text-align:left;border-bottom:2px solid #e9ecef;font-weight:600;font-size:14px;">Due Date</th>
                  <th style="background:#f8f9fa;padding:12px;text-align:right;border-bottom:2px solid #e9ecef;font-weight:600;font-size:14px;">Total</th>
                  <th style="background:#f8f9fa;padding:12px;text-align:right;border-bottom:2px solid #e9ecef;font-weight:600;font-size:14px;">Paid</th>
                  <th style="background:#f8f9fa;padding:12px;text-align:right;border-bottom:2px solid #e9ecef;font-weight:600;font-size:14px;">Balance</th>
                </tr>
              </thead>
              <tbody>${invoiceRows}</tbody>
            </table>
            <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:15px;margin:20px 0;border-radius:0 6px 6px 0;">
              <strong>Payment Options:</strong><br>
              Please contact us to arrange payment. We accept cash, card, mobile money, and bank transfers.
            </div>
            <p>If you have already made this payment, please disregard this reminder.</p>
            <div style="text-align:center;margin-top:30px;padding-top:20px;border-top:1px solid #e9ecef;color:#666;font-size:14px;">
              <p>Thank you for your business!</p>
            </div>
          </div>
        </body>
        </html>
      `;

      try {
        await resend.emails.send({
          from: "AFRIMMORE <onboarding@resend.dev>",
          to: [email],
          subject: `Payment Reminder - Outstanding Balance $${totalOutstanding.toFixed(2)}`,
          html,
        });
        sentCount++;
        console.log(`Reminder sent to ${email} for $${totalOutstanding.toFixed(2)}`);
      } catch (emailError: any) {
        console.error(`Failed to send to ${email}:`, emailError);
        errors.push(`${email}: ${emailError.message}`);
      }
    }

    console.log(`Sent ${sentCount} reminders, ${errors.length} failures`);

    return new Response(
      JSON.stringify({ 
        message: `Sent ${sentCount} payment reminders`, 
        sent: sentCount, 
        errors: errors.length > 0 ? errors : undefined 
      }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in scheduled-payment-reminder:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
