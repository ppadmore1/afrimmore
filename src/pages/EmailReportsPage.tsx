import { useEffect, useState } from "react";
import { Mail, Save } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useBranch } from "@/contexts/BranchContext";
import { useToast } from "@/hooks/use-toast";

interface Row { id?: string; branch_id: string | null; enabled: boolean; recipients: string; send_time: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailReportsPage() {
  const { branches } = useBranch();
  const { toast } = useToast();
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [saving, setSaving] = useState(false);
  const key = (b: string | null) => b ?? "all";

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("email_report_settings").select("*");
      const map: Record<string, Row> = {};
      [null, ...branches.map((b) => b.id)].forEach((id) => {
        const found = data?.find((d) => d.branch_id === id);
        map[key(id)] = found
          ? { id: found.id, branch_id: id, enabled: found.enabled, recipients: found.recipients.join(", "), send_time: found.send_time }
          : { branch_id: id, enabled: false, recipients: "", send_time: "20:00" };
      });
      setRows(map);
    })();
  }, [branches]);

  const update = (k: string, patch: Partial<Row>) => setRows((r) => ({ ...r, [k]: { ...r[k], ...patch } }));

  const save = async () => {
    const payload = Object.values(rows).map((r) => ({
      ...(r.id ? { id: r.id } : {}),
      branch_id: r.branch_id,
      enabled: r.enabled,
      send_time: r.send_time,
      recipients: r.recipients.split(/[,;\s]+/).map((e) => e.trim()).filter(Boolean),
    }));
    const bad = payload.flatMap((p) => p.recipients).find((e) => !EMAIL_RE.test(e));
    if (bad) return toast({ title: "Invalid email", description: bad, variant: "destructive" });
    const missing = payload.find((p) => p.enabled && p.recipients.length === 0);
    if (missing) return toast({ title: "Add at least one recipient for each report that is switched on", variant: "destructive" });
    setSaving(true);
    for (const p of payload) {
      const { error } = p.id
        ? await supabase.from("email_report_settings").update(p).eq("id", p.id)
        : await supabase.from("email_report_settings").insert(p);
      if (error) { setSaving(false); return toast({ title: "Could not save", description: error.message, variant: "destructive" }); }
    }
    setSaving(false);
    toast({ title: "Report settings saved" });
  };

  const renderRow = (label: string, k: string) => {
    const r = rows[k];
    if (!r) return null;
    return (
      <div key={k} className="grid gap-3 md:grid-cols-[1fr_2fr_auto_auto] items-center border-b py-4 last:border-0">
        <div className="font-medium">{label}</div>
        <Input placeholder="manager@company.com, owner@company.com" value={r.recipients} onChange={(e) => update(k, { recipients: e.target.value })} />
        <Input type="time" className="w-32" value={r.send_time} onChange={(e) => update(k, { send_time: e.target.value })} />
        <Switch checked={r.enabled} onCheckedChange={(v) => update(k, { enabled: v })} />
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Mail className="w-6 h-6 text-primary" />Daily Email Reports</h1>
            <p className="text-muted-foreground">Choose which branch reports go out, who receives them and when (Liberia time).</p>
          </div>
          <Button onClick={save} disabled={saving}><Save className="w-4 h-4 mr-2" />Save</Button>
        </div>
        <Card className="border-warning">
          <CardContent className="pt-6 text-sm">Reports will start sending once your company email domain is connected. Your settings are saved now.</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Reports</CardTitle>
            <CardDescription>Recipients · Send time · On/Off</CardDescription>
          </CardHeader>
          <CardContent>
            {renderRow("All branches (overall)", "all")}
            {branches.map((b) => renderRow(b.name, b.id))}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
