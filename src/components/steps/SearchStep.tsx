import { useState, useEffect } from "react";
import { CampaignConfig, Lead, ScoredLead } from "@/hooks/useWizard";
import { HARDCODED_LEADS } from "@/data/hardcoded-leads";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ICPForm } from "@/components/steps/ICPForm";
import { Plus, ChevronRight, ArrowLeft, Pencil, Check, Users } from "lucide-react";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";


interface Props {
  config: CampaignConfig;
  setConfig: (c: CampaignConfig) => void;
  leads: Lead[];
  setLeads: (l: Lead[]) => void;
  setScoredLeads: (l: ScoredLead[]) => void;
  onComplete: () => void;
  setIsInsideList: (v: boolean) => void;
}

interface ListItem {
  id: string;
  name: string;
  profile: string;
  geo_mix: Record<string, number>;
  quantity: number;
  frequency: string;
  lead_count: number;
  created_at: string;
}

const COUNTRY_COLORS: Record<string, string> = {
  Argentina: "bg-blue-500/15 text-blue-300 border-blue-500/20",
  Colombia: "bg-yellow-500/15 text-yellow-300 border-yellow-500/20",
  Chile: "bg-red-500/15 text-red-300 border-red-500/20",
  México: "bg-green-500/15 text-green-300 border-green-500/20",
  Brasil: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
  USA: "bg-purple-500/15 text-purple-300 border-purple-500/20",
};

