 import { useState, useEffect } from "react";
 import { useAuth } from "@/contexts/AuthContext";
 import { supabase } from "@/integrations/supabase/client";
 import { AppLayout } from "@/components/layout/AppLayout";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
 import { toast } from "@/hooks/use-toast";
 import { Loader2, Camera, User, Mail, Phone, Save } from "lucide-react";
 
 interface Profile {
   id: string;
   full_name: string | null;
   email: string | null;
   phone: string | null;
   avatar_url: string | null;
 }
 
 export default function ProfilePage() {
   const { user } = useAuth();
   const [loading, setLoading] = useState(true);
   const [saving, setSaving] = useState(false);
   const [uploading, setUploading] = useState(false);
   const [profile, setProfile] = useState<Profile | null>(null);
   const [fullName, setFullName] = useState("");
   const [phone, setPhone] = useState("");
 
   useEffect(() => {
     if (user) {
       fetchProfile();
     }
   }, [user]);
 
   const fetchProfile = async () => {
     try {
       const { data, error } = await supabase
         .from("profiles")
         .select("*")
         .eq("id", user?.id)
         .single();
 
       if (error && error.code !== "PGRST116") {
         throw error;
       }
 
       if (data) {
         setProfile(data);
         setFullName(data.full_name || "");
         setPhone(data.phone || "");
       } else {
         // Profile doesn't exist, use auth metadata
         setFullName(user?.user_metadata?.full_name || "");
       }
     } catch (error) {
       console.error("Error fetching profile:", error);
     } finally {
       setLoading(false);
     }
   };
 
   const handleSave = async () => {
     if (!user) return;
 
     setSaving(true);
     try {
       const { error } = await supabase
         .from("profiles")
         .update({
           full_name: fullName,
           phone: phone,
           updated_at: new Date().toISOString(),
         })
         .eq("id", user.id);
 
       if (error) throw error;
 
       // Also update auth metadata
       await supabase.auth.updateUser({
         data: { full_name: fullName }
       });
 
       toast({
         title: "Profile updated",
         description: "Your profile has been saved successfully.",
       });
 
       fetchProfile();
     } catch (error: any) {
       toast({
         title: "Error",
         description: error.message || "Failed to update profile",
         variant: "destructive",
       });
     } finally {
       setSaving(false);
     }
   };
 
   const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
     const file = event.target.files?.[0];
     if (!file || !user) return;
 
     // Validate file type
     if (!file.type.startsWith("image/")) {
       toast({
         title: "Invalid file type",
         description: "Please upload an image file.",
         variant: "destructive",
       });
       return;
     }
 
     // Validate file size (max 2MB)
     if (file.size > 2 * 1024 * 1024) {
       toast({
         title: "File too large",
         description: "Please upload an image smaller than 2MB.",
         variant: "destructive",
       });
       return;
     }
 
     setUploading(true);
     try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;
 
       // Upload to storage
       const { error: uploadError } = await supabase.storage
         .from("avatars")
         .upload(filePath, file, { upsert: true });
 
       if (uploadError) throw uploadError;
 
       // Get public URL
       const { data: { publicUrl } } = supabase.storage
         .from("avatars")
         .getPublicUrl(filePath);
 
       // Update profile with avatar URL
       const { error: updateError } = await supabase
         .from("profiles")
         .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
         .eq("id", user.id);
 
       if (updateError) throw updateError;
 
       toast({
         title: "Avatar updated",
         description: "Your profile picture has been updated.",
       });
 
       fetchProfile();
     } catch (error: any) {
       toast({
         title: "Upload failed",
         description: error.message || "Failed to upload avatar",
         variant: "destructive",
       });
     } finally {
       setUploading(false);
     }
   };
 
   const userInitials = fullName
     ? fullName.split(" ").map((n) => n[0]).join("").toUpperCase()
     : user?.email?.substring(0, 2).toUpperCase() || "U";
 
   if (loading) {
     return (
       <AppLayout>
         <div className="flex items-center justify-center h-64">
           <Loader2 className="h-8 w-8 animate-spin text-primary" />
         </div>
       </AppLayout>
     );
   }
 
   return (
     <AppLayout>
       <div className="space-y-6 max-w-2xl mx-auto">
         <div>
           <h1 className="text-3xl font-bold text-foreground">My Profile</h1>
           <p className="text-muted-foreground">Manage your personal information</p>
         </div>
 
         <Card>
           <CardHeader>
             <CardTitle>Profile Picture</CardTitle>
             <CardDescription>Upload a photo to personalize your account</CardDescription>
           </CardHeader>
           <CardContent className="flex items-center gap-6">
             <div className="relative">
               <Avatar className="h-24 w-24">
                 <AvatarImage src={profile?.avatar_url || undefined} alt={fullName} />
                 <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                   {userInitials}
                 </AvatarFallback>
               </Avatar>
               <label
                 htmlFor="avatar-upload"
                 className="absolute bottom-0 right-0 p-1.5 bg-primary text-primary-foreground rounded-full cursor-pointer hover:bg-primary/90 transition-colors"
               >
                 {uploading ? (
                   <Loader2 className="h-4 w-4 animate-spin" />
                 ) : (
                   <Camera className="h-4 w-4" />
                 )}
               </label>
               <input
                 id="avatar-upload"
                 type="file"
                 accept="image/*"
                 className="hidden"
                 onChange={handleAvatarUpload}
                 disabled={uploading}
               />
             </div>
             <div className="text-sm text-muted-foreground">
               <p>Click the camera icon to upload a new photo.</p>
               <p>Recommended: Square image, max 2MB.</p>
             </div>
           </CardContent>
         </Card>
 
         <Card>
           <CardHeader>
             <CardTitle>Personal Information</CardTitle>
             <CardDescription>Update your personal details</CardDescription>
           </CardHeader>
           <CardContent className="space-y-4">
             <div className="space-y-2">
               <Label htmlFor="email" className="flex items-center gap-2">
                 <Mail className="h-4 w-4" />
                 Email
               </Label>
               <Input
                 id="email"
                 type="email"
                 value={user?.email || ""}
                 disabled
                 className="bg-muted"
               />
               <p className="text-xs text-muted-foreground">Email cannot be changed</p>
             </div>
 
             <div className="space-y-2">
               <Label htmlFor="fullName" className="flex items-center gap-2">
                 <User className="h-4 w-4" />
                 Full Name
               </Label>
               <Input
                 id="fullName"
                 value={fullName}
                 onChange={(e) => setFullName(e.target.value)}
                 placeholder="Enter your full name"
               />
             </div>
 
             <div className="space-y-2">
               <Label htmlFor="phone" className="flex items-center gap-2">
                 <Phone className="h-4 w-4" />
                 Phone Number
               </Label>
               <Input
                 id="phone"
                 value={phone}
                 onChange={(e) => setPhone(e.target.value)}
                 placeholder="Enter your phone number"
               />
             </div>
 
             <Button onClick={handleSave} disabled={saving} className="w-full mt-4">
               {saving ? (
                 <>
                   <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                   Saving...
                 </>
               ) : (
                 <>
                   <Save className="mr-2 h-4 w-4" />
                   Save Changes
                 </>
               )}
             </Button>
           </CardContent>
         </Card>
       </div>
     </AppLayout>
   );
 }