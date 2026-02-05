 import { useCallback } from "react";
 import { supabase } from "@/integrations/supabase/client";
 
 type LogActivityParams = {
   action: "create" | "update" | "delete" | "view" | "login" | "logout" | "export" | "import";
   entityType: string;
   entityId?: string;
   entityName?: string;
   oldValues?: Record<string, any>;
   newValues?: Record<string, any>;
   metadata?: Record<string, any>;
 };
 
 export function useActivityLog() {
   const logActivity = useCallback(async ({
     action,
     entityType,
     entityId,
     entityName,
     oldValues,
     newValues,
     metadata = {},
   }: LogActivityParams) => {
     try {
       const { error } = await supabase.rpc("log_activity", {
         p_action: action,
         p_entity_type: entityType,
         p_entity_id: entityId || null,
         p_entity_name: entityName || null,
         p_old_values: oldValues ? JSON.stringify(oldValues) : null,
         p_new_values: newValues ? JSON.stringify(newValues) : null,
         p_metadata: JSON.stringify(metadata),
       });
 
       if (error) {
         console.error("Failed to log activity:", error);
       }
     } catch (err) {
       console.error("Activity logging error:", err);
     }
   }, []);
 
   return { logActivity };
 }