const QUARTILE_STYLES = {
  Q1: { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20", label: "Top Fit" },
  Q2: { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/20", label: "Buen Fit" },
  Q3: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", label: "Fit Moderado" },
  Q4: { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/20", label: "Fit Bajo" },
};

function scoreAndAssign(leads: Lead[]): ScoredLead[] {
  const industryMap: Record<string, number> = {
    saas: 3, tech: 3, ecommerce: 3, fintech: 3,
    it: 2, pharma: 2, logistics: 2, insurance: 2,
    retail: 1, government: 1, health: 1, automotive: 1,
  };

  const scored = leads.map((lead) => {
    const industryScore = industryMap[lead.industry.toLowerCase()] ?? 1;
    const growthScore = lead.headcount > 500 ? 2 : lead.headcount > 100 ? 1 : 0;
    const seniorityScore = lead.seniority === "senior" ? 2 : lead.seniority === "mid" ? 1 : 0;
    const painScore = Math.floor(Math.random() * 4);
    const total = industryScore + growthScore + seniorityScore + painScore;
    return { ...lead, scores: { industryScore, growthScore, seniorityScore, painScore }, total, quartile: "Q1" as const };
  });

  const sorted = [...scored].sort((a, b) => b.total - a.total);
  const n = sorted.length;
  return sorted.map((lead, i) => ({
    ...lead,
    quartile: (i < n * 0.25 ? "Q1" : i < n * 0.5 ? "Q2" : i < n * 0.75 ? "Q3" : "Q4") as "Q1" | "Q2" | "Q3" | "Q4",
  }));
}

export function SearchStep({ config, setConfig, leads, setLeads, setScoredLeads, onComplete, setIsInsideList }: Props) {
  const { id: paramId, projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [campaignId, setCampaignId] = useState<string | null>(paramId && paramId !== "new" ? paramId : null);
  const [searching, setSearching] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [showICPForm, setShowICPForm] = useState(false);
  const [loading, setLoading] = useState(true);

  // Lists state
  const [lists, setLists] = useState<ListItem[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [listLeads, setListLeads] = useState<ScoredLead[]>([]);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [showNewListDialog, setShowNewListDialog] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [deletingListId, setDeletingListId] = useState<string | null>(null);
  const [savingField, setSavingField] = useState<Record<string, boolean>>({});

  const deleteList = async (listId: string) => {
    // Delete leads first, then the list
    await supabase.from("leads").delete().eq("list_id", listId);
    await supabase.from("lists").delete().eq("id", listId);
    setLists((prev) => prev.filter((l) => l.id !== listId));
    setDeletingListId(null);
    toast.success("Lista eliminada");
  };

  // Load existing lists
  useEffect(() => {
    if (!campaignId) {
      setLoading(false);
      setShowICPForm(true);
      return;
    }
    supabase
      .from("lists")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setLists(data as ListItem[]);
        setLoading(false);
      });
  }, [campaignId]);

  // Load leads for selected list & notify parent
  useEffect(() => {
    setIsInsideList(!!selectedListId);
    if (!selectedListId) {
      setListLeads([]);
      return;
    }
    supabase
      .from("leads")
      .select("*")
      .eq("list_id", selectedListId)
      .then(({ data }) => {
        if (data) {
           const mapped: ScoredLead[] = data
            .map((d) => ({
            id: d.id,
            firstName: d.first_name || "",
            lastName: d.last_name || "",
            title: d.title || "",
            company: d.company || "",
            industry: d.industry || "",
            country: d.country || "",
            seniority: d.seniority || "",
            email: d.email || "",
            linkedinUrl: d.linkedin_url || "",
            headcount: d.headcount || 0,
            scores: { industryScore: 0, growthScore: 0, seniorityScore: 0, painScore: 0 },
            total: d.score || 0,
            quartile: (d.quartile as "Q1" | "Q2" | "Q3" | "Q4") || "Q4",
            messages: d.messages as any,
            calificacion: d.calificacion || null,
            responsable: d.responsable || null,
            canal: d.canal || null,
          }));
          setListLeads(mapped);
          setScoredLeads(mapped);
        }
      });
  }, [selectedListId]);

  const updateListName = async (listId: string, newName: string) => {
    await supabase.from("lists").update({ name: newName }).eq("id", listId);
    setLists((prev) => prev.map((l) => (l.id === listId ? { ...l, name: newName } : l)));
    setEditingListId(null);
  };

  const startSearch = async (searchConfig: CampaignConfig) => {
    setShowICPForm(false);
    setConfig(searchConfig);
    setSearching(true);
    setLogs([]);
    setProgress(0);

    const countries = Object.entries(searchConfig.geoMix).filter(([, v]) => v > 0);
    setLogs(countries.map(([c, p]) => {
      const qty = Math.round(((p as number) / 100) * searchConfig.quantity);
      return `Buscando en ${c}... (${qty} leads)`;
    }));
    setProgress(10);

    try {
      // Auto-create campaign if needed
      let activeCampaignId = campaignId;
      if (!activeCampaignId) {
        const { data: newCampaign, error: campErr } = await supabase
          .from("campaigns")
          .insert({
            name: `Campaña ${new Date().toLocaleDateString("es-AR", { day: "numeric", month: "short" })}`,
            profile: searchConfig.profile,
            geo_mix: searchConfig.geoMix,
            quantity: searchConfig.quantity,
            frequency: "once",
            status: "configuracion",
            user_id: user?.id,
            project_id: projectId || null,
          })
          .select()
          .single();
        if (campErr || !newCampaign) throw new Error("No se pudo crear la campaña");
        activeCampaignId = newCampaign.id;
        setCampaignId(activeCampaignId);
        navigate(`/project/${projectId}/campaign/${activeCampaignId}`, { replace: true });
      }

      // Get all existing leads across the ENTIRE project for dedup
      let existingLeadsData: { email: string | null; linkedin_url: string | null }[] = [];
      if (projectId) {
        // Get all campaign IDs in this project
        const { data: projectCampaigns } = await supabase
          .from("campaigns")
          .select("id")
          .eq("project_id", projectId);
        const campaignIds = (projectCampaigns || []).map((c) => c.id);
        if (campaignIds.length > 0) {
          const { data } = await supabase
            .from("leads")
            .select("email, linkedin_url")
            .in("campaign_id", campaignIds);
          existingLeadsData = data || [];
        }
      } else {
        const { data } = await supabase
          .from("leads")
          .select("email, linkedin_url")
          .eq("campaign_id", activeCampaignId);
        existingLeadsData = data || [];
      }

      const existingEmails = new Set(existingLeadsData.map((l) => l.email).filter(Boolean));
      const existingLinkedins = new Set(existingLeadsData.map((l) => l.linkedin_url).filter(Boolean));

      // Use hardcoded leads instead of Apollo (MVP)
      setLogs((prev) => [...prev, `📋 Cargando leads desde CSV...`]);
      setProgress(30);

      const allNewLeads = HARDCODED_LEADS.filter((l: Lead) => {
        if (l.email && existingEmails.has(l.email)) return false;
        if (l.linkedinUrl && existingLinkedins.has(l.linkedinUrl)) return false;
        return true;
      });

      const dupeCount = HARDCODED_LEADS.length - allNewLeads.length;
      if (dupeCount > 0) {
        setLogs((prev) => [...prev, `⚠ ${dupeCount} duplicados filtrados`]);
      }

      setProgress(60);
      const finalLeads = allNewLeads;
      const scored = scoreAndAssign(finalLeads);

      // Create list record
      const now = new Date();
      const listName = newListName.trim() || `Lista ${now.toLocaleDateString("es-AR", { day: "numeric", month: "short" })}`;
      const { data: listData } = await supabase
        .from("lists")
        .insert({
          campaign_id: activeCampaignId,
          name: listName,
          profile: searchConfig.profile,
          geo_mix: searchConfig.geoMix,
          quantity: searchConfig.quantity,
          frequency: searchConfig.frequency || "once",
          lead_count: scored.length,
        })
        .select()
        .single();

      const listId = listData?.id;

      if (listId && scored.length > 0) {
        const rows = scored.map((l) => ({
          campaign_id: activeCampaignId,
          list_id: listId,
          first_name: l.firstName,
          last_name: l.lastName,
          title: l.title,
          company: l.company,
          industry: l.industry,
          country: l.country,
          seniority: l.seniority,
          email: l.email,
          linkedin_url: l.linkedinUrl,
          headcount: l.headcount,
          score: l.total,
          quartile: l.quartile,
        }));
        await supabase.from("leads").insert(rows);
      }

      if (listData) {
        setLists((prev) => [{ ...listData, geo_mix: listData.geo_mix as Record<string, number> } as ListItem, ...prev]);
      }

      setProgress(100);
      setLogs((prev) => [
        ...prev,
        `✓ ${scored.length} leads nuevos cargados`,
      ]);
      toast.success(`${scored.length} leads nuevos agregados`);
    } catch (e: any) {
      console.error("Search error:", e);
      toast.error(e.message || "Error cargando leads");
      setLogs((prev) => [...prev, `✗ Error: ${e.message}`]);
    } finally {
      setSearching(false);
    }
  };

  if (loading) {
    return <div className="glass-card p-5 animate-pulse h-24" />;
  }

  const RESPONSABLES = [
    { label: "Bruno", email: "burno@teramot.com" },
    { label: "Juan", email: "juan@teramot.com" },
    { label: "Lucio", email: "lucio@teramot.com" },
    { label: "Gabo", email: "gabriel@teramot.com" },
    { label: "Valen", email: "valentina@teramot.com" },
  ];
  const CALIFICACIONES = ["Top Fit", "Fit", "Not"];
  const CANALES = ["LinkedIn", "Mail"];

  const CALIFICACION_STYLES: Record<string, string> = {
    "Top Fit": "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    "Fit": "bg-green-500/20 text-green-300 border-green-500/30",
    "Not": "bg-rose-500/20 text-rose-300 border-rose-500/30",
  };
  const CANAL_STYLES: Record<string, string> = {
    "LinkedIn": "bg-blue-500/20 text-blue-300 border-blue-500/30",
    "Mail": "bg-violet-500/20 text-violet-300 border-violet-500/30",
  };

  const updateLeadField = async (leadId: string, field: string, value: string | null) => {
    setListLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, [field]: value } : l))
    );
    setSavingField((prev) => ({ ...prev, [leadId + field]: true }));
    const { error } = await supabase.from("leads").update({ [field]: value }).eq("id", leadId);
    setSavingField((prev) => ({ ...prev, [leadId + field]: false }));
    if (error) toast.error("Error al guardar");
  };

  // Drill-down: show leads of selected list
  if (selectedListId) {
    const selectedList = lists.find((l) => l.id === selectedListId);

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedListId(null)} className="p-2 rounded-lg hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-xl font-semibold text-foreground">{selectedList?.name}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {selectedList?.profile} · {listLeads.length} leads
            </p>
          </div>
          <div className="ml-auto">
            <button
              onClick={onComplete}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
            >
              ✉ Generar Comunicación
            </button>
          </div>
        </div>

        {listLeads.length > 0 && (
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {["Nombre", "Cargo", "Empresa", "País", "Email", "Score", "Cuartil", "Calificación", "Responsable", "Canal"].map((h) => (
                      <th key={h} className="px-3 py-3 text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {listLeads.map((lead, i) => {
                    const q = QUARTILE_STYLES[lead.quartile] || QUARTILE_STYLES.Q4;
                    const cal = (lead as any).calificacion as string | null;
                    const resp = (lead as any).responsable as string | null;
                    const canal = (lead as any).canal as string | null;
                    return (
                      <tr key={lead.id} className={`border-b border-white/[0.03] ${i % 2 === 0 ? "bg-white/[0.01]" : ""} hover:bg-white/[0.03] transition-colors`}>
                        <td className="px-3 py-2.5 text-foreground font-medium whitespace-nowrap">{lead.firstName} {lead.lastName}</td>
                        <td className="px-3 py-2.5 text-muted-foreground max-w-[160px] truncate">{lead.title}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{lead.company}</td>
                        <td className="px-3 py-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] border ${COUNTRY_COLORS[lead.country] || "text-muted-foreground"}`}>{lead.country}</span>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground font-mono text-[10px]">{lead.email || "—"}</td>
                        <td className="px-3 py-2.5 text-foreground font-semibold">{lead.total}</td>
                        <td className="px-3 py-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] border ${q.bg} ${q.text} ${q.border}`}>{q.label}</span>
                        </td>
                        {/* Calificación */}
                        <td className="px-3 py-2.5">
                          <select
                            value={cal || ""}
                            onChange={(e) => updateLeadField(lead.id, "calificacion", e.target.value || null)}
                            className={`rounded-md px-2 py-1 text-[11px] font-medium border cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary transition-colors ${
                              cal ? CALIFICACION_STYLES[cal] || "bg-white/[0.04] border-white/[0.08] text-foreground" : "bg-white/[0.04] border-white/[0.08] text-muted-foreground"
                            }`}
                          >
                            <option value="">—</option>
                            {CALIFICACIONES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                        {/* Responsable */}
                        <td className="px-3 py-2.5">
                          <select
                            value={resp || ""}
                            onChange={(e) => updateLeadField(lead.id, "responsable", e.target.value || null)}
                            className={`rounded-md px-2 py-1 text-[11px] font-medium border cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary transition-colors ${
                              resp ? "bg-amber-500/20 text-amber-300 border-amber-500/30" : "bg-white/[0.04] border-white/[0.08] text-muted-foreground"
                            }`}
                          >
                            <option value="">—</option>
                            {RESPONSABLES.map((r) => <option key={r.email} value={r.label}>{r.label}</option>)}
                          </select>
                        </td>
                        {/* Canal */}
                        <td className="px-3 py-2.5">
                          <select
                            value={canal || ""}
                            onChange={(e) => updateLeadField(lead.id, "canal", e.target.value || null)}
                            className={`rounded-md px-2 py-1 text-[11px] font-medium border cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary transition-colors ${
                              canal ? CANAL_STYLES[canal] || "bg-white/[0.04] border-white/[0.08] text-foreground" : "bg-white/[0.04] border-white/[0.08] text-muted-foreground"
                            }`}
                          >
                            <option value="">—</option>
                            {CANALES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    );
  }

  // Main view: list of lists
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Listas</h2>
          <p className="text-sm text-muted-foreground mt-1">Gestiona tus listas de prospectos.</p>
        </div>
        {!showICPForm && !searching && (
          <button
            onClick={() => { setNewListName(""); setShowNewListDialog(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
            Agregar lista
          </button>
        )}
      </div>

      {/* New list name dialog */}
      <AlertDialog open={showNewListDialog} onOpenChange={setShowNewListDialog}>
        <AlertDialogContent className="glass-card border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Nueva lista</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <label className="text-sm text-muted-foreground">Nombre de la lista</label>
            <Input
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newListName.trim()) { setShowNewListDialog(false); setShowICPForm(true); } }}
              placeholder="Ej: SDRs Fintech Argentina"
              autoFocus
              className="glass-input"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 text-muted-foreground hover:bg-white/5">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!newListName.trim()}
              onClick={() => { setShowICPForm(true); }}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Inline ICP Form */}
      {showICPForm && (
        <ICPForm
          config={config}
          onConfirm={startSearch}
          onCancel={() => setShowICPForm(false)}
        />
      )}

      {/* Search progress */}
      {(searching || logs.length > 0) && (
        <div className="glass-card p-5 space-y-3">
          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <div className="space-y-1 font-mono text-xs">
            {logs.map((log, i) => (
              <p key={i} className={i === logs.length - 1 && !searching ? "text-success" : "text-muted-foreground"}>{log}</p>
            ))}
            {searching && (
              <p className="text-muted-foreground flex items-center gap-2">
                <span className="flex gap-1">
                  <span className="w-1 h-1 rounded-full bg-primary pulse-dot" />
                  <span className="w-1 h-1 rounded-full bg-primary pulse-dot" />
                  <span className="w-1 h-1 rounded-full bg-primary pulse-dot" />
                </span>
                Procesando...
              </p>
            )}
          </div>
        </div>
      )}

      {/* List items */}
      {lists.length > 0 && (
        <div className="space-y-2">
          {lists.map((list) => {
            const geoSummary = Object.entries(list.geo_mix as Record<string, number>)
              .filter(([, v]) => v > 0)
              .map(([k, v]) => `${k} ${v}%`)
              .join(", ");

            return (
              <div
                key={list.id}
                className="glass-card glass-card-hover flex items-center gap-4 p-4 cursor-pointer transition-all group"
                onClick={() => {
                  if (editingListId !== list.id) setSelectedListId(list.id);
                }}
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {editingListId === list.id ? (
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") updateListName(list.id, editingName); }}
                          className="glass-input text-sm py-1 px-2 w-48"
                          autoFocus
                        />
                        <button onClick={() => updateListName(list.id, editingName)} className="p-1 rounded hover:bg-white/10 text-success">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <h3 className="text-sm font-medium text-foreground truncate">
                          {list.name || `Lista ${new Date(list.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}`}
                        </h3>
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingListId(list.id); setEditingName(list.name); }}
                          className="p-1 rounded hover:bg-white/10 text-muted-foreground/40 hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {list.profile} · {list.lead_count} leads · {geoSummary}
                  </p>
                </div>
                <div className="text-xs text-muted-foreground/60 shrink-0">
                  {new Date(list.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setDeletingListId(list.id); }}
                  className="p-1.5 rounded hover:bg-rose-500/10 text-muted-foreground/40 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                  title="Eliminar lista"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-foreground transition-colors shrink-0" />
              </div>
            );
          })}
        </div>
      )}

      {/* Delete list confirmation */}
      <AlertDialog open={!!deletingListId} onOpenChange={() => setDeletingListId(null)}>
        <AlertDialogContent className="glass-card border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">¿Eliminar lista?</AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-sm text-muted-foreground">Se eliminarán todos los leads asociados. Esta acción no se puede deshacer.</p>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 text-muted-foreground hover:bg-white/5">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingListId && deleteList(deletingListId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {lists.length === 0 && !showICPForm && !searching && (
        <div className="glass-card p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto text-2xl">📋</div>
          <h3 className="text-lg font-medium text-foreground">No hay listas aún</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Creá tu primera lista de prospectos para comenzar.
          </p>
          <button
            onClick={() => { setNewListName(""); setShowNewListDialog(true); }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors mt-2"
          >
            <Plus className="w-4 h-4" />
            Crear lista
          </button>
        </div>
      )}

    </div>
  );
}
