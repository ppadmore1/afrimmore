import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DocumentItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface SendDocumentEmailParams {
  type: "invoice" | "quotation";
  documentNumber: string;
  customerName: string;
  customerEmail: string;
  items: DocumentItem[];
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  total: number;
  dueDate?: string;
  validUntil?: string;
  notes?: string;
}

export function useSendDocumentEmail() {
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  const sendEmail = async (params: SendDocumentEmailParams): Promise<boolean> => {
    if (!params.customerEmail) {
      toast({
        title: "No Email Address",
        description: "Customer email address is required to send the document.",
        variant: "destructive",
      });
      return false;
    }

    setIsSending(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-document-email", {
        body: params,
      });

      if (error) {
        console.error("Error sending email:", error);
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      const docType = params.type === "invoice" ? "Invoice" : "Quotation";
      toast({
        title: "Email Sent",
        description: `${docType} sent successfully to ${params.customerEmail}`,
      });

      return true;
    } catch (error: any) {
      console.error("Failed to send email:", error);
      toast({
        title: "Failed to Send Email",
        description: error.message || "An error occurred while sending the email",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsSending(false);
    }
  };

  return { sendEmail, isSending };
}
