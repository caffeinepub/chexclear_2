import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Copy,
  FileText,
  Loader2,
  Mail,
  Plus,
  Search,
  Settings as SettingsIcon,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// ─── Window Storage Declaration ───────────────────────────────────────────────
declare global {
  interface Window {
    storage?: {
      get: (key: string) => Promise<{ value: string } | null>;
      set: (key: string, value: string) => Promise<unknown>;
    };
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────
type StatusKey = "new" | "letter_sent" | "waiting" | "resolved" | "denied";
type LetterStatus = "draft" | "sent" | "printed";

interface Letter {
  id: string;
  title: string;
  text: string;
  createdAt: string;
  status: LetterStatus;
}

interface Client {
  id: string;
  name: string;
  address: string;
  cityStateZip: string;
  dob: string;
  ssnLast4: string;
  phone: string;
  reportText: string;
  letters: Letter[];
  notes: string;
  status: StatusKey;
  createdAt: string;
}

type View = "list" | "detail" | "settings";

// ─── Status Config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<StatusKey, { label: string; variant: string }> = {
  new: { label: "New", variant: "new" },
  letter_sent: { label: "Letter Sent", variant: "letter_sent" },
  waiting: { label: "Waiting", variant: "waiting" },
  resolved: { label: "Resolved", variant: "resolved" },
  denied: { label: "Denied", variant: "denied" },
};

// ─── Storage Helpers ──────────────────────────────────────────────────────────
let storageOk = false;

async function initStorage(): Promise<boolean> {
  try {
    if (!window.storage) return false;
    await window.storage.set("chexclear_test", "1");
    const t = await window.storage.get("chexclear_test");
    storageOk = !!t?.value;
    return storageOk;
  } catch {
    return false;
  }
}

async function loadClients(): Promise<Client[]> {
  if (!storageOk) return [];
  try {
    const r = await window.storage!.get("chexclear_data");
    if (!r?.value) return [];
    const parsed = JSON.parse(r.value);
    return parsed.map((c: Client & { letter?: string }) => ({
      ...c,
      letters: c.letters ?? [],
      notes: c.notes ?? "",
    }));
  } catch {
    return [];
  }
}

async function saveClients(data: Client[]): Promise<boolean> {
  if (!storageOk) return false;
  try {
    const r = await window.storage!.set("chexclear_data", JSON.stringify(data));
    return !!r;
  } catch {
    return false;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ─── Venice AI ────────────────────────────────────────────────────────────────
async function callVenice(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const res = await fetch("https://api.venice.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model || "llama-3.3-70b",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 4000,
      temperature: 0.3,
      venice_parameters: { include_venice_system_prompt: false },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Venice API ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  if (data.error)
    throw new Error(data.error.message || JSON.stringify(data.error));
  return data.choices?.[0]?.message?.content || "";
}

const SYSTEM_PROMPT = `You are an expert consumer rights advocate. You write FCRA Section 611 dispute letters to ChexSystems.

Read the ChexSystems report provided and identify ALL negative marks reported.

For EACH negative mark found, write a separate formal dispute letter addressed to:
ChexSystems, Inc.
Attn: Consumer Relations
7805 Hudson Road, Suite 100
Woodbury, MN 55125

Each letter must:
1. Be written from the client's perspective using their real name and information
2. Reference FCRA Section 611 (15 U.S.C. 1681i)
3. Identify the specific disputed item with exact details from the report (bank name, date, reason, amount, account number)
4. Dispute the accuracy of the item
5. Request investigation and verification within 30 days
6. State that unverified items must be removed per FCRA Section 611(a)(5)(A)
7. Request an updated consumer disclosure report
8. Include client identification (name, SSN last 4, DOB)
9. Note the letter is sent via Certified Mail with Return Receipt Requested
10. List enclosures: government photo ID, proof of address, ChexSystems report copy

If multiple negative marks exist, separate each letter with a line:
========================================

Respond with ONLY the letter text. No markdown formatting. No explanations.`;

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: StatusKey }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.new;
  const styles: Record<string, string> = {
    new: "bg-muted text-muted-foreground border-transparent",
    letter_sent: "bg-primary/10 text-primary border-transparent",
    waiting: "bg-warning/10 text-warning border-transparent",
    resolved: "bg-success/10 text-success border-transparent",
    denied: "bg-destructive/10 text-destructive border-transparent",
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase font-mono border ${
        styles[status]
      }`}
    >
      {cfg.label}
    </span>
  );
}

function ClientInitials({ name }: { name: string }) {
  const parts = name.trim().split(" ");
  const initials =
    parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
      <span className="text-xs font-semibold text-primary font-mono">
        {initials}
      </span>
    </div>
  );
}

// ─── Slide-over Panel ─────────────────────────────────────────────────────────
interface NewClientPanelProps {
  open: boolean;
  onClose: () => void;
  onSave: (client: Client) => void;
}

function NewClientPanel({ open, onClose, onSave }: NewClientPanelProps) {
  const [form, setForm] = useState({
    name: "",
    address: "",
    cityStateZip: "",
    dob: "",
    ssnLast4: "",
    phone: "",
    reportText: "",
  });
  const [err, setErr] = useState("");

  const handleSave = () => {
    if (!form.name.trim()) {
      setErr("Client name is required.");
      return;
    }
    const client: Client = {
      id: uid(),
      name: form.name.trim(),
      address: form.address,
      cityStateZip: form.cityStateZip,
      dob: form.dob,
      ssnLast4: form.ssnLast4,
      phone: form.phone,
      reportText: form.reportText,
      letters: [],
      notes: "",
      status: "new",
      createdAt: new Date().toISOString().split("T")[0],
    };
    onSave(client);
    setForm({
      name: "",
      address: "",
      cityStateZip: "",
      dob: "",
      ssnLast4: "",
      phone: "",
      reportText: "",
    });
    setErr("");
  };

  const handleClose = () => {
    setForm({
      name: "",
      address: "",
      cityStateZip: "",
      dob: "",
      ssnLast4: "",
      phone: "",
      reportText: "",
    });
    setErr("");
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={handleClose}
          />
          {/* Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-md z-50 flex flex-col"
            style={{
              background: "oklch(var(--popover))",
              borderLeft: "1px solid oklch(var(--border))",
            }}
            data-ocid="new_client.panel"
          >
            {/* Panel Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-border">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  New Client
                </h2>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  Add a new ChexSystems client
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                data-ocid="new_client.close_button"
              >
                ✕
              </button>
            </div>

            {/* Panel Body */}
            <ScrollArea className="flex-1 px-6 py-5 scrollbar-thin">
              <div className="space-y-5">
                {/* Name row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label
                      htmlFor="nc-name"
                      className="block text-[11px] font-mono text-muted-foreground mb-1.5 tracking-wide uppercase"
                    >
                      Full Name <span className="text-destructive">*</span>
                    </label>
                    <Input
                      value={form.name}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, name: e.target.value }))
                      }
                      placeholder="John Doe"
                      className="bg-input border-border text-foreground placeholder:text-muted-foreground font-mono text-sm"
                      id="nc-name"
                      data-ocid="new_client.input"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="nc-address"
                      className="block text-[11px] font-mono text-muted-foreground mb-1.5 tracking-wide uppercase"
                    >
                      Street Address
                    </label>
                    <Input
                      value={form.address}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, address: e.target.value }))
                      }
                      id="nc-address"
                      placeholder="123 Main St"
                      className="bg-input border-border text-foreground placeholder:text-muted-foreground font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="nc-city"
                      className="block text-[11px] font-mono text-muted-foreground mb-1.5 tracking-wide uppercase"
                    >
                      City, State ZIP
                    </label>
                    <Input
                      value={form.cityStateZip}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, cityStateZip: e.target.value }))
                      }
                      id="nc-city"
                      placeholder="Houston, TX 77001"
                      className="bg-input border-border text-foreground placeholder:text-muted-foreground font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="nc-dob"
                      className="block text-[11px] font-mono text-muted-foreground mb-1.5 tracking-wide uppercase"
                    >
                      Date of Birth
                    </label>
                    <Input
                      value={form.dob}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, dob: e.target.value }))
                      }
                      id="nc-dob"
                      placeholder="01/15/1990"
                      className="bg-input border-border text-foreground placeholder:text-muted-foreground font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="nc-ssn"
                      className="block text-[11px] font-mono text-muted-foreground mb-1.5 tracking-wide uppercase"
                    >
                      SSN Last 4
                    </label>
                    <Input
                      value={form.ssnLast4}
                      onChange={(e) =>
                        setForm((p) => ({
                          ...p,
                          ssnLast4: e.target.value
                            .replace(/\D/g, "")
                            .slice(0, 4),
                        }))
                      }
                      id="nc-ssn"
                      placeholder="1234"
                      maxLength={4}
                      className="bg-input border-border text-foreground placeholder:text-muted-foreground font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="nc-phone"
                      className="block text-[11px] font-mono text-muted-foreground mb-1.5 tracking-wide uppercase"
                    >
                      Phone
                    </label>
                    <Input
                      value={form.phone}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, phone: e.target.value }))
                      }
                      id="nc-phone"
                      placeholder="(555) 123-4567"
                      className="bg-input border-border text-foreground placeholder:text-muted-foreground font-mono text-sm"
                    />
                  </div>
                </div>

                <Separator className="bg-border" />

                <div>
                  <label
                    htmlFor="nc-report"
                    className="block text-[11px] font-mono text-muted-foreground mb-1.5 tracking-wide uppercase"
                  >
                    ChexSystems Report
                  </label>
                  <p className="text-[11px] font-mono text-muted-foreground mb-2 leading-relaxed">
                    Paste the full text from the client's ChexSystems Consumer
                    Disclosure report.
                  </p>
                  <Textarea
                    value={form.reportText}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, reportText: e.target.value }))
                    }
                    id="nc-report"
                    placeholder="Paste the entire ChexSystems report text here..."
                    className="bg-input border-border text-foreground placeholder:text-muted-foreground font-mono text-xs leading-relaxed resize-y min-h-[140px]"
                    data-ocid="new_client.textarea"
                  />
                </div>

                {err && (
                  <div
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20"
                    data-ocid="new_client.error_state"
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                    <span className="text-[11px] font-mono text-destructive">
                      {err}
                    </span>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Panel Footer */}
            <div className="px-6 py-4 border-t border-border flex items-center gap-3">
              <Button
                onClick={handleSave}
                disabled={!form.name.trim()}
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-head text-sm font-semibold"
                data-ocid="new_client.submit_button"
              >
                Save Client
              </Button>
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex-1 border-border text-muted-foreground hover:text-foreground"
                data-ocid="new_client.cancel_button"
              >
                Cancel
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Letters Section Component ───────────────────────────────────────────────
interface LettersSectionProps {
  letters: Letter[];
  generating: boolean;
  hasReport: boolean;
  hasApiKey: boolean;
  onGenerate: () => void;
  onLettersChange: (letters: Letter[]) => void;
}

function LettersSection({
  letters,
  generating,
  hasReport,
  hasApiKey,
  onGenerate,
  onLettersChange,
}: LettersSectionProps) {
  const [openLetterId, setOpenLetterId] = useState<string | null>(null);

  const openLetter = letters.find((l) => l.id === openLetterId);

  const updateLetter = (id: string, patch: Partial<Letter>) => {
    onLettersChange(letters.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const createBlank = () => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const yyyy = today.getFullYear();
    const newLetter: Letter = {
      id: uid(),
      title: `New Letter — ${mm}/${dd}/${yyyy}`,
      text: "",
      createdAt: new Date().toISOString(),
      status: "draft",
    };
    const next = [...letters, newLetter];
    onLettersChange(next);
    setOpenLetterId(newLetter.id);
  };

  const letterStatusStyles: Record<LetterStatus, string> = {
    draft: "bg-muted text-muted-foreground border-transparent",
    sent: "bg-primary/10 text-primary border-transparent",
    printed: "bg-success/10 text-success border-transparent",
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider font-semibold">
          Letters{" "}
          {letters.length > 0 && (
            <span className="text-primary">({letters.length})</span>
          )}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={createBlank}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border text-[11px] font-mono text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            data-ocid="detail.letters.open_modal_button"
          >
            <Plus className="w-3 h-3" /> New Letter
          </button>
        </div>
      </div>

      {/* Generate Button */}
      <Button
        onClick={onGenerate}
        disabled={generating || !hasReport || !hasApiKey}
        className={`w-full font-head text-sm font-semibold gap-2 ${
          generating || !hasReport || !hasApiKey
            ? "bg-muted text-muted-foreground cursor-not-allowed"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        }`}
        data-ocid="detail.generate.button"
      >
        {generating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Generating...
          </>
        ) : letters.length > 0 ? (
          <>
            <Sparkles className="w-4 h-4" /> Regenerate Letters
          </>
        ) : (
          <>
            <Mail className="w-4 h-4" /> Generate Dispute Letters
          </>
        )}
      </Button>

      {!hasReport && !generating && (
        <p className="text-xs font-mono text-muted-foreground leading-relaxed">
          Paste the ChexSystems report above first, then generate letters.
        </p>
      )}

      {/* Letter list */}
      {letters.length > 0 && (
        <div className="space-y-2" data-ocid="detail.letters.list">
          {letters.map((letter, i) => (
            <div key={letter.id} data-ocid={`detail.letters.item.${i + 1}`}>
              <button
                type="button"
                onClick={() =>
                  setOpenLetterId(openLetterId === letter.id ? null : letter.id)
                }
                className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
                  openLetterId === letter.id
                    ? "border-primary/40 bg-primary/5"
                    : "border-border hover:border-border/80 hover:bg-accent/30"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-foreground truncate flex-1">
                    {letter.title}
                  </span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase font-mono border ${letterStatusStyles[letter.status]}`}
                    >
                      {letter.status}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {new Date(letter.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </button>

              {/* Inline detail panel */}
              <AnimatePresence>
                {openLetterId === letter.id && openLetter && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                    data-ocid="detail.letters.panel"
                  >
                    <div className="mt-2 p-3 rounded-lg border border-border bg-input/30 space-y-3">
                      {/* Title + status + copy */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          type="text"
                          value={openLetter.title}
                          onChange={(e) =>
                            updateLetter(letter.id, { title: e.target.value })
                          }
                          className="flex-1 min-w-0 bg-transparent border-b border-border text-sm font-mono text-foreground placeholder:text-muted-foreground outline-none focus:border-primary py-0.5"
                          data-ocid="detail.letters.input"
                        />
                        <div className="flex items-center gap-1">
                          {(["draft", "sent", "printed"] as LetterStatus[]).map(
                            (s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() =>
                                  updateLetter(letter.id, { status: s })
                                }
                                className={`px-2 py-1 rounded text-[10px] font-mono font-semibold uppercase tracking-wider border transition-all ${
                                  openLetter.status === s
                                    ? letterStatusStyles[s]
                                    : "border-border text-muted-foreground hover:border-border/80"
                                }`}
                                data-ocid={`detail.letters.${s}.toggle`}
                              >
                                {s}
                              </button>
                            ),
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard
                              .writeText(openLetter.text)
                              .then(() => toast.success("Copied to clipboard"));
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded border border-border text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
                          data-ocid="detail.letters.secondary_button"
                        >
                          <Copy className="w-3 h-3" /> Copy
                        </button>
                      </div>
                      {/* Text editor */}
                      <Textarea
                        value={openLetter.text}
                        onChange={(e) =>
                          updateLetter(letter.id, { text: e.target.value })
                        }
                        placeholder="Letter text..."
                        className="bg-input border-border text-foreground font-mono text-xs leading-relaxed resize-y min-h-[240px] placeholder:text-muted-foreground"
                        data-ocid="detail.letters.textarea"
                      />
                      {/* Close */}
                      <button
                        type="button"
                        onClick={() => setOpenLetterId(null)}
                        className="text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors"
                        data-ocid="detail.letters.close_button"
                      >
                        ← Close
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function ChexClear() {
  const [view, setView] = useState<View>("list");
  const [clients, setClients] = useState<Client[]>([]);
  const [ready, setReady] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [generating, setGenerating] = useState(false);
  const [hasStorage, setHasStorage] = useState(false);
  const [showNewPanel, setShowNewPanel] = useState(false);
  const [search, setSearch] = useState("");

  // Settings
  const [apiKey, setApiKey] = useState(
    "VENICE_INFERENCE_KEY_RbYL3qVtmjHsUq-b4ZkNVOjSWwUfIgOU9ieiUCDRtW",
  );
  const [model, setModel] = useState("llama-3.3-70b");

  // Export/Import
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Init ──
  useEffect(() => {
    (async () => {
      const ok = await initStorage();
      setHasStorage(ok);
      if (ok) {
        const [data, sk, sm] = await Promise.all([
          loadClients(),
          window.storage!.get("chexclear_key").catch(() => null),
          window.storage!.get("chexclear_model").catch(() => null),
        ]);
        setClients(data);
        if (sk?.value) setApiKey(sk.value);
        if (sm?.value) setModel(sm.value);
      }
      setReady(true);
    })();
  }, []);

  const persist = useCallback(async (next: Client[]) => {
    setClients(next);
    const ok = await saveClients(next);
    if (ok) toast.success("Saved");
    else toast.error("Save failed");
  }, []);

  const persistDebounced = useCallback((next: Client[]) => {
    setClients(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const ok = await saveClients(next);
      if (ok) toast.success("Saved");
      else toast.error("Save failed");
    }, 600);
  }, []);

  const active = clients.find((c) => c.id === activeId);

  const updateActive = useCallback(
    (updater: (c: Client) => Client) => {
      const next = clients.map((c) => (c.id === activeId ? updater(c) : c));
      persistDebounced(next);
    },
    [clients, activeId, persistDebounced],
  );

  const doGenerate = async () => {
    if (!active) return;
    if (!apiKey) {
      setErr("Set your Venice API key in Settings first.");
      return;
    }
    if (!active.reportText) {
      setErr("No report text. Paste the ChexSystems report first.");
      return;
    }
    setGenerating(true);
    setErr("");
    try {
      const userPrompt = `Client info:\nName: ${active.name}\nAddress: ${active.address}, ${active.cityStateZip}\nSSN last 4: ${active.ssnLast4}\nDOB: ${active.dob}\n\nChexSystems report:\n\n${active.reportText}`;
      const raw = await callVenice(apiKey, model, SYSTEM_PROMPT, userPrompt);
      if (!raw || raw.length < 100)
        throw new Error("Response too short. Try again.");
      const segments = raw
        .split(/={3,}/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0);
      const today = new Date();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      const yyyy = today.getFullYear();
      const dateStr = `${mm}/${dd}/${yyyy}`;
      const newLetters: Letter[] = segments.map((text: string, i: number) => ({
        id: uid(),
        title: `Dispute Letter ${i + 1} of ${segments.length} — ${dateStr}`,
        text,
        createdAt: new Date().toISOString(),
        status: "draft" as LetterStatus,
      }));
      const next = clients.map((c) =>
        c.id === activeId ? { ...c, letters: newLetters } : c,
      );
      await persist(next);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setErr(`Generation failed: ${msg}`);
    }
    setGenerating(false);
  };

  const handleNewClientSave = async (client: Client) => {
    const next = [client, ...clients];
    await persist(next);
    setActiveId(client.id);
    setShowNewPanel(false);
    setView("detail");
    setErr("");
  };

  const handleDeleteClient = async () => {
    if (!active) return;
    if (!confirm(`Delete ${active.name}? This cannot be undone.`)) return;
    const next = clients.filter((c) => c.id !== activeId);
    await persist(next);
    setView("list");
    setActiveId(null);
  };

  const saveSettings = async () => {
    try {
      if (window.storage) {
        await Promise.all([
          window.storage.set("chexclear_key", apiKey),
          window.storage.set("chexclear_model", model),
        ]);
      }
      toast.success("Settings saved");
    } catch {
      toast.error("Save failed");
    }
  };

  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.cityStateZip.toLowerCase().includes(search.toLowerCase()),
  );

  // ── Loading ──
  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  // ── Nav items ──
  const navItems: { key: View; icon: typeof Users; label: string }[] = [
    { key: "list", icon: Users, label: "Clients" },
    { key: "settings", icon: SettingsIcon, label: "Settings" },
  ];

  return (
    <div className="min-h-screen bg-background flex" data-ocid="app.page">
      <Toaster position="top-right" theme="dark" />

      {/* ═══ SIDEBAR ═══ */}
      <aside
        className="w-56 flex-shrink-0 flex flex-col border-r border-border"
        style={{ background: "oklch(var(--sidebar))", minHeight: "100vh" }}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-border">
          <button
            type="button"
            className="cursor-pointer select-none text-left w-full bg-transparent border-none p-0"
            onClick={() => {
              setView("list");
              setErr("");
            }}
          >
            <span className="text-lg font-bold tracking-tight">
              <span className="text-primary">CHEX</span>
              <span className="text-foreground font-light">CLEAR</span>
            </span>
            <p className="text-[10px] font-mono text-muted-foreground mt-0.5 tracking-wide">
              Credit Repair SaaS
            </p>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              view === item.key || (item.key === "list" && view === "detail");
            return (
              <button
                type="button"
                key={item.key}
                onClick={() => {
                  setView(item.key);
                  setErr("");
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
                data-ocid={`nav.${item.key}.link`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="font-head">{item.label}</span>
                {item.key === "list" && clients.length > 0 && (
                  <span
                    className={`ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                      isActive
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {clients.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer tagline */}
        <div className="px-5 pb-5">
          <p className="text-[9px] font-mono text-muted-foreground leading-relaxed opacity-50">
            Can't stack bread with a flagged account.
          </p>
        </div>
      </aside>

      {/* ═══ MAIN ═══ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ── Top bar ── */}
        <header className="h-14 flex items-center px-6 border-b border-border flex-shrink-0 gap-4">
          {view === "detail" && active ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setView("list");
                  setErr("");
                }}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors font-mono"
                data-ocid="detail.back.link"
              >
                <ChevronLeft className="w-4 h-4" />
                All Clients
              </button>
              <Separator orientation="vertical" className="h-5 bg-border" />
              <span className="text-sm font-semibold text-foreground truncate">
                {active.name}
              </span>
              <div className="ml-2">
                <StatusBadge status={active.status} />
              </div>
            </>
          ) : (
            <h1 className="text-sm font-semibold text-foreground">
              {view === "settings" ? "Settings" : "Clients"}
            </h1>
          )}

          <div className="ml-auto flex items-center gap-3">
            {view === "list" && (
              <Button
                onClick={() => setShowNewPanel(true)}
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-head text-xs font-semibold gap-1.5"
                data-ocid="clients.open_modal_button"
              >
                <Plus className="w-3.5 h-3.5" />
                New Client
              </Button>
            )}
          </div>
        </header>

        {/* ── Page Content ── */}
        <main className="flex-1 overflow-auto scrollbar-thin">
          <AnimatePresence mode="wait">
            {/* ─── CLIENT LIST ─── */}
            {view === "list" && (
              <motion.div
                key="list"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className="p-6"
                data-ocid="clients.page"
              >
                {/* No-storage warning */}
                {!hasStorage && clients.length > 0 && (
                  <div
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20 mb-4"
                    data-ocid="clients.error_state"
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                    <span className="text-[11px] font-mono text-destructive">
                      Session only — data won't persist after closing. Use
                      Export to back up.
                    </span>
                  </div>
                )}

                {/* Search */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search clients..."
                    className="pl-9 bg-input border-border text-foreground placeholder:text-muted-foreground font-mono text-sm h-9"
                    data-ocid="clients.search_input"
                  />
                </div>

                {/* Table */}
                {filteredClients.length === 0 ? (
                  <div
                    className="flex flex-col items-center justify-center py-20"
                    data-ocid="clients.empty_state"
                  >
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {search
                        ? "No clients match your search"
                        : "No clients yet"}
                    </p>
                    <p className="text-xs font-mono text-muted-foreground/60 mt-1">
                      {search
                        ? "Try a different search term"
                        : "Click + New Client to get started"}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border overflow-hidden">
                    {/* Table header */}
                    <div className="grid grid-cols-[2fr_1fr_1fr_1fr_80px] gap-4 px-4 py-2.5 border-b border-border bg-muted/30">
                      {[
                        "Client",
                        "Status",
                        "Location",
                        "Created",
                        "Letter",
                      ].map((h) => (
                        <div
                          key={h}
                          className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider"
                        >
                          {h}
                        </div>
                      ))}
                    </div>
                    {/* Table rows */}
                    <div className="divide-y divide-border">
                      {filteredClients.map((c, i) => (
                        <motion.div
                          key={c.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.03 }}
                          onClick={() => {
                            setActiveId(c.id);
                            setView("detail");
                            setErr("");
                          }}
                          className="grid grid-cols-[2fr_1fr_1fr_1fr_80px] gap-4 px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors group"
                          data-ocid={`clients.item.${i + 1}`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <ClientInitials name={c.name} />
                            <span className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                              {c.name}
                            </span>
                          </div>
                          <div className="flex items-center">
                            <StatusBadge status={c.status} />
                          </div>
                          <div className="flex items-center">
                            <span className="text-xs font-mono text-muted-foreground truncate">
                              {c.cityStateZip || "—"}
                            </span>
                          </div>
                          <div className="flex items-center">
                            <span className="text-xs font-mono text-muted-foreground">
                              {c.createdAt}
                            </span>
                          </div>
                          <div className="flex items-center">
                            {c.letters && c.letters.length > 0 ? (
                              <span className="flex items-center gap-1 text-[10px] font-mono text-success">
                                <CheckCircle2 className="w-3 h-3" />{" "}
                                {c.letters.length}
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono text-muted-foreground/50">
                                —
                              </span>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Export / Import */}
                {clients.length > 0 && (
                  <div className="mt-5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowExport((v) => !v);
                        setShowImport(false);
                      }}
                      className="px-4 py-2 rounded-lg border border-border text-[11px] font-mono text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                      data-ocid="clients.export.button"
                    >
                      {showExport ? "Hide Export" : "Export JSON"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowImport((v) => !v);
                        setShowExport(false);
                      }}
                      className="px-4 py-2 rounded-lg border border-border text-[11px] font-mono text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                      data-ocid="clients.import.button"
                    >
                      {showImport ? "Hide Import" : "Import JSON"}
                    </button>
                  </div>
                )}

                <AnimatePresence>
                  {showExport && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 overflow-hidden"
                    >
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            const el = document.getElementById("chex-exp");
                            if (el) {
                              (el as HTMLTextAreaElement).focus();
                              (el as HTMLTextAreaElement).select();
                            }
                          }}
                          className="absolute top-2 right-2 z-10 px-2.5 py-1 rounded bg-primary text-primary-foreground text-[10px] font-mono"
                          data-ocid="clients.export.select_all.button"
                        >
                          Select All
                        </button>
                        <textarea
                          id="chex-exp"
                          readOnly
                          value={JSON.stringify(clients, null, 2)}
                          onFocus={(e) => e.target.select()}
                          className="w-full min-h-[120px] pt-9 px-3 pb-3 rounded-xl border border-border bg-input text-foreground font-mono text-[10px] leading-relaxed resize-y"
                        />
                      </div>
                    </motion.div>
                  )}

                  {showImport && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 space-y-2 overflow-hidden"
                    >
                      <Textarea
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                        placeholder="Paste exported JSON..."
                        className="bg-input border-border text-foreground font-mono text-[10px] min-h-[80px]"
                        data-ocid="clients.import.textarea"
                      />
                      <Button
                        disabled={!importText.trim()}
                        onClick={() => {
                          try {
                            const p = JSON.parse(importText);
                            if (!Array.isArray(p))
                              throw new Error("Not an array");
                            persist(p);
                            setImportText("");
                            setShowImport(false);
                          } catch (e: unknown) {
                            const msg =
                              e instanceof Error ? e.message : "Parse error";
                            setErr(`Import failed: ${msg}`);
                          }
                        }}
                        className="w-full bg-success/80 hover:bg-success text-background font-mono text-sm"
                        data-ocid="clients.import.submit_button"
                      >
                        Load Data
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {err && (
                  <div
                    className="mt-3 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20"
                    data-ocid="clients.error_state"
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                    <span className="text-[11px] font-mono text-destructive">
                      {err}
                    </span>
                  </div>
                )}
              </motion.div>
            )}

            {/* ─── CLIENT DETAIL ─── */}
            {view === "detail" && active && (
              <motion.div
                key="detail"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className="p-6 max-w-3xl space-y-4"
                data-ocid="detail.page"
              >
                {/* Client Info Card */}
                <div className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <ClientInitials name={active.name} />
                      <div>
                        <h2 className="text-base font-semibold text-foreground">
                          {active.name}
                        </h2>
                        <div className="mt-1 space-y-0.5">
                          {active.address && (
                            <p className="text-xs font-mono text-muted-foreground">
                              {active.address}
                            </p>
                          )}
                          {active.cityStateZip && (
                            <p className="text-xs font-mono text-muted-foreground">
                              {active.cityStateZip}
                            </p>
                          )}
                          <div className="flex items-center gap-3 flex-wrap">
                            {active.dob && (
                              <span className="text-[11px] font-mono text-muted-foreground">
                                DOB: {active.dob}
                              </span>
                            )}
                            {active.ssnLast4 && (
                              <span className="text-[11px] font-mono text-muted-foreground">
                                SSN: •••{active.ssnLast4}
                              </span>
                            )}
                            {active.phone && (
                              <span className="text-[11px] font-mono text-muted-foreground">
                                Ph: {active.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleDeleteClient}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-destructive/25 text-destructive hover:bg-destructive/10 transition-colors text-xs font-mono flex-shrink-0"
                      data-ocid="detail.delete_button"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </div>
                </div>

                {/* Status Selector */}
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-3">
                    Status
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(
                      Object.entries(STATUS_CONFIG) as [
                        StatusKey,
                        { label: string },
                      ][]
                    ).map(([key, meta]) => (
                      <button
                        type="button"
                        key={key}
                        onClick={() =>
                          updateActive((c) => ({ ...c, status: key }))
                        }
                        className={`px-3 py-1.5 rounded-lg border text-[11px] font-mono font-medium transition-all duration-150 ${
                          active.status === key
                            ? key === "new"
                              ? "border-muted-foreground/40 bg-muted text-foreground"
                              : key === "letter_sent"
                                ? "border-primary/50 bg-primary/15 text-primary"
                                : key === "waiting"
                                  ? "border-warning/50 bg-warning/10 text-warning"
                                  : key === "resolved"
                                    ? "border-success/50 bg-success/10 text-success"
                                    : "border-destructive/50 bg-destructive/10 text-destructive"
                            : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground"
                        }`}
                        data-ocid={`detail.status.${key}.toggle`}
                      >
                        {meta.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Report Section */}
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                      ChexSystems Report
                    </p>
                    <span
                      className={`text-[10px] font-mono ${
                        active.reportText ? "text-success" : "text-warning"
                      }`}
                    >
                      {active.reportText
                        ? `${active.reportText.length} chars`
                        : "Empty"}
                    </span>
                  </div>
                  <Textarea
                    value={active.reportText}
                    onChange={(e) =>
                      updateActive((c) => ({
                        ...c,
                        reportText: e.target.value,
                      }))
                    }
                    placeholder="Paste the ChexSystems report text here..."
                    className="bg-input border-border text-foreground font-mono text-xs leading-relaxed resize-y min-h-[100px] placeholder:text-muted-foreground"
                    data-ocid="detail.report.textarea"
                  />
                </div>

                {/* Letters Section */}
                <LettersSection
                  letters={active.letters ?? []}
                  generating={generating}
                  hasReport={!!active.reportText}
                  hasApiKey={!!apiKey}
                  onGenerate={doGenerate}
                  onLettersChange={(letters) =>
                    updateActive((c) => ({ ...c, letters }))
                  }
                />

                {/* Notes Section */}
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-3">
                    Notes
                  </p>
                  <Textarea
                    value={active.notes ?? ""}
                    onChange={(e) =>
                      updateActive((c) => ({ ...c, notes: e.target.value }))
                    }
                    placeholder="Add notes about this client..."
                    className="bg-input border-border text-foreground font-mono text-xs leading-relaxed resize-y min-h-[100px] placeholder:text-muted-foreground"
                    data-ocid="detail.notes.textarea"
                  />
                </div>

                {err && (
                  <div
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20"
                    data-ocid="detail.error_state"
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                    <span className="text-[11px] font-mono text-destructive">
                      {err}
                    </span>
                  </div>
                )}
              </motion.div>
            )}

            {/* ─── SETTINGS ─── */}
            {view === "settings" && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className="p-6 max-w-lg"
                data-ocid="settings.page"
              >
                <div className="rounded-xl border border-border bg-card p-5 space-y-5">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-0.5">
                      Venice AI API
                    </h3>
                    <p className="text-xs font-mono text-muted-foreground">
                      Configure your AI letter generation
                    </p>
                  </div>
                  <Separator className="bg-border" />
                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="settings-apikey"
                        className="block text-[11px] font-mono text-muted-foreground mb-1.5 tracking-wide uppercase"
                      >
                        API Key
                      </label>
                      <Input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Enter your Venice API key"
                        className="bg-input border-border text-foreground placeholder:text-muted-foreground font-mono text-sm"
                        id="settings-apikey"
                        data-ocid="settings.api_key.input"
                      />
                      <p className="text-[10px] font-mono text-muted-foreground mt-1.5 leading-relaxed">
                        Get a key at{" "}
                        <a
                          href="https://venice.ai/venice-api"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          venice.ai/venice-api
                        </a>
                      </p>
                    </div>
                    <div>
                      <label
                        htmlFor="settings-model"
                        className="block text-[11px] font-mono text-muted-foreground mb-1.5 tracking-wide uppercase"
                      >
                        Model
                      </label>
                      <Input
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        id="settings-model"
                        placeholder="llama-3.3-70b"
                        className="bg-input border-border text-foreground placeholder:text-muted-foreground font-mono text-sm"
                        data-ocid="settings.model.input"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={saveSettings}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-head text-sm font-semibold"
                    data-ocid="settings.save.button"
                  >
                    Save Settings
                  </Button>
                </div>

                {err && (
                  <div
                    className="mt-3 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20"
                    data-ocid="settings.error_state"
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                    <span className="text-[11px] font-mono text-destructive">
                      {err}
                    </span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* ─── FOOTER ─── */}
        <footer className="border-t border-border px-6 py-3 flex-shrink-0">
          <p className="text-[10px] font-mono text-muted-foreground/50 text-center">
            © {new Date().getFullYear()}.{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-muted-foreground transition-colors"
            >
              Built with ♥ using caffeine.ai
            </a>
          </p>
        </footer>
      </div>

      {/* ═══ NEW CLIENT SLIDE-OVER ═══ */}
      <NewClientPanel
        open={showNewPanel}
        onClose={() => setShowNewPanel(false)}
        onSave={handleNewClientSave}
      />
    </div>
  );
}
