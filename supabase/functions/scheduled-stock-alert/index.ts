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
  branch_name: string;
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

function generateAlertHtml(items: StockAlertItem[], branchNames: string[]): string {
  const today = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const criticalItems = items.filter(i => i.urgency === 'critical');
  const highItems = items.filter(i => i.urgency === 'high');
  const totalUnits = items.reduce((sum, i) => sum + i.suggested_order_qty, 0);

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
        <title>Daily Stock Alert</title>
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
            font-size: 12px;
          }
          th {
            background: #f8f9fa;
            padding: 10px 6px;
            text-align: left;
            border-bottom: 2px solid #e9ecef;
            font-weight: 600;
            color: #495057;
          }
          td {
            padding: 8px 6px;
            border-bottom: 1px solid #e9ecef;
          }
          .urgency-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 10px;
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
            <p class="subtitle">🔔 Daily Stock Alert</p>
          </div>
          
          <p><strong>Branches:</strong> ${branchNames.map(b => sanitizeHtml(b)).join(', ')}</p>
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
            <strong>Automated Daily Alert</strong><br>
            This alert shows products that need restocking based on 30-day sales velocity, targeting 30 days of stock coverage.
          </div>
          
          <h3>Items Requiring Reorder</h3>
          <table>
            <thead>
              <tr>
                <th>Branch</th>
                <th>Product</th>
                <th>SKU</th>
                <th class="text-center">Urgency</th>
                <th class="text-right">Stock</th>
                <th class="text-right">Days Left</th>
                <th class="text-right">Order Qty</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(item => `
                <tr>
                  <td>${sanitizeHtml(item.branch_name)}</td>
                  <td>${sanitizeHtml(item.product_name)}</td>
                  <td class="mono">${item.sku ? sanitizeHtml(item.sku) : '-'}</td>
                  <td class="text-center">
                    <span class="urgency-badge" style="background-color: ${getUrgencyColor(item.urgency)}">
                      ${item.urgency}
                    </span>
                  </td>
                  <td class="text-right mono">${item.current_stock}</td>
                  <td class="text-right mono">${item.days_of_stock === 999 ? '∞' : item.days_of_stock.toFixed(0)}</td>
                  <td class="text-right mono bold" style="color: #3b82f6;">+${item.suggested_order_qty}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="footer">
            <p>This is an automated daily stock alert from your inventory management system.</p>
            <p>Please review and take action on critical items promptly.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("scheduled-stock-alert function called at:", new Date().toISOString());

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase configuration");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Use service role key for scheduled tasks
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the purchasing team email from settings
    const { data: setting, error: settingError } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'purchasing_team_email')
      .single();

    if (settingError || !setting?.value) {
      console.log("No purchasing email configured, skipping alert");
      return new Response(
        JSON.stringify({ message: "No purchasing email configured" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const recipientEmail = setting.value;
    console.log("Sending daily alert to:", recipientEmail);

    // Get all active branches
    const { data: branches, error: branchError } = await supabase
      .from('branches')
      .select('id, name')
      .eq('is_active', true);

    if (branchError || !branches?.length) {
      console.log("No active branches found");
      return new Response(
        JSON.stringify({ message: "No active branches" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get all products
    const { data: products, error: prodError } = await supabase
      .from('products')
      .select('id, name, sku, low_stock_threshold')
      .eq('is_active', true);

    if (prodError || !products?.length) {
      console.log("No active products found");
      return new Response(
        JSON.stringify({ message: "No active products" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get branch inventory
    const { data: branchInventory, error: invError } = await supabase
      .from('product_branches')
      .select('product_id, branch_id, stock_quantity, low_stock_threshold');

    if (invError) throw invError;

    // Get sales data for the past 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: salesData, error: salesError } = await supabase
      .from('pos_sale_items')
      .select(`
        product_id,
        quantity,
        pos_sales!inner (
          branch_id,
          created_at,
          status
        )
      `)
      .eq('pos_sales.status', 'paid')
      .gte('pos_sales.created_at', thirtyDaysAgo.toISOString());

    if (salesError) throw salesError;

    // Build sales by product and branch
    const salesByProductBranch: Record<string, Record<string, number>> = {};
    salesData?.forEach((item: any) => {
      if (item.product_id && item.pos_sales?.branch_id) {
        if (!salesByProductBranch[item.product_id]) {
          salesByProductBranch[item.product_id] = {};
        }
        const branchId = item.pos_sales.branch_id;
        salesByProductBranch[item.product_id][branchId] = 
          (salesByProductBranch[item.product_id][branchId] || 0) + Number(item.quantity);
      }
    });

    // Build inventory map
    const inventoryMap: Record<string, Record<string, { stock: number; threshold: number }>> = {};
    branchInventory?.forEach(inv => {
      if (!inventoryMap[inv.product_id]) {
        inventoryMap[inv.product_id] = {};
      }
      inventoryMap[inv.product_id][inv.branch_id] = {
        stock: inv.stock_quantity,
        threshold: inv.low_stock_threshold || 10,
      };
    });

    // Calculate alerts - only critical and high priority
    const alertItems: StockAlertItem[] = [];
    const branchMap = new Map(branches.map(b => [b.id, b.name]));

    for (const branch of branches) {
      for (const product of products) {
        const totalSold = salesByProductBranch[product.id]?.[branch.id] || 0;
        const avgDailySales = totalSold / 30;
        const currentStock = inventoryMap[product.id]?.[branch.id]?.stock || 0;
        const threshold = inventoryMap[product.id]?.[branch.id]?.threshold || product.low_stock_threshold || 10;
        
        const daysOfStock = avgDailySales > 0 ? currentStock / avgDailySales : currentStock > 0 ? 999 : 0;
        const targetStock = avgDailySales * 30; // 30 days coverage
        const suggestedOrderQty = Math.max(0, Math.ceil(targetStock - currentStock));
        
        let urgency: "critical" | "high" | "medium" | "low" = "low";
        if (currentStock === 0 && avgDailySales > 0) {
          urgency = "critical";
        } else if (daysOfStock <= 7 && avgDailySales > 0) {
          urgency = "critical";
        } else if (daysOfStock <= 14 && avgDailySales > 0) {
          urgency = "high";
        } else if (currentStock <= threshold) {
          urgency = "medium";
        }

        // Only include critical and high priority for automated alerts
        if (urgency === "critical" || urgency === "high") {
          alertItems.push({
            product_name: product.name,
            sku: product.sku,
            current_stock: currentStock,
            low_stock_threshold: threshold,
            avg_daily_sales: avgDailySales,
            days_of_stock: daysOfStock,
            suggested_order_qty: suggestedOrderQty,
            urgency,
            branch_name: branch.name,
          });
        }
      }
    }

    if (alertItems.length === 0) {
      console.log("No critical or high priority items found, skipping email");
      return new Response(
        JSON.stringify({ message: "No critical items to alert" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Sort by urgency and days of stock
    alertItems.sort((a, b) => {
      const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      }
      return a.days_of_stock - b.days_of_stock;
    });

    const branchNames = [...new Set(alertItems.map(i => i.branch_name))];
    const criticalCount = alertItems.filter(i => i.urgency === 'critical').length;
    
    const subject = criticalCount > 0 
      ? `🚨 Daily Alert: ${criticalCount} CRITICAL items need immediate reorder`
      : `📦 Daily Stock Alert: ${alertItems.length} items need attention`;

    const html = generateAlertHtml(alertItems, branchNames);

    console.log(`Sending alert with ${alertItems.length} items (${criticalCount} critical)`);

    const emailResponse = await resend.emails.send({
      from: "AFRIMMORE Stock Alerts <onboarding@resend.dev>",
      to: [recipientEmail],
      subject: subject,
      html: html,
    });

    console.log("Daily stock alert sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        itemsAlerted: alertItems.length,
        criticalItems: criticalCount,
        email: emailResponse 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in scheduled-stock-alert function:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send scheduled stock alert", details: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
