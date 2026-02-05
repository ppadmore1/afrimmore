 import { useState, useEffect } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { Tables } from "@/integrations/supabase/types";
 import { useToast } from "@/hooks/use-toast";
 
 type DiscountCode = Tables<"discount_codes">;
 
 export interface AppliedDiscount {
   code: DiscountCode;
   amount: number;
 }
 
 export function useDiscountCode(subtotal: number, customerId: string | null) {
   const { toast } = useToast();
   const [discountCodeInput, setDiscountCodeInput] = useState("");
   const [appliedDiscount, setAppliedDiscount] = useState<AppliedDiscount | null>(null);
   const [validating, setValidating] = useState(false);
 
   // Recalculate discount amount when subtotal changes
   useEffect(() => {
     if (appliedDiscount) {
       let newAmount = 0;
       if (appliedDiscount.code.discount_type === "percentage") {
         newAmount = (subtotal * appliedDiscount.code.discount_value) / 100;
         if (appliedDiscount.code.max_discount_amount && newAmount > appliedDiscount.code.max_discount_amount) {
           newAmount = appliedDiscount.code.max_discount_amount;
         }
       } else {
         newAmount = Math.min(appliedDiscount.code.discount_value, subtotal);
       }
 
       // Check if minimum is still met
       if (appliedDiscount.code.min_purchase_amount && subtotal < appliedDiscount.code.min_purchase_amount) {
         setAppliedDiscount(null);
         toast({
           title: "Discount Removed",
           description: "Cart no longer meets minimum purchase requirement",
         });
       } else if (newAmount !== appliedDiscount.amount) {
         setAppliedDiscount(prev => prev ? { ...prev, amount: newAmount } : null);
       }
     }
   }, [subtotal]);
 
   const applyCode = async () => {
     if (!discountCodeInput.trim()) return;
 
     setValidating(true);
     try {
       const codeUpper = discountCodeInput.trim().toUpperCase();
 
       // Fetch the discount code
       const { data: discountCode, error } = await supabase
         .from("discount_codes")
         .select("*")
         .eq("code", codeUpper)
         .eq("status", "active")
         .single();
 
       if (error || !discountCode) {
         toast({
           title: "Invalid Code",
           description: "This discount code is not valid",
           variant: "destructive",
         });
         return;
       }
 
       // Check validity period
       const now = new Date();
       if (new Date(discountCode.valid_from) > now) {
         toast({
           title: "Not Yet Valid",
           description: "This discount code is not yet active",
           variant: "destructive",
         });
         return;
       }
 
       if (discountCode.valid_until && new Date(discountCode.valid_until) < now) {
         toast({
           title: "Expired",
           description: "This discount code has expired",
           variant: "destructive",
         });
         return;
       }
 
       // Check usage limit
       if (discountCode.usage_limit && discountCode.usage_count &&
           discountCode.usage_count >= discountCode.usage_limit) {
         toast({
           title: "Usage Limit Reached",
           description: "This discount code has reached its usage limit",
           variant: "destructive",
         });
         return;
       }
 
       // Check minimum purchase amount
       if (discountCode.min_purchase_amount && subtotal < discountCode.min_purchase_amount) {
         toast({
           title: "Minimum Not Met",
           description: `Minimum purchase of $${discountCode.min_purchase_amount.toFixed(2)} required`,
           variant: "destructive",
         });
         return;
       }
 
       // Check per-customer limit if customer is selected
       if (customerId && discountCode.per_customer_limit) {
         const { count } = await supabase
           .from("discount_code_usage")
           .select("*", { count: "exact", head: true })
           .eq("discount_code_id", discountCode.id)
           .eq("customer_id", customerId);
 
         if (count && count >= discountCode.per_customer_limit) {
           toast({
             title: "Limit Reached",
             description: "This customer has already used this code the maximum number of times",
             variant: "destructive",
           });
           return;
         }
       }
 
       // Calculate discount amount
       let discountAmount = 0;
       if (discountCode.discount_type === "percentage") {
         discountAmount = (subtotal * discountCode.discount_value) / 100;
         if (discountCode.max_discount_amount && discountAmount > discountCode.max_discount_amount) {
           discountAmount = discountCode.max_discount_amount;
         }
       } else {
         discountAmount = Math.min(discountCode.discount_value, subtotal);
       }
 
       setAppliedDiscount({
         code: discountCode,
         amount: discountAmount,
       });
 
       toast({
         title: "Discount Applied!",
         description: `${discountCode.name} - $${discountAmount.toFixed(2)} off`,
       });
     } catch (error) {
       console.error("Error validating discount code:", error);
       toast({
         title: "Error",
         description: "Failed to validate discount code",
         variant: "destructive",
       });
     } finally {
       setValidating(false);
     }
   };
 
   const removeCode = () => {
     setAppliedDiscount(null);
     setDiscountCodeInput("");
   };
 
   const reset = () => {
     setAppliedDiscount(null);
     setDiscountCodeInput("");
   };
 
   const recordUsage = async (posSaleId: string) => {
     if (!appliedDiscount) return;
     
     try {
       await supabase.from("discount_code_usage").insert({
         discount_code_id: appliedDiscount.code.id,
         customer_id: customerId,
         pos_sale_id: posSaleId,
         discount_amount: appliedDiscount.amount,
       });
     } catch (error) {
       console.error("Error recording discount usage:", error);
     }
   };
 
   return {
     discountCodeInput,
     setDiscountCodeInput,
     appliedDiscount,
     validating,
     applyCode,
     removeCode,
     reset,
     recordUsage,
     couponDiscount: appliedDiscount?.amount || 0,
   };
 }