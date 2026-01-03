import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface StockAlertItem {
  product_name: string;
  sku: string | null;
  current_stock: number;
  low_stock_threshold: number;
  avg_daily_sales: number;
  days_of_stock: number;
  suggested_order_qty: number;
  urgency: "critical" | "high" | "medium" | "low";
}

interface StockAlertRequest {
  recipientEmail: string;
  branchName: string;
  items: StockAlertItem[];
  analysisPeriod: string;
  targetDays: string;
}

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

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

function generateAlertHtml(data: StockAlertRequest): string {
  const today = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const criticalItems = data.items.filter(i => i.urgency === 'critical');
  const highItems = data.items.filter(i => i.urgency === 'high');
  const totalUnits = data.items.reduce((sum, i) => sum + i.suggested_order_qty, 0);

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return '#dc2626';
      case 'high': return '#f97316';
      case 'medium': return '#eab308';
      default: return '#6b7280';
    }
  };

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Stock Alert</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
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
            border-bottom: 2px solid #dc2626;
            padding-bottom: 20px;
            margin-bottom: 20px;
          }
          .header h1 {
            color: #3b82f6;
            margin: 0 0 10px 0;
            font-size: 28px;
          }
          .header .subtitle {
            color: #dc2626;
            font-weight: 600;
            font-size: 18px;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin: 20px 0;
          }
          .summary-card {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 15px;
            text-align: center;
          }
          .summary-card.critical {
            background: #fef2f2;
            border: 1px solid #fecaca;
          }
          .summary-card.high {
            background: #fff7ed;
            border: 1px solid #fed7aa;
          }
          .summary-card .label {
            font-size: 12px;
            color: #666;
            margin-bottom: 5px;
          }
          .summary-card .value {
            font-size: 24px;
            font-weight: bold;
          }
          .summary-card.critical .value { color: #dc2626; }
          .summary-card.high .value { color: #f97316; }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 13px;
          }
          th {
            background: #f8f9fa;
            padding: 12px 8px;
            text-align: left;
            border-bottom: 2px solid #e9ecef;
            font-weight: 600;
            color: #495057;
          }
          td {
            padding: 10px 8px;
            border-bottom: 1px solid #e9ecef;
          }
          .urgency-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            color: white;
          }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .mono { font-family: monospace; }
          .bold { font-weight: bold; }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
            color: #666;
            font-size: 14px;
          }
          .info-box {
            background: #eff6ff;
            border-left: 4px solid #3b82f6;
            padding: 15px;
            margin: 20px 0;
            border-radius: 0 6px 6px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>AFRIMMORE</h1>
            <p class="subtitle">⚠️ Stock Alert - Action Required</p>
          </div>
          
          <p><strong>Branch:</strong> ${sanitizeHtml(data.branchName)}</p>
          <p><strong>Date:</strong> ${today}</p>
          
          <div class="summary-grid">
            <div class="summary-card critical">
              <div class="label">Critical Items</div>
              <div class="value">${criticalItems.length}</div>
            </div>
            <div class="summary-card high">
              <div class="label">High Priority</div>
              <div class="value">${highItems.length}</div>
            </div>
            <div class="summary-card">
              <div class="label">Total Units to Order</div>
              <div class="value" style="color: #3b82f6;">${totalUnits.toLocaleString()}</div>
            </div>
          </div>
          
          <div class="info-box">
            <strong>Analysis Parameters:</strong><br>
            Based on ${data.analysisPeriod}-day sales velocity, targeting ${data.targetDays} days of stock coverage.
          </div>
          
          <h3>Items Requiring Reorder</h3>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th class="text-center">Urgency</th>
                <th class="text-right">Current Stock</th>
                <th class="text-right">Avg/Day</th>
                <th class="text-right">Days Left</th>
                <th class="text-right">Suggested Order</th>
              </tr>
            </thead>
            <tbody>
              ${data.items.map(item => `
                <tr>
                  <td>${sanitizeHtml(item.product_name)}</td>
                  <td class="mono">${item.sku ? sanitizeHtml(item.sku) : '-'}</td>
                  <td class="text-center">
                    <span class="urgency-badge" style="background-color: ${getUrgencyColor(item.urgency)}">
                      ${item.urgency}
                    </span>
                  </td>
                  <td class="text-right mono">${item.current_stock}</td>
                  <td class="text-right mono">${item.avg_daily_sales.toFixed(1)}</td>
                  <td class="text-right mono">${item.days_of_stock === 999 ? '∞' : item.days_of_stock.toFixed(0)}</td>
                  <td class="text-right mono bold" style="color: #3b82f6;">+${item.suggested_order_qty}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="footer">
            <p>This is an automated stock alert from your inventory management system.</p>
            <p>Please review and take action on critical items promptly.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-stock-alert function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("User not authenticated:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

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

    console.log("User authenticated:", user.id);

    const data: StockAlertRequest = await req.json();
    console.log("Sending stock alert to:", data.recipientEmail, "for branch:", data.branchName);

    if (!data.recipientEmail || !isValidEmail(data.recipientEmail)) {
      return new Response(
        JSON.stringify({ error: "Valid recipient email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!data.items || data.items.length === 0) {
      return new Response(
        JSON.stringify({ error: "No items to alert" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const criticalCount = data.items.filter(i => i.urgency === 'critical').length;
    const subject = criticalCount > 0 
      ? `🚨 CRITICAL: ${criticalCount} items need immediate reorder - ${data.branchName}`
      : `📦 Stock Alert: ${data.items.length} items need reorder - ${data.branchName}`;

    const html = generateAlertHtml(data);

    const emailResponse = await resend.emails.send({
      from: "AFRIMMORE Stock Alerts <onboarding@resend.dev>",
      to: [data.recipientEmail],
      subject: subject,
      html: html,
    });

    console.log("Stock alert sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, data: emailResponse }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-stock-alert function:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send stock alert" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
