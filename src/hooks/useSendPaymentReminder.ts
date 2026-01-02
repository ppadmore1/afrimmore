import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Invoice {
  invoiceNumber: string;
  total: number;
  amountPaid: number;
  dueDate?: string;
}

interface SendReminderParams {
  customerId: string;
  customerName: string;
  customerEmail: string;
  outstandingBalance: number;
  invoices: Invoice[];
}

export function useSendPaymentReminder() {
  const [sending, setSending] = useState(false);

  const sendReminder = async (params: SendReminderParams): Promise<boolean> => {
    if (!params.customerEmail) {
      toast({
        title: "Cannot send reminder",
        description: "Customer email is required",
        variant: "destructive",
      });
      return false;
    }

    if (params.outstandingBalance <= 0) {
      toast({
        title: "No outstanding balance",
        description: "This customer has no outstanding balance",
        variant: "destructive",
      });
      return false;
    }

    if (params.invoices.length === 0) {
      toast({
        title: "No outstanding invoices",
        description: "This customer has no outstanding invoices",
        variant: "destructive",
      });
      return false;
    }

    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-payment-reminder", {
        body: params,
      });

      if (error) {
        console.error("Error sending payment reminder:", error);
        toast({
          title: "Failed to send reminder",
          description: error.message || "Please try again later",
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Payment reminder sent!",
        description: `Reminder sent to ${params.customerEmail}`,
      });

      return true;
    } catch (error) {
      console.error("Error sending payment reminder:", error);
      toast({
        title: "Failed to send reminder",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
      return false;
    } finally {
      setSending(false);
    }
  };

  return { sendReminder, sending };
}
