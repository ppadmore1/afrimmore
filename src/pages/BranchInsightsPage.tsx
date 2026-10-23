import { useEffect, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lightbulb, Loader2, Send } from "lucide-react";

const SUGGESTIONS = [
  "How did my branch perform this month and what should I improve?",
  "Which products should I reorder this week?",
  "Which payment methods are customers using most?",
  "What are my busiest days and slowest products?",
  "Which cashier has the highest sales?",
];

function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>
  );
}

function Answer({ text }: { text: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed text-foreground">
      {text.split("\n").map((line, i) => {
        const t = line.trim();
        if (!t) return null;
        if (/^#{1,6}\s/.test(t)) return <p key={i} className="font-semibold pt-2">{renderInline(t.replace(/^#+\s/, ""))}</p>;
        if (/^[-*•]\s/.test(t)) return <p key={i} className="pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-primary">{renderInline(t.replace(/^[-*•]\s/, ""))}</p>;
        if (/^\d+\.\s/.test(t)) return <p key={i} className="pl-4">{renderInline(t)}</p>;
        return <p key={i}>{renderInline(t)}</p>;
      })}
    </div>
  );
}

export default function BranchInsightsPage() {
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [branchId, setBranchId] = useState("all");
  const [days, setDays] = useState("30");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ revenue: number; transactions: number; branch: string; period: string } | null>(null);

  useEffect(() => {
    supabase.from("branches").select("id,name").eq("is_active", true).order("name").then(({ data }) => setBranches(data || []));
  }, []);

  async function ask(q?: string) {
    const text = (q ?? question).trim();
    if (text.length < 3) return;
    setQuestion(text);
    setLoading(true); setError(null); setAnswer(null);
    const { data, error } = await supabase.functions.invoke("branch-insights", {
      body: { question: text, branchId: branchId === "all" ? null : branchId, days: Number(days) },
    });
    setLoading(false);
    if (error) {
      let msg = "Something went wrong. Please try again.";
      if (error instanceof FunctionsHttpError) {
        try { msg = (await error.context.json()).error || msg; } catch { /* keep default */ }
      }
      setError(msg);
      return;
    }
    setAnswer(data.answer);
    setSummary(data.summary);
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2"><Lightbulb className="w-7 h-7 text-primary" /> Branch Insights</h1>
          <p className="text-muted-foreground mt-1">Ask a question about your branch's sales, payments and stock — get a short answer with actions.</p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger aria-label="Branch"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All my branches</SelectItem>
                  {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={days} onValueChange={setDays}>
                <SelectTrigger aria-label="Period"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Today</SelectItem>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Textarea
              aria-label="Your question"
              placeholder="e.g. Why were sales lower this week, and what should I do?"
              value={question}
              maxLength={500}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }}
              rows={3}
            />
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <Button key={s} variant="outline" size="sm" className="h-auto py-1.5 text-xs whitespace-normal text-left" disabled={loading} onClick={() => ask(s)}>{s}</Button>
              ))}
            </div>
            <Button onClick={() => ask()} disabled={loading || question.trim().length < 3}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              {loading ? "Analyzing your data…" : "Ask"}
            </Button>
          </CardContent>
        </Card>

        {error && <Card className="border-destructive"><CardContent className="pt-6 text-destructive text-sm">{error}</CardContent></Card>}

        {answer && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Answer</CardTitle>
              {summary && (
                <p className="text-xs text-muted-foreground">
                  Based on {summary.transactions} sales (${summary.revenue.toLocaleString()}) · {summary.branch} · {summary.period}
                </p>
              )}
            </CardHeader>
            <CardContent><Answer text={answer} /></CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
