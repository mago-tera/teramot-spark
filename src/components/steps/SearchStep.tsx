import { useState, useEffect } from "react";
import { CampaignConfig, Lead, ScoredLead } from "@/hooks/useWizard";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ICPForm } from "@/components/steps/ICPForm";
import { Plus, ChevronRight, ArrowLeft, Pencil, Check, Users, Download, Zap, UserPlus, FileSpreadsheet, Search, ExternalLink, Link2, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { Trash2 } from "lucide-react";
import { SmartAssignDialog, SmartAssignResult } from "@/components/SmartAssignDialog";


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
import { Copy } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
  shared?: boolean;
  filtros_compartidos?: any;
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
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvFilterAprobado, setCsvFilterAprobado] = useState("");
  const [csvFilterResponsable, setCsvFilterResponsable] = useState("");
  const [csvFilterCanal, setCsvFilterCanal] = useState("");

  const downloadFilteredCSV = () => {
    let filtered = listLeads.filter((l) => {
      const cal = (l as any).calificacion as string | null;
      const resp = (l as any).responsable as string | null;
      const canal = (l as any).canal as string | null;
      if (csvFilterAprobado && cal !== csvFilterAprobado) return false;
      if (csvFilterResponsable && resp !== csvFilterResponsable) return false;
      if (csvFilterCanal && canal !== csvFilterCanal) return false;
      return true;
    });

    if (filtered.length === 0) {
      toast.error("No hay leads con esos filtros");
      return;
    }

    const canalFilter = csvFilterCanal || null;
    const headers = canalFilter === "LinkedIn"
      ? ["Nombre", "Apellido", "LinkedIn"]
      : canalFilter === "Mail"
        ? ["Nombre", "Apellido", "Email"]
        : ["Nombre", "Apellido", "Email", "LinkedIn"];

    const rows = filtered.map((l) => {
      if (canalFilter === "LinkedIn") return [l.firstName, l.lastName, l.linkedinUrl || ""];
      if (canalFilter === "Mail") return [l.firstName, l.lastName, l.email || ""];
      return [l.firstName, l.lastName, l.email || "", l.linkedinUrl || ""];
    });

    const csv = [headers, ...rows].map((r) => r.map((v) => `"${(v || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`CSV descargado con ${filtered.length} leads`);
  };

  const downloadFilteredExcel = () => {
    let filtered = listLeads.filter((l) => {
      const cal = (l as any).calificacion as string | null;
      const resp = (l as any).responsable as string | null;
      const canal = (l as any).canal as string | null;
      if (csvFilterAprobado && cal !== csvFilterAprobado) return false;
      if (csvFilterResponsable && resp !== csvFilterResponsable) return false;
      if (csvFilterCanal && canal !== csvFilterCanal) return false;
      return true;
    });

    if (filtered.length === 0) {
      toast.error("No hay leads con esos filtros");
      return;
    }

    const canalFilter = csvFilterCanal || null;
    const headers = canalFilter === "LinkedIn"
      ? ["Nombre", "Apellido", "LinkedIn"]
      : canalFilter === "Mail"
        ? ["Nombre", "Apellido", "Email"]
        : ["Nombre", "Apellido", "Email", "LinkedIn"];

    const rows = filtered.map((l) => {
      if (canalFilter === "LinkedIn") return [l.firstName, l.lastName, l.linkedinUrl || ""];
      if (canalFilter === "Mail") return [l.firstName, l.lastName, l.email || ""];
      return [l.firstName, l.lastName, l.email || "", l.linkedinUrl || ""];
    });

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    XLSX.writeFile(wb, `leads_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`Excel descargado con ${filtered.length} leads`);
  };
  const [showNewListDialog, setShowNewListDialog] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [deletingListId, setDeletingListId] = useState<string | null>(null);
  const [selectedSourceLists, setSelectedSourceLists] = useState<string[]>([]);
  const [copyingFromLists, setCopyingFromLists] = useState(false);
  // All lists across all campaigns in this project (for copy feature)
  const [projectLists, setProjectLists] = useState<(ListItem & { campaignName?: string })[]>([]);
  const [savingField, setSavingField] = useState<Record<string, boolean>>({});
  const [smartAssignField, setSmartAssignField] = useState<"calificacion" | "responsable" | "canal" | null>(null);
  const [applyAllField, setApplyAllField] = useState<"calificacion" | "responsable" | "canal" | null>(null);
  const [applyAllValue, setApplyAllValue] = useState("");
  
  const [showShareFilterModal, setShowShareFilterModal] = useState(false);
  const [shareFilterAprobado, setShareFilterAprobado] = useState("");
  const [shareFilterResponsable, setShareFilterResponsable] = useState("");
  const [shareResponsableEmail, setShareResponsableEmail] = useState("");
  const [shareFilterCanal, setShareFilterCanal] = useState("");
  const [shareCopySugerido, setShareCopySugerido] = useState("");
  const [shareViewName, setShareViewName] = useState("");
  const [leadSearch, setLeadSearch] = useState("");

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

  // Load all project lists for the copy feature
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const { data: campaigns } = await supabase
        .from("campaigns")
        .select("id, name")
        .eq("project_id", projectId);
      if (!campaigns?.length) return;
      const campaignMap = Object.fromEntries(campaigns.map((c) => [c.id, c.name || "Sin nombre"]));
      const { data: allLists } = await supabase
        .from("lists")
        .select("*")
        .in("campaign_id", campaigns.map((c) => c.id))
        .order("created_at", { ascending: false });
      if (allLists) {
        setProjectLists(
          allLists.map((l) => ({ ...l, geo_mix: l.geo_mix as Record<string, number>, campaignName: campaignMap[l.campaign_id] }))
        );
      }
    })();
  }, [projectId]);

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
            .sort((a, b) => (b.score || 0) - (a.score || 0))
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
            phone: (d as any).phone || undefined,
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

  const copyLeadsFromLists = async (sourceListIds: string[], targetCampaignId: string, targetListId: string) => {
    if (!sourceListIds.length) return 0;
    const { data: sourceLeads } = await supabase.from("leads").select("*").in("list_id", sourceListIds);
    if (!sourceLeads?.length) return 0;

    const rows = sourceLeads.map((l) => ({
      campaign_id: targetCampaignId, list_id: targetListId,
      first_name: l.first_name, last_name: l.last_name, title: l.title,
      company: l.company, industry: l.industry, country: l.country,
      seniority: l.seniority, email: l.email, linkedin_url: l.linkedin_url,
      headcount: l.headcount, score: l.score, quartile: l.quartile,
    }));

    let inserted = 0;
    for (const row of rows) {
      const { error } = await supabase.from("leads").insert(row);
      if (!error) inserted++;
    }
    return inserted;
  };

  const handleCreateListWithCopies = async () => {
    if (!selectedSourceLists.length || !newListName.trim()) return;
    setCopyingFromLists(true);
    setShowNewListDialog(false);
    setSearching(true);
    setLogs([]);
    setProgress(10);

    try {
      let activeCampaignId = campaignId;
      if (!activeCampaignId) {
        const { data: newCampaign, error: campErr } = await supabase.from("campaigns").insert({
          name: `Campaña ${new Date().toLocaleDateString("es-AR", { day: "numeric", month: "short" })}`,
          profile: "Copia", geo_mix: {}, quantity: 0, frequency: "once",
          status: "configuracion", user_id: user?.id, project_id: projectId || null,
        }).select().single();
        if (campErr || !newCampaign) throw new Error("No se pudo crear la campaña");
        activeCampaignId = newCampaign.id;
        setCampaignId(activeCampaignId);
        navigate(`/project/${projectId}/campaign/${activeCampaignId}`, { replace: true });
      }

      setLogs((prev) => [...prev, `📋 Copiando leads de ${selectedSourceLists.length} lista(s)...`]);
      setProgress(30);

      const { data: listData } = await supabase.from("lists").insert({
        campaign_id: activeCampaignId, name: newListName.trim(),
        profile: "Copia", geo_mix: {}, quantity: 0, frequency: "once", lead_count: 0,
      }).select().single();

      if (!listData) throw new Error("No se pudo crear la lista");

      setProgress(50);
      const copied = await copyLeadsFromLists(selectedSourceLists, activeCampaignId, listData.id);
      await supabase.from("lists").update({ lead_count: copied }).eq("id", listData.id);

      setLists((prev) => [{ ...listData, lead_count: copied, geo_mix: {} as Record<string, number> } as ListItem, ...prev]);
      setProgress(100);
      setLogs((prev) => [...prev, `✓ ${copied} leads copiados`]);
      toast.success(`${copied} leads copiados a la nueva lista`);
    } catch (e: any) {
      console.error("Copy error:", e);
      toast.error(e.message || "Error copiando leads");
      setLogs((prev) => [...prev, `✗ Error: ${e.message}`]);
    } finally {
      setSearching(false);
      setCopyingFromLists(false);
      setSelectedSourceLists([]);
    }
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

      // Search leads via Apollo API
      setLogs((prev) => [...prev, `🔍 Buscando leads en Apollo...`]);
      setProgress(30);

      const { data: apolloResult, error: apolloErr } = await supabase.functions.invoke("search-apollo", {
        body: {
          profile: searchConfig.profile,
          geoMix: searchConfig.geoMix,
          quantity: searchConfig.quantity,
          page: 1,
          excludeEmails: Array.from(existingEmails),
          excludeLinkedins: Array.from(existingLinkedins),
        },
      });

      if (apolloErr) throw new Error(apolloErr.message || "Error buscando en Apollo");
      if (apolloResult?.error) throw new Error(apolloResult.error);

      const apolloLeads: Lead[] = (apolloResult?.leads || []).map((l: any) => ({
        id: l.id || crypto.randomUUID(),
        firstName: l.firstName || "",
        lastName: l.lastName || "",
        title: l.title || "",
        company: l.company || "",
        industry: l.industry || "",
        country: l.country || "",
        seniority: l.seniority || "",
        email: l.email || "",
        linkedinUrl: l.linkedinUrl || "",
        headcount: l.headcount || 0,
      }));

      const finalLeads = apolloLeads;
      setLogs((prev) => [...prev, `✅ ${finalLeads.length} leads encontrados en Apollo`]);
      if (finalLeads.length < searchConfig.quantity) {
        setLogs((prev) => [...prev, `ℹ Solo ${finalLeads.length} leads únicos disponibles de ${searchConfig.quantity} pedidos`]);
      }

      setProgress(60);
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
        const { error: insertErr } = await supabase.from("leads").insert(rows);
        if (insertErr) {
          console.error("Insert leads error:", insertErr);
          // Try inserting one by one as fallback
          let insertedCount = 0;
          for (const row of rows) {
            const { error: singleErr } = await supabase.from("leads").insert(row);
            if (!singleErr) insertedCount++;
          }
          setLogs((prev) => [...prev, `⚠ ${insertedCount}/${rows.length} leads insertados (algunos duplicados omitidos)`]);
        }
      }

      // Also copy from selected source lists if any
      let copiedCount = 0;
      if (listId && selectedSourceLists.length > 0) {
        setLogs((prev) => [...prev, `📋 Copiando leads de ${selectedSourceLists.length} lista(s)...`]);
        copiedCount = await copyLeadsFromLists(selectedSourceLists, activeCampaignId!, listId);
        setSelectedSourceLists([]);
      }

      const totalCount = scored.length + copiedCount;
      if (listId) {
        await supabase.from("lists").update({ lead_count: totalCount }).eq("id", listId);
      }

      if (listData) {
        setLists((prev) => [{ ...listData, lead_count: totalCount, geo_mix: listData.geo_mix as Record<string, number> } as ListItem, ...prev]);
        setSelectedListId(listData.id);
      }

      setProgress(100);
      const parts = [];
      if (scored.length > 0) parts.push(`${scored.length} nuevos`);
      if (copiedCount > 0) parts.push(`${copiedCount} copiados`);
      setLogs((prev) => [...prev, `✓ ${parts.join(" + ")} leads cargados`]);
      toast.success(`${totalCount} leads agregados a la lista`);
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
  const CALIFICACIONES = ["SI", "NO"];
  const CANALES = ["LinkedIn", "Mail"];

  const CALIFICACION_STYLES: Record<string, string> = {
    "SI": "bg-green-500/20 text-green-300 border-green-500/30",
    "NO": "bg-rose-500/20 text-rose-300 border-rose-500/30",
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

  const bulkUpdateField = async (field: string, value: string, quartileFilter?: string) => {
    const val = value === "__clear__" ? null : value;
    const filtered = quartileFilter
      ? listLeads.filter((l) => l.quartile === quartileFilter)
      : listLeads;
    const ids = filtered.map((l) => l.id);
    if (ids.length === 0) return;
    setListLeads((prev) => prev.map((l) => ids.includes(l.id) ? { ...l, [field]: val } : l));
    const { error } = await supabase.from("leads").update({ [field]: val }).in("id", ids);
    const quartileLabel = quartileFilter ? (QUARTILE_STYLES as any)[quartileFilter]?.label || quartileFilter : "todos";
    if (error) toast.error("Error al guardar");
    else toast.success(val ? `"${val}" → ${ids.length} leads (${quartileLabel})` : `Limpiado en ${ids.length} leads (${quartileLabel})`);
  };

  const leadCountByQuartile: Record<string, number> = {};
  for (const l of listLeads) {
    leadCountByQuartile[l.quartile] = (leadCountByQuartile[l.quartile] || 0) + 1;
  }

  const smartApplyRules = async (
    field: string,
    rules: SmartAssignResult[]
  ) => {
    // Handle clear all
    if (rules.length === 1 && rules[0].value === "__clear__" && rules[0].quartile === "ALL") {
      await bulkUpdateField(field, "__clear__");
      return;
    }

    let totalAffected = 0;
    for (const rule of rules) {
      // Support "ALL" quartile
      const pool = rule.quartile === "ALL"
        ? listLeads
        : listLeads.filter((l) => l.quartile === rule.quartile);

      // For canal, optionally filter by responsable
      const filtered = rule.responsable
        ? pool.filter((l) => (l as any).responsable === rule.responsable)
        : pool;

      const count = Math.round((rule.percentage / 100) * filtered.length);
      // Pick leads that don't have this field set yet first
      const unset = filtered.filter((l) => !(l as any)[field]);
      const alreadySet = filtered.filter((l) => (l as any)[field]);
      const ordered = [...unset, ...alreadySet];
      const selected = ordered.slice(0, count);
      const ids = selected.map((l) => l.id);
      if (ids.length === 0) continue;

      totalAffected += ids.length;
      setListLeads((prev) => prev.map((l) => ids.includes(l.id) ? { ...l, [field]: rule.value } : l));
      await supabase.from("leads").update({ [field]: rule.value }).in("id", ids);
    }
    toast.success(`Asignación aplicada a ${totalAffected} leads`);
  };

  // Dynamic responsable options from leads
  const usedResponsablesInLeads = Array.from(
    new Set(listLeads.map((l) => (l as any).responsable as string | null).filter(Boolean))
  ) as string[];

  // (SMART_ASSIGN_OPTIONS removed — dialog is now field-aware)

  const applyToAll = async (field: string, value: string) => {
    if (!value) return;
    const ids = listLeads.map((l) => l.id);
    setListLeads((prev) => prev.map((l) => ({ ...l, [field]: value })));
    await supabase.from("leads").update({ [field]: value }).in("id", ids);
    toast.success(`"${value}" aplicado a ${ids.length} leads`);
    setApplyAllField(null);
    setApplyAllValue("");
  };

  const SMART_ASSIGN_LABELS: Record<string, string> = {
    calificacion: "Aprobado",
    responsable: "Responsable",
    canal: "Canal",
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
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowCsvModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-white/[0.1] bg-white/[0.04] text-foreground hover:bg-white/[0.08] transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Bajar CSV / Excel
            </button>
            <button
              onClick={() => {
                setShareFilterAprobado("");
                setShareFilterResponsable("");
                setShareFilterCanal("");
                setShareResponsableEmail("");
                setShareCopySugerido("");
                setShareViewName("");
                setShowShareFilterModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border border-white/[0.1] bg-white/[0.04] text-foreground hover:bg-white/[0.08] transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" /> Crear Outreach
            </button>
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
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06]">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por nombre, empresa, cargo, email..."
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
              {leadSearch && (
                <button onClick={() => setLeadSearch("")} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {["Nombre", "Cargo", "Empresa", "País", "Email", "LinkedIn", "Teléfono"].map((h) => (
                      <th key={h} className="px-3 py-3 text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                    ))}
                    {(["calificacion", "responsable", "canal"] as const).map((f) => (
                      <th key={f} className="px-3 py-3 text-left text-[11px] uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {SMART_ASSIGN_LABELS[f]}
                          <button
                            onClick={() => setSmartAssignField(f)}
                            className="ml-1 flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-colors cursor-pointer"
                            title="Asignación inteligente"
                          >
                            <Zap className="w-3 h-3" /> Asignar
                          </button>
                          <button
                            onClick={() => { setApplyAllField(f); setApplyAllValue(""); }}
                            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] bg-white/[0.06] border border-white/[0.1] text-muted-foreground hover:text-foreground hover:bg-white/[0.1] transition-colors cursor-pointer"
                            title="Aplicar a todo"
                          >
                            <Check className="w-3 h-3" /> Todo
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const q = leadSearch.toLowerCase().trim();
                    const filtered = q
                      ? listLeads.filter((l) =>
                          `${l.firstName} ${l.lastName} ${l.title} ${l.company} ${l.email} ${l.country} ${l.industry}`.toLowerCase().includes(q)
                        )
                      : listLeads;
                    return filtered.map((lead, i) => {
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
                        <td className="px-3 py-2.5">
                          {lead.linkedinUrl ? (
                            <div className="flex items-center gap-1.5 max-w-[200px]">
                              <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-[10px] font-mono truncate underline">{lead.linkedinUrl}</a>
                              <button
                                onClick={() => { navigator.clipboard.writeText(lead.linkedinUrl); toast.success("URL copiada"); }}
                                className="shrink-0 p-0.5 rounded hover:bg-white/[0.08] text-muted-foreground hover:text-foreground transition-colors"
                                title="Copiar URL"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                              </button>
                            </div>
                          ) : <span className="text-muted-foreground text-[10px]">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground font-mono text-[10px] whitespace-nowrap">{lead.phone || "—"}</td>
                        {/* Aprobado */}
                        <td className="px-3 py-2.5">
                          <select
                            value={cal || ""}
                            onChange={(e) => updateLeadField(lead.id, "calificacion", e.target.value || null)}
                            className={`rounded-md px-2 py-1 text-[11px] font-medium border cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary transition-colors [&>option]:bg-[#1a1a2e] [&>option]:text-white ${
                              cal ? CALIFICACION_STYLES[cal] || "bg-white/[0.04] border-white/[0.08] text-foreground" : "bg-white/[0.04] border-white/[0.08] text-muted-foreground"
                            }`}
                          >
                            <option value="">—</option>
                            {CALIFICACIONES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                        {/* Responsable - free text input */}
                        <td className="px-3 py-2.5">
                          <input
                            type="text"
                            value={resp || ""}
                            onChange={(e) => updateLeadField(lead.id, "responsable", e.target.value || null)}
                            placeholder="—"
                            className={`w-[120px] rounded-md px-2 py-1 text-[11px] font-medium border cursor-text focus:outline-none focus:ring-1 focus:ring-primary transition-colors ${
                              resp ? "bg-amber-500/20 text-amber-300 border-amber-500/30" : "bg-white/[0.04] border-white/[0.08] text-muted-foreground"
                            }`}
                          />
                        </td>
                        {/* Canal */}
                        <td className="px-3 py-2.5">
                          <select
                            value={canal || ""}
                            onChange={(e) => updateLeadField(lead.id, "canal", e.target.value || null)}
                            className={`rounded-md px-2 py-1 text-[11px] font-medium border cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary transition-colors [&>option]:bg-[#1a1a2e] [&>option]:text-white ${
                              canal ? CANAL_STYLES[canal] || "bg-white/[0.04] border-white/[0.08] text-foreground" : "bg-white/[0.04] border-white/[0.08] text-muted-foreground"
                            }`}
                          >
                            <option value="">—</option>
                            {CANALES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                      </tr>
                    );
                  });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}




        {smartAssignField && (
          <SmartAssignDialog
            open={!!smartAssignField}
            onOpenChange={(open) => !open && setSmartAssignField(null)}
            field={smartAssignField}
            fieldLabel={SMART_ASSIGN_LABELS[smartAssignField]}
            leadCountByQuartile={leadCountByQuartile}
            usedResponsables={usedResponsablesInLeads}
            onApply={(rules) => smartApplyRules(smartAssignField, rules)}
          />
        )}

        {/* Apply to all modal */}
        {applyAllField && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setApplyAllField(null)}>
            <div className="bg-[hsl(var(--card))] border border-white/[0.1] rounded-xl p-5 w-full max-w-xs shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-sm font-semibold text-foreground">Aplicar a todo — {SMART_ASSIGN_LABELS[applyAllField]}</h3>
              {applyAllField === "calificacion" && (
                <select value={applyAllValue} onChange={(e) => setApplyAllValue(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm border border-white/[0.1] bg-[hsl(var(--background))] text-foreground focus:outline-none focus:ring-2 focus:ring-primary [&>option]:bg-[#1a1a2e] [&>option]:text-white">
                  <option value="">Seleccionar...</option>
                  {CALIFICACIONES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              {applyAllField === "responsable" && (
                <input
                  type="text"
                  value={applyAllValue}
                  onChange={(e) => setApplyAllValue(e.target.value)}
                  placeholder="Nombre o email del responsable"
                  className="w-full rounded-lg px-3 py-2 text-sm border border-white/[0.1] bg-[hsl(var(--background))] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              )}
              {applyAllField === "canal" && (
                <select value={applyAllValue} onChange={(e) => setApplyAllValue(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm border border-white/[0.1] bg-[hsl(var(--background))] text-foreground focus:outline-none focus:ring-2 focus:ring-primary [&>option]:bg-[#1a1a2e] [&>option]:text-white">
                  <option value="">Seleccionar...</option>
                  {CANALES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              <div className="flex gap-2">
                <button onClick={() => setApplyAllField(null)}
                  className="flex-1 px-3 py-2 rounded-lg text-sm border border-white/[0.1] text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={() => applyToAll(applyAllField, applyAllValue)}
                  disabled={!applyAllValue}
                  className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
                  Aplicar a todo
                </button>
              </div>
            </div>
          </div>
        )}

        {showCsvModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowCsvModal(false)}>
            <div className="bg-[hsl(var(--card))] border border-white/[0.1] rounded-xl p-6 w-full max-w-sm shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-foreground">Filtros para descarga</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Aprobado</label>
                  <select
                    value={csvFilterAprobado}
                    onChange={(e) => setCsvFilterAprobado(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm font-medium border border-white/[0.1] bg-[hsl(var(--background))] text-foreground focus:outline-none focus:ring-2 focus:ring-primary [&>option]:bg-[#1a1a2e] [&>option]:text-white"
                  >
                    <option value="">Todos</option>
                    <option value="SI">SI</option>
                    <option value="NO">NO</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Responsable</label>
                  <select
                    value={csvFilterResponsable}
                    onChange={(e) => setCsvFilterResponsable(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm font-medium border border-white/[0.1] bg-[hsl(var(--background))] text-foreground focus:outline-none focus:ring-2 focus:ring-primary [&>option]:bg-[#1a1a2e] [&>option]:text-white"
                  >
                    <option value="">Todos</option>
                    {RESPONSABLES.map((r) => <option key={r.label} value={r.label}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Canal</label>
                  <select
                    value={csvFilterCanal}
                    onChange={(e) => setCsvFilterCanal(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm font-medium border border-white/[0.1] bg-[hsl(var(--background))] text-foreground focus:outline-none focus:ring-2 focus:ring-primary [&>option]:bg-[#1a1a2e] [&>option]:text-white"
                  >
                    <option value="">Todos</option>
                    <option value="LinkedIn">LinkedIn</option>
                    <option value="Mail">Mail</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowCsvModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-medium border border-white/[0.1] text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => { downloadFilteredCSV(); setShowCsvModal(false); }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Download className="w-4 h-4" /> CSV
                </button>
                <button
                  onClick={() => { downloadFilteredExcel(); setShowCsvModal(false); }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4" /> Excel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Share filter modal */}
        {showShareFilterModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowShareFilterModal(false)}>
            <div className="bg-[hsl(var(--card))] border border-white/[0.1] rounded-xl p-6 w-full max-w-sm shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-foreground">Crear Outreach</h3>
              <p className="text-xs text-muted-foreground">Nombrá el outreach y segmentá los leads por canal y responsable.</p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Nombre del Outreach</label>
                  <input
                    value={shareViewName}
                    onChange={(e) => setShareViewName(e.target.value)}
                    placeholder="Ej: Leads LinkedIn - Bruno"
                    className="w-full rounded-lg px-3 py-2 text-sm font-medium border border-white/[0.1] bg-[hsl(var(--background))] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                {/* Segmentation filters */}
                <div className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.02] space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Segmentación</p>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Canal <span className="text-destructive">*</span></label>
                    <select value={shareFilterCanal} onChange={(e) => setShareFilterCanal(e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-sm font-medium border border-white/[0.1] bg-[hsl(var(--background))] text-foreground focus:outline-none focus:ring-2 focus:ring-primary [&>option]:bg-[#1a1a2e] [&>option]:text-white">
                      <option value="">Todos los canales</option>
                      <option value="LinkedIn">LinkedIn</option>
                      <option value="Mail">Mail</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Aprobado</label>
                    <select value={shareFilterAprobado} onChange={(e) => setShareFilterAprobado(e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-sm font-medium border border-white/[0.1] bg-[hsl(var(--background))] text-foreground focus:outline-none focus:ring-2 focus:ring-primary [&>option]:bg-[#1a1a2e] [&>option]:text-white">
                      <option value="">Todos</option>
                      <option value="SI">SI</option>
                      <option value="NO">NO</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Responsable</label>
                    <select
                      value={shareFilterResponsable}
                      onChange={(e) => setShareFilterResponsable(e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-sm font-medium border border-white/[0.1] bg-[hsl(var(--background))] text-foreground focus:outline-none focus:ring-2 focus:ring-primary [&>option]:bg-[#1a1a2e] [&>option]:text-white"
                    >
                      <option value="">Todos los responsables</option>
                      {usedResponsablesInLeads.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Owner <span className="text-destructive">*</span></label>
                  <input
                    type="email"
                    value={shareResponsableEmail}
                    onChange={(e) => setShareResponsableEmail(e.target.value)}
                    placeholder="Email de quien va a enviar los mensajes"
                    className="w-full rounded-lg px-3 py-2 text-sm font-medium border border-white/[0.1] bg-[hsl(var(--background))] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Copy sugerido</label>
                  <textarea
                    value={shareCopySugerido}
                    onChange={(e) => setShareCopySugerido(e.target.value)}
                    placeholder="Escribí el mensaje o template que querés que el usuario copie para contactar a los leads..."
                    rows={4}
                    className="w-full rounded-lg px-3 py-2 text-sm border border-white/[0.1] bg-[hsl(var(--background))] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowShareFilterModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg text-sm font-medium border border-white/[0.1] text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    if (!shareViewName.trim()) {
                      toast.error("Poné un nombre al outreach");
                      return;
                    }
                    if (!shareResponsableEmail.trim()) {
                      toast.error("Ingresá el email del owner");
                      return;
                    }
                    if (!shareFilterCanal) {
                      toast.error("Seleccioná un canal (LinkedIn o Mail)");
                      return;
                    }
                    // Look up user by email
                    const { data: profile } = await supabase
                      .from("profiles")
                      .select("id")
                      .eq("email", shareResponsableEmail.trim().toLowerCase())
                      .single();
                    if (!profile) {
                      toast.error("No se encontró un usuario con ese email.");
                      return;
                    }
                    const filters = {
                      calificacion: shareFilterAprobado || null,
                      responsable: shareFilterResponsable || null,
                      canal: shareFilterCanal || null,
                    };
                    // Insert outreach record (list stays unchanged)
                    const { error: outreachErr } = await supabase.from("outreaches").insert({
                      list_id: selectedListId!,
                      campaign_id: campaignId!,
                      name: shareViewName.trim(),
                      responsable: shareResponsableEmail.trim().toLowerCase(),
                      canal: shareFilterCanal || null,
                      filtros_compartidos: filters,
                      copy_sugerido: shareCopySugerido,
                    });
                    if (outreachErr) {
                      toast.error("Error creando outreach");
                      console.error(outreachErr);
                      return;
                    }
                    // Mark list as shared and add user as list member
                    await supabase.from("lists").update({ shared: true } as any).eq("id", selectedListId);
                    await supabase.from("list_members").upsert({
                      list_id: selectedListId!,
                      user_id: profile.id,
                      role: "viewer",
                    }, { onConflict: "list_id,user_id" });
                    setShowShareFilterModal(false);
                    toast.success("Outreach creado y compartido con " + shareResponsableEmail.trim());
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                  Crear Outreach
                </button>
              </div>
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
      <AlertDialog open={showNewListDialog} onOpenChange={(open) => { setShowNewListDialog(open); if (!open) setSelectedSourceLists([]); }}>
        <AlertDialogContent className="glass-card border-white/10 max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Nueva lista</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm text-muted-foreground">Nombre de la lista</label>
              <Input
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="Ej: SDRs Fintech Argentina"
                autoFocus
                className="glass-input mt-1"
              />
            </div>

            {/* Copy from existing lists */}
            {projectLists.length > 0 && (
              <div>
                <label className="text-sm text-muted-foreground flex items-center gap-1.5 mb-2">
                  <Copy className="w-3.5 h-3.5" /> Copiar leads de listas existentes <span className="text-xs text-muted-foreground/60">(opcional)</span>
                </label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto rounded-lg border border-white/[0.06] p-2 bg-white/[0.02]">
                  {projectLists.map((pl) => (
                    <label
                      key={pl.id}
                      className="flex items-center gap-2.5 py-1.5 px-2 rounded-md hover:bg-white/[0.04] cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={selectedSourceLists.includes(pl.id)}
                        onCheckedChange={(checked) => {
                          setSelectedSourceLists((prev) =>
                            checked ? [...prev, pl.id] : prev.filter((id) => id !== pl.id)
                          );
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-xs text-foreground">{pl.name}</span>
                        <span className="text-[10px] text-muted-foreground/60 ml-2">
                          {pl.campaignName} · {pl.lead_count} leads
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
                {selectedSourceLists.length > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {selectedSourceLists.length} lista(s) seleccionadas para copiar
                  </p>
                )}
              </div>
            )}
          </div>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="border-white/10 text-muted-foreground hover:bg-white/5">Cancelar</AlertDialogCancel>
            {selectedSourceLists.length > 0 && (
              <button
                disabled={!newListName.trim()}
                onClick={handleCreateListWithCopies}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-accent-foreground hover:bg-accent/80 transition-colors disabled:opacity-50"
              >
                <Copy className="w-3.5 h-3.5" /> Solo copiar
              </button>
            )}
            <AlertDialogAction
              disabled={!newListName.trim()}
              onClick={() => { setShowICPForm(true); }}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {selectedSourceLists.length > 0 ? "Copiar + buscar nuevos" : "Buscar leads"}
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
                  onClick={(e) => { e.stopPropagation(); setSelectedListId(list.id); setShareFilterAprobado(""); setShareFilterResponsable(""); setShareFilterCanal(""); setShareResponsableEmail(""); setShareCopySugerido(""); setShareViewName(list.name || ""); setShowShareFilterModal(true); }}
                  className="p-1.5 rounded hover:bg-white/10 text-muted-foreground/40 hover:text-foreground opacity-0 group-hover:opacity-100 transition-all shrink-0"
                  title="Crear Outreach"
                >
                  <UserPlus className="w-4 h-4" />
                </button>
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
