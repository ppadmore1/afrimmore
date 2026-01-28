import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface InviteRequest {
  email: string;
  role: string;
  branchNames: string[];
  inviterName: string;
  signupUrl: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { email, role, branchNames, inviterName, signupUrl }: InviteRequest = await req.json();

    if (!email || !role || !signupUrl) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
    const branchList = branchNames?.length > 0 
      ? branchNames.join(", ") 
      : "All branches (Admin access)";

    console.log(`Sending invite to ${email} as ${role}`);

    const emailResponse = await resend.emails.send({
      from: "Invitations <onboarding@resend.dev>",
      to: [email],
      subject: `You've been invited to join the team`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">You're Invited!</h1>
          </div>
          
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="font-size: 16px; margin-bottom: 20px;">
              Hello,
            </p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              <strong>${inviterName || "An administrator"}</strong> has invited you to join the team as a <strong>${roleLabel}</strong>.
            </p>
            
            <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">Your assigned role:</p>
              <p style="margin: 0; font-size: 16px; font-weight: 600; color: #1f2937;">${roleLabel}</p>
              ${role !== 'admin' ? `
              <p style="margin: 12px 0 8px 0; font-size: 14px; color: #6b7280;">Branch access:</p>
              <p style="margin: 0; font-size: 16px; font-weight: 600; color: #1f2937;">${branchList}</p>
              ` : ''}
            </div>
            
            <p style="font-size: 16px; margin-bottom: 25px;">
              Click the button below to create your account and get started:
            </p>
            
            <div style="text-align: center; margin-bottom: 25px;">
              <a href="${signupUrl}" style="display: inline-block; background: linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Create Your Account
              </a>
            </div>
            
            <p style="font-size: 14px; color: #6b7280; margin-bottom: 0;">
              If you didn't expect this invitation, you can safely ignore this email.
            </p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
            <p style="margin: 0;">This invitation was sent automatically. Please do not reply to this email.</p>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Invitation email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending invitation:", error);
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
