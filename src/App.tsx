import { useState } from "react";
import { computeModel, fmt, fe, fp } from "./model";
import type { InputsBien, ProfilInvestisseur, BienPatrimoine, ResultatsComplets } from "./types";
import { DEFAULT_INPUTS, DEFAULT_PROFIL } from "./types";
import { Chat } from "./Chat";

// ─── STORAGE ─────────────────────────────────────────────────────────────────
function loadProfil(): ProfilInvestisseur {
  try {
    const s = localStorage.getItem("immo_profil");
    return s ? { ...DEFAULT_PROFIL, ...JSON.parse(s) } : DEFAULT_PROFIL;
  } catch { return DEFAULT_PROFIL; }
}
function saveProfil(p: ProfilInvestisseur) {
  try { localStorage.setItem("immo_profil", JSON.stringify(p)); } catch {}
}

// ─── AI ──────────────────────────────────────────────────────────────────────
async function analyzeAnnonce(text: string, mode: "normal" | "approfondi"): Promise<any> {
  const model = mode === "approfondi" ? "claude-opus-4-5" : "claude-sonnet-4-20250514";
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: mode === "approfondi" ? 2000 : 1200,
      system: "Tu es un expert en investissement immobilier français. Réponds UNIQUEMENT en JSON valide, sans backticks ni texte autour.",
      messages: [{ role: "user", content: `Analyse cette annonce immobilière. Si une donnée manque, estime-la de manière CONSERVATRICE.\n\n${text}\n\nRetourne EXACTEMENT ce JSON:\n{"prix":number,"surface":number,"dpe":"A"|"B"|"C"|"D"|"E"|"F"|"G"|null,"charges":number,"taxeFonciere":number,"fondsTravauxCopro":number,"loyerEstime":number,"loyerMaxEncadre":number,"encadrementLoyers":boolean,"prixNuitAirbnbEstime":number,"occupancyAirbnbEstime":number,"fraisAgencePct":number,"travauxEstimes":number,"ameublementEstime":number,"localisation":"string","ville":"string","typeLogement":"string","tensionLocative":"faible"|"moyenne"|"forte"|"tres_forte","risqueAirbnbParis":boolean,"risqueReglementaireAirbnb":"string","risquesDPE":"string","prixM2Marche":number,"prixM2Bien":number,"negociationEstimee":number,"pointsCles":["string"],"alertes":["string"],"opportunites":["string"],"analyseExpert":"string"}` }],
    }),
  });
  const data = await response.json();
  const txt = data?.content?.[0]?.text || JSON.stringify(data);
  return JSON.parse(txt.replace(/```json|```/g, "").trim());
}

// ─── CSS ─────────────────────────────────────────────────────────────────────
const css = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0F0E0C;--surface:#191714;--surface2:#232018;--border:#2E2B25;--border2:#3D3830;--gold:#D4A84B;--gold2:#F0C866;--gold3:#8A6A20;--green:#3D7A52;--green2:#5FAF7A;--red:#8A3030;--red2:#C44F4F;--amber:#8A5A1A;--amber2:#C88A3A;--blue:#2A5A8A;--blue2:#4A8AC4;--text:#F0EAD8;--text2:#A89880;--text3:#6A5E50;--mono:'IBM Plex Mono',monospace;}
body{background:var(--bg);color:var(--text);font-family:'IBM Plex Sans',sans-serif;min-height:100vh;-webkit-font-smoothing:antialiased;}
.app{max-width:1000px;margin:0 auto;padding:0 16px 80px}
.header{padding:28px 0 20px;border-bottom:1px solid var(--border);margin-bottom:22px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
.header h1{font-family:'Playfair Display',serif;font-size:1.7rem;font-weight:400;letter-spacing:-0.01em}
.header h1 span{color:var(--gold);font-style:italic}
.header p{color:var(--text2);font-size:0.75rem;margin-top:2px;font-weight:300}
.profile-chip{background:var(--surface2);border:1px solid var(--border2);border-radius:6px;padding:6px 12px;font-size:0.72rem;color:var(--text2);font-family:var(--mono);cursor:pointer;transition:border-color 0.15s}
.profile-chip:hover{border-color:var(--gold3)}
.profile-chip strong{color:var(--gold);display:block;font-size:0.68rem;margin-bottom:1px}
.tabs{display:flex;gap:2px;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:3px;margin-bottom:18px;flex-wrap:wrap}
.tab{flex:1;min-width:80px;padding:8px 6px;border-radius:5px;border:none;background:transparent;color:var(--text2);font-family:'IBM Plex Sans',sans-serif;font-size:0.73rem;font-weight:500;cursor:pointer;transition:all 0.15s;text-align:center;white-space:nowrap}
.tab.active{background:var(--gold3);color:var(--gold2)}
.tab:hover:not(.active){color:var(--text);background:var(--surface2)}
.tab:disabled{opacity:0.35;cursor:not-allowed}
.section{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:18px;margin-bottom:14px}
.stitle{font-family:'Playfair Display',serif;font-size:0.95rem;color:var(--gold);margin-bottom:14px;display:flex;align-items:center;gap:8px}
.stitle::after{content:'';flex:1;height:1px;background:var(--border)}
textarea{width:100%;background:var(--surface2);border:1px solid var(--border2);border-radius:7px;padding:11px 13px;color:var(--text);font-family:var(--mono);font-size:0.8rem;outline:none;resize:vertical;min-height:90px;line-height:1.5;transition:border-color 0.15s}
textarea:focus{border-color:var(--gold3)}
textarea::placeholder{color:var(--text3)}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:9px}
.grid4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:9px}
@media(max-width:700px){.grid3,.grid4{grid-template-columns:1fr 1fr}}
@media(max-width:480px){.grid2{grid-template-columns:1fr}}
.field{display:flex;flex-direction:column;gap:3px}
.field label{font-size:0.67rem;color:var(--text3);font-family:var(--mono);text-transform:uppercase;letter-spacing:0.05em}
.field input,.field select{background:var(--surface2);border:1px solid var(--border2);border-radius:6px;padding:8px 10px;color:var(--text);font-family:var(--mono);font-size:0.82rem;outline:none;transition:border-color 0.15s;width:100%}
.field input:focus,.field select:focus{border-color:var(--gold3)}
.field select option{background:var(--surface2)}
.toggle-row{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)}
.toggle-row label{font-size:0.8rem;color:var(--text2)}
.toggle{position:relative;width:36px;height:20px;cursor:pointer;flex-shrink:0}
.toggle input{opacity:0;width:0;height:0}
.tslider{position:absolute;inset:0;background:var(--border2);border-radius:10px;transition:0.2s}
.tslider::before{content:'';position:absolute;width:14px;height:14px;left:3px;bottom:3px;background:var(--text3);border-radius:50%;transition:0.2s}
.toggle input:checked+.tslider{background:var(--gold3)}
.toggle input:checked+.tslider::before{transform:translateX(16px);background:var(--gold2)}
.btn{display:inline-flex;align-items:center;gap:6px;padding:9px 16px;border-radius:7px;border:none;font-family:'IBM Plex Sans',sans-serif;font-size:0.83rem;font-weight:500;cursor:pointer;transition:all 0.15s}
.btn-gold{background:var(--gold3);color:var(--gold2);border:1px solid var(--gold)}
.btn-gold:hover{background:var(--gold);color:#0F0E0C}
.btn-blue{background:var(--blue);color:var(--blue2);border:1px solid var(--blue2)}
.btn-blue:hover{background:var(--blue2);color:#fff}
.btn-outline{background:transparent;color:var(--text2);border:1px solid var(--border2)}
.btn-outline:hover{border-color:var(--text2);color:var(--text)}
.btn-danger{background:rgba(138,48,48,0.2);color:var(--red2);border:1px solid var(--red)}
.btn-danger:hover{background:var(--red);color:#fff}
.btn:disabled{opacity:0.4;cursor:not-allowed}
.btn-full{width:100%;justify-content:center;padding:12px;font-size:0.9rem;margin-top:6px}
.btn-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.lbar{height:2px;background:var(--border);border-radius:1px;overflow:hidden;margin:10px 0}
.lbar-fill{height:100%;background:linear-gradient(90deg,var(--gold3),var(--gold2),var(--gold3));background-size:200%;animation:shimmer 1.2s infinite}
@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
.ltext{font-size:0.77rem;color:var(--text2);font-family:var(--mono)}
.mode-badge{font-size:0.63rem;padding:2px 6px;border-radius:10px;font-family:var(--mono);margin-left:5px}
.mode-normal{background:rgba(212,168,75,0.15);color:var(--gold);border:1px solid var(--gold3)}
.mode-approfondi{background:rgba(74,138,196,0.15);color:var(--blue2);border:1px solid var(--blue)}
.pprev{background:var(--surface2);border:1px solid var(--border2);border-radius:8px;padding:13px;margin:10px 0}
.pprev h4{font-size:0.7rem;color:var(--gold);font-family:var(--mono);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:9px}
.chips{display:flex;flex-wrap:wrap;gap:5px}
.chip{background:var(--surface);border:1px solid var(--border2);border-radius:4px;padding:3px 8px;font-size:0.72rem;font-family:var(--mono);color:var(--text2)}
.chip span{color:var(--text)}
.achip{border-color:#8A3030;color:#C44F4F;background:rgba(138,48,48,0.1)}
.wchip{border-color:#8A5A1A;color:#C88A3A;background:rgba(138,90,26,0.1)}
.okchip{border-color:#3D7A52;color:#5FAF7A;background:rgba(61,122,82,0.08)}
.expert-box{background:rgba(74,138,196,0.08);border:1px solid var(--blue);border-radius:8px;padding:13px;margin-top:10px;font-size:0.8rem;color:var(--text2);line-height:1.6}
.expert-box strong{color:var(--blue2);font-family:var(--mono);font-size:0.7rem;display:block;margin-bottom:6px;text-transform:uppercase}
.score-banner{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px 20px;display:flex;align-items:center;gap:16px;margin-bottom:12px;flex-wrap:wrap}
.score-circle{width:64px;height:64px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;border:2px solid currentColor;flex-shrink:0}
.snum{font-family:'Playfair Display',serif;font-size:1.4rem;font-weight:600;line-height:1}
.sten{font-size:0.6rem;color:var(--text3);font-family:var(--mono)}
.sinfo{flex:1;min-width:180px}
.sinfo h3{font-family:'Playfair Display',serif;font-size:1rem}
.sinfo p{font-size:0.73rem;color:var(--text2);margin-top:2px;line-height:1.4}
.ebar{margin-top:7px}
.elabel{font-size:0.67rem;color:var(--text3);font-family:var(--mono);margin-bottom:3px;display:flex;justify-content:space-between}
.btrack{height:5px;background:var(--border);border-radius:3px;overflow:hidden}
.bfill{height:100%;border-radius:3px;transition:width 0.5s ease}
.mgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:12px}
@media(max-width:500px){.mgrid{grid-template-columns:repeat(2,1fr)}}
.mcard{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:11px}
.mlabel{font-size:0.63rem;color:var(--text3);font-family:var(--mono);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px}
.mval{font-family:var(--mono);font-size:1rem;font-weight:500}
.msub{font-size:0.65rem;color:var(--text2);margin-top:2px}
.pos{color:var(--green2)!important}.neg{color:var(--red2)!important}.warn{color:var(--amber2)!important}
.stabs{display:flex;gap:3px;margin-bottom:10px;flex-wrap:wrap}
.stab{padding:6px 11px;border-radius:6px;border:1px solid var(--border2);background:transparent;color:var(--text2);font-size:0.76rem;font-family:'IBM Plex Sans',sans-serif;cursor:pointer;transition:all 0.15s}
.stab.active{background:var(--surface2);color:var(--text);border-color:var(--gold3)}
.sp{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:18px}
.sp-hdr{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:13px;flex-wrap:wrap;gap:8px}
.sp-hdr h3{font-family:'Playfair Display',serif;font-size:1rem}
.sp-hdr p{font-size:0.73rem;color:var(--text2);margin-top:2px}
.bigcf{font-family:var(--mono);font-size:1.7rem;font-weight:500}
.bigcf-l{font-size:0.67rem;color:var(--text3);font-family:var(--mono);text-transform:uppercase}
.bktable{width:100%;border-collapse:collapse;font-size:0.76rem;margin-top:10px}
.bktable tr{border-bottom:1px solid var(--border)}
.bktable td{padding:5px 3px;color:var(--text2);font-family:var(--mono)}
.bktable td:last-child{text-align:right;color:var(--text)}
.bktable .sub td{padding-left:12px;color:var(--text3)!important;font-size:0.7rem}
.bktable .trow td{color:var(--gold)!important;border-top:1px solid var(--border2);padding-top:7px;font-weight:500}
.sgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:10px}
@media(max-width:500px){.sgrid{grid-template-columns:1fr}}
.scard{background:var(--surface2);border:1px solid var(--border2);border-radius:8px;padding:12px}
.scard.best{border-color:var(--gold3);background:rgba(138,106,32,0.08)}
.scard h4{font-size:0.68rem;font-family:var(--mono);color:var(--gold);margin-bottom:5px;text-transform:uppercase;letter-spacing:0.04em}
.scard .scf{font-family:var(--mono);font-size:1rem;font-weight:500;margin-bottom:3px}
.scard p{font-size:0.68rem;color:var(--text2);line-height:1.4}
.bbadge{font-size:0.58rem;background:var(--gold3);color:var(--gold2);padding:1px 5px;border-radius:3px;margin-left:4px;vertical-align:middle}
.abox{border-radius:7px;padding:9px 12px;font-size:0.76rem;margin-bottom:7px;display:flex;gap:8px;align-items:flex-start;line-height:1.5}
.abox.danger{background:rgba(138,48,48,0.12);border:1px solid #8A3030;color:#C44F4F}
.abox.warning{background:rgba(138,90,26,0.1);border:1px solid #8A5A1A;color:#C88A3A}
.abox.info{background:rgba(61,122,82,0.08);border:1px solid #3D7A52;color:#5FAF7A}
.abox.blue{background:rgba(42,90,138,0.1);border:1px solid #2A5A8A;color:#4A8AC4}
.aicon{font-size:0.9rem;flex-shrink:0}
.dvd{height:1px;background:var(--border);margin:12px 0}
.atable{width:100%;border-collapse:collapse;font-size:0.74rem;font-family:var(--mono)}
.atable th{text-align:right;color:var(--text3);font-weight:400;padding:5px 7px;border-bottom:1px solid var(--border);font-size:0.65rem;text-transform:uppercase;letter-spacing:0.04em}
.atable th:first-child{text-align:left}
.atable td{text-align:right;padding:5px 7px;border-bottom:1px solid var(--border);color:var(--text2)}
.atable td:first-child{text-align:left;color:var(--text3)}
.atable tr:hover td{background:var(--surface2)}
.sep-row td{background:var(--border2);height:1px;padding:0}
.proj-table{width:100%;border-collapse:collapse;font-size:0.73rem;font-family:var(--mono)}
.proj-table th{text-align:right;color:var(--text3);font-weight:400;padding:5px 8px;border-bottom:1px solid var(--border);font-size:0.63rem;text-transform:uppercase;white-space:nowrap}
.proj-table th:first-child,.proj-table td:first-child{text-align:left}
.proj-table td{text-align:right;padding:5px 8px;border-bottom:1px solid var(--border);color:var(--text2);white-space:nowrap}
.proj-table td:first-child{color:var(--text3)}
.stress-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:7px;margin-top:10px}
@media(max-width:500px){.stress-grid{grid-template-columns:1fr}}
.stress-card{background:var(--surface2);border:1px solid var(--border2);border-radius:7px;padding:11px}
.stress-card h5{font-size:0.68rem;font-family:var(--mono);color:var(--text3);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:5px}
.stress-card .sv{font-family:var(--mono);font-size:0.95rem;font-weight:500}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:100;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto}
.modal{background:var(--surface);border:1px solid var(--border2);border-radius:12px;padding:24px;max-width:720px;width:100%;margin:auto}
.modal h2{font-family:'Playfair Display',serif;font-size:1.2rem;color:var(--gold);margin-bottom:20px}
.bien-block{background:var(--surface2);border:1px solid var(--border2);border-radius:8px;padding:12px;margin-bottom:10px}
`;

// ─── FIELD COMPONENTS (outside render to prevent focus loss) ─────────────────

interface NumFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  step?: number;
  min?: number;
  max?: number;
}
function NumField({ label, value, onChange, suffix, step, min, max }: NumFieldProps) {
  return (
    <div className="field">
      <label>{label}{suffix ? ` (${suffix})` : ""}</label>
      <input
        type="number"
        value={value}
        step={step || 1}
        min={min}
        max={max}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
      />
    </div>
  );
}

interface TxtFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}
function TxtField({ label, value, onChange, placeholder }: TxtFieldProps) {
  return (
    <div className="field">
      <label>{label}</label>
      <input type="text" value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

interface SelFieldProps {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  options: { value: string | number; label: string }[];
}
function SelField({ label, value, onChange, options }: SelFieldProps) {
  return (
    <div className="field">
      <label>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}
function ToggleRow({ label, checked, onChange }: ToggleRowProps) {
  return (
    <div className="toggle-row">
      <label>{label}</label>
      <label className="toggle">
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
        <span className="tslider" />
      </label>
    </div>
  );
}

// ─── BIEN ROW (stable component outside ProfilModal) ─────────────────────────
interface BienRowProps {
  bien: BienPatrimoine;
  onUpdate: (k: keyof BienPatrimoine, v: any) => void;
  onDelete: () => void;
}
function BienRow({ bien, onUpdate, onDelete }: BienRowProps) {
  return (
    <div className="bien-block">
      <div className="grid3" style={{ marginBottom: 8 }}>
        <SelField label="Type de bien" value={bien.type} onChange={v => onUpdate("type", v)}
          options={[
            { value: "appartement", label: "Appartement" },
            { value: "maison", label: "Maison" },
            { value: "immeuble", label: "Immeuble de rapport" },
            { value: "parking", label: "Parking / Box" },
            { value: "commerce", label: "Local commercial" },
            { value: "sci_ir", label: "SCI à l'IR" },
            { value: "sci_is", label: "SCI à l'IS" },
            { value: "scpi", label: "SCPI" },
            { value: "autre", label: "Autre" },
          ]}
        />
        <TxtField label="Description" value={bien.description} placeholder="Ex: Studio Paris 11e" onChange={v => onUpdate("description", v)} />
        <SelField label="Régime fiscal" value={bien.regimeFiscal} onChange={v => onUpdate("regimeFiscal", v)}
          options={[
            { value: "lmnp_reel", label: "LMNP Réel" },
            { value: "lmnp_micro", label: "LMNP Micro-BIC" },
            { value: "foncier_reel", label: "Foncier Réel" },
            { value: "micro_foncier", label: "Micro-Foncier" },
            { value: "sci_ir", label: "SCI IR" },
            { value: "sci_is", label: "SCI IS" },
            { value: "scpi", label: "SCPI" },
            { value: "rp", label: "Résidence Principale" },
            { value: "autre", label: "Autre" },
          ]}
        />
      </div>
      <div className="grid4">
        <NumField label="Valeur estimée (€)" value={bien.valeurEstimee} onChange={v => onUpdate("valeurEstimee", v)} />
        <NumField label="Capital restant dû (€)" value={bien.capitalRestantDu} onChange={v => onUpdate("capitalRestantDu", v)} />
        <NumField label="Mensualité crédit (€)" value={bien.mensualiteCredit} onChange={v => onUpdate("mensualiteCredit", v)} />
        <NumField label="Loyer perçu (€/mois)" value={bien.loyerMensuelPercu} onChange={v => onUpdate("loyerMensuelPercu", v)} />
      </div>
      <button className="btn btn-danger" style={{ marginTop: 8, padding: "5px 10px", fontSize: "0.73rem" }} onClick={onDelete}>
        Supprimer
      </button>
    </div>
  );
}

// ─── PROFIL MODAL ─────────────────────────────────────────────────────────────
interface ProfilModalProps {
  profil: ProfilInvestisseur;
  onSave: (p: ProfilInvestisseur) => void;
  onClose: () => void;
}
function ProfilModal({ profil, onSave, onClose }: ProfilModalProps) {
  const [p, setP] = useState<ProfilInvestisseur>({ ...profil });

  const sv = (k: keyof ProfilInvestisseur, v: any) =>
    setP(prev => ({ ...prev, [k]: v }));

  const addBien = () => setP(prev => ({
    ...prev,
    biens: [...prev.biens, {
      id: Date.now().toString(),
      type: "appartement" as const,
      description: "",
      valeurEstimee: 0,
      capitalRestantDu: 0,
      mensualiteCredit: 0,
      loyerMensuelPercu: 0,
      regimeFiscal: "lmnp_reel" as const,
    }],
  }));

  const updBien = (id: string, k: keyof BienPatrimoine, v: any) =>
    setP(prev => ({ ...prev, biens: prev.biens.map(b => b.id === id ? { ...b, [k]: v } : b) }));

  const delBien = (id: string) =>
    setP(prev => ({ ...prev, biens: prev.biens.filter(b => b.id !== id) }));

  const revMensuel = (p.salaireBrutAnnuel + p.bonusAnnuel + p.autresRevenusAnnuels) / 12;
  const autresMens = p.biens.reduce((s, b) => s + b.mensualiteCredit, 0);
  const capacite = revMensuel * 0.35 - p.mensualiteRP - autresMens;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>✎ Profil Investisseur</h2>

        <div className="section" style={{ marginBottom: 12 }}>
          <div className="stitle">Identité</div>
          <div className="grid3">
            <TxtField label="Prénom" value={p.prenom} onChange={v => sv("prenom", v)} />
            <SelField label="Situation familiale" value={p.situationFamiliale} onChange={v => sv("situationFamiliale", v)}
              options={[
                { value: "celibataire", label: "Célibataire" },
                { value: "marie", label: "Marié(e)" },
                { value: "pacse", label: "Pacsé(e)" },
                { value: "divorce", label: "Divorcé(e)" },
                { value: "veuf", label: "Veuf / Veuve" },
              ]}
            />
            <NumField label="Nombre d'enfants" value={p.nbEnfants} onChange={v => sv("nbEnfants", v)} />
          </div>
          <div className="grid3" style={{ marginTop: 9 }}>
            <NumField label="Parts fiscales (QF)" value={p.nbPartsFC} onChange={v => sv("nbPartsFC", v)} step={0.5} />
            <SelField label="TMI" value={p.tmi} onChange={v => sv("tmi", parseInt(v))}
              options={[0,11,30,41,45].map(t => ({ value: t, label: `${t}%` }))}
            />
          </div>
        </div>

        <div className="section" style={{ marginBottom: 12 }}>
          <div className="stitle">Revenus annuels bruts</div>
          <div className="grid3">
            <NumField label="Salaire brut (€)" value={p.salaireBrutAnnuel} onChange={v => sv("salaireBrutAnnuel", v)} />
            <NumField label="Bonus annuel (€)" value={p.bonusAnnuel} onChange={v => sv("bonusAnnuel", v)} />
            <NumField label="Autres revenus (€)" value={p.autresRevenusAnnuels} onChange={v => sv("autresRevenusAnnuels", v)} />
          </div>
          <div style={{ marginTop: 8, fontSize: "0.7rem", color: "var(--text3)", fontFamily: "var(--mono)" }}>
            Revenus bruts/mois : <span style={{ color: "var(--gold)" }}>{fmt(revMensuel)} €</span> · Capacité d'emprunt résiduelle : <span style={{ color: capacite >= 0 ? "var(--green2)" : "var(--red2)" }}>{fmt(capacite)} €/mois</span>
          </div>
        </div>

        <div className="section" style={{ marginBottom: 12 }}>
          <div className="stitle">Résidence Principale</div>
          <div className="grid3">
            <NumField label="Mensualité crédit RP (€/mois)" value={p.mensualiteRP} onChange={v => sv("mensualiteRP", v)} />
            <NumField label="Valeur estimée RP (€)" value={p.valeurRP} onChange={v => sv("valeurRP", v)} />
            <NumField label="Capital restant dû (€)" value={p.capitalRestantDuRP} onChange={v => sv("capitalRestantDuRP", v)} />
          </div>
        </div>

        <div className="section" style={{ marginBottom: 12 }}>
          <div className="stitle">Patrimoine immobilier</div>
          {p.biens.length === 0 && (
            <p style={{ fontSize: "0.77rem", color: "var(--text3)", marginBottom: 10 }}>
              Aucun bien. Ajoutez vos investissements existants pour un calcul d'endettement précis.
            </p>
          )}
          {p.biens.map(b => (
            <BienRow
              key={b.id}
              bien={b}
              onUpdate={(k, v) => updBien(b.id, k, v)}
              onDelete={() => delBien(b.id)}
            />
          ))}
          <button className="btn btn-outline" style={{ marginTop: 6 }} onClick={addBien}>+ Ajouter un bien</button>
          {p.biens.length > 0 && (
            <div style={{ marginTop: 10, fontSize: "0.72rem", color: "var(--text3)", fontFamily: "var(--mono)" }}>
              Patrimoine brut : {fe(p.valeurRP + p.biens.reduce((s, b) => s + b.valeurEstimee, 0))} ·
              Dettes : {fe(p.capitalRestantDuRP + p.biens.reduce((s, b) => s + b.capitalRestantDu, 0))} ·
              Mensualités totales : {fe(p.mensualiteRP + autresMens)}/mois
            </div>
          )}
        </div>

        <div className="section" style={{ marginBottom: 12 }}>
          <div className="stitle">Capacité & Objectifs</div>
          <div className="grid3">
            <NumField label="Apport disponible (€)" value={p.apportDisponible} onChange={v => sv("apportDisponible", v)} />
            <NumField label="Épargne de sécurité (€)" value={p.epargneSecurite} onChange={v => sv("epargneSecurite", v)} />
            <NumField label="Horizon de détention (ans)" value={p.horizonDetention} onChange={v => sv("horizonDetention", v)} />
          </div>
          <div className="grid3" style={{ marginTop: 9 }}>
            <SelField label="Objectif principal" value={p.objectif} onChange={v => sv("objectif", v)}
              options={[
                { value: "cashflow", label: "Cashflow immédiat" },
                { value: "patrimoine", label: "Constitution de patrimoine" },
                { value: "defiscalisation", label: "Défiscalisation" },
                { value: "retraite", label: "Préparation retraite" },
                { value: "mixte", label: "Mixte" },
              ]}
            />
            <SelField label="Tolérance au risque" value={p.toleranceRisque} onChange={v => sv("toleranceRisque", v)}
              options={[
                { value: "faible", label: "Faible — sécurité avant tout" },
                { value: "modere", label: "Modérée — équilibré" },
                { value: "eleve", label: "Élevée — j'accepte le risque" },
              ]}
            />
            <TxtField label="Zone cible" value={p.zoneCible} onChange={v => sv("zoneCible", v)} placeholder="Paris, Province…" />
          </div>
          <ToggleRow label="Gestion directe (sans agence locative)" checked={p.gestionDirecte} onChange={v => sv("gestionDirecte", v)} />
        </div>

        <div className="btn-row">
          <button className="btn btn-gold" onClick={() => { onSave(p); onClose(); }}>✓ Sauvegarder le profil</button>
          <button className="btn btn-outline" onClick={onClose}>Annuler</button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("saisie");
  const [inputs, setInputs] = useState<InputsBien>(DEFAULT_INPUTS);
  const [profil, setProfil] = useState<ProfilInvestisseur>(loadProfil);
  const [showProfil, setShowProfil] = useState(false);
  const [urlText, setUrlText] = useState("");
  const [analyzeMode, setAnalyzeMode] = useState<"normal" | "approfondi">("normal");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [parsed, setParsed] = useState<any>(null);
  const [results, setResults] = useState<ResultatsComplets | null>(null);
  const [sTab, setSTab] = useState("lld");

  const setIn = (k: keyof InputsBien, v: any) =>
    setInputs(prev => ({ ...prev, [k]: v }));

  const handleAnalyze = async () => {
    if (!urlText.trim()) return;
    setLoading(true);
    setLoadingMsg(analyzeMode === "approfondi" ? "Analyse approfondie Opus en cours…" : "Analyse Sonnet en cours…");
    try {
      const data = await analyzeAnnonce(urlText, analyzeMode);
      setParsed(data);
      const merged: InputsBien = {
        ...inputs,
        prix: Number(data.prix) > 0 ? Number(data.prix) : inputs.prix,
        surface: Number(data.surface) > 0 ? Number(data.surface) : inputs.surface,
        dpe: data.dpe || inputs.dpe,
        charges: Number(data.charges) > 0 ? Number(data.charges) : inputs.charges,
        taxeFonciere: Number(data.taxeFonciere) > 0 ? Number(data.taxeFonciere) : inputs.taxeFonciere,
        fondsTravauxCopro: Number(data.fondsTravauxCopro) > 0 ? Number(data.fondsTravauxCopro) : inputs.fondsTravauxCopro,
        loyerEstime: Number(data.loyerEstime) > 0 ? Number(data.loyerEstime) : inputs.loyerEstime,
        loyerMaxEncadre: Number(data.loyerMaxEncadre) > 0 ? Number(data.loyerMaxEncadre) : inputs.loyerMaxEncadre,
        encadrementLoyers: typeof data.encadrementLoyers === "boolean" ? data.encadrementLoyers : inputs.encadrementLoyers,
        prixNuitAirbnb: Number(data.prixNuitAirbnbEstime) > 0 ? Number(data.prixNuitAirbnbEstime) : inputs.prixNuitAirbnb,
        occupancyAirbnb: Number(data.occupancyAirbnbEstime) > 0 ? Number(data.occupancyAirbnbEstime) : inputs.occupancyAirbnb,
        travaux: Number(data.travauxEstimes) >= 0 ? Number(data.travauxEstimes) : inputs.travaux,
        ameublement: Number(data.ameublementEstime) >= 0 ? Number(data.ameublementEstime) : inputs.ameublement,
        fraisAgencePct: Number(data.fraisAgencePct) >= 0 ? Number(data.fraisAgencePct) : inputs.fraisAgencePct,
        ville: data.ville || inputs.ville,
        tensionLocative: data.tensionLocative || inputs.tensionLocative,
      };
      setInputs(merged);
      setResults(computeModel(merged, profil));
      setTab("resultats");
    } catch (e: any) {
      alert("Erreur d'analyse : " + e.message);
    }
    setLoading(false);
  };

  const handleCompute = () => {
    setResults(computeModel(inputs, profil));
    setTab("resultats");
  };

  const r = results;
  const revenuMensuel = (profil.salaireBrutAnnuel + profil.bonusAnnuel + profil.autresRevenusAnnuels) / 12;

  return (
    <>
      <style>{css}</style>
      {showProfil && (
        <ProfilModal
          profil={profil}
          onSave={p => { setProfil(p); saveProfil(p); }}
          onClose={() => setShowProfil(false)}
        />
      )}

      <div className="app">
        {/* HEADER */}
        <div className="header">
          <div>
            <h1>Invest<span>Immo</span></h1>
            <p>Modèle d'analyse locative professionnel</p>
          </div>
          <div className="profile-chip" onClick={() => setShowProfil(true)}>
            <strong>PROFIL INVESTISSEUR ✎</strong>
            {profil.prenom || "Cliquez pour configurer"} · TMI {profil.tmi}% · RP {fmt(profil.mensualiteRP)}€/mois
          </div>
        </div>

        {/* TABS */}
        <div className="tabs">
          {[
            ["saisie", "① Saisie"],
            ["parametres", "② Paramètres"],
            ["resultats", "③ Résultats"],
            ["projections", "④ Projections"],
            ["amort", "⑤ Prêt"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={`tab ${tab === id ? "active" : ""}`}
              onClick={() => setTab(id)}
              disabled={["resultats", "projections", "amort"].includes(id) && !r}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── SAISIE ── */}
        {tab === "saisie" && (
          <>
            <div className="section">
              <div className="stitle">Analyser une annonce</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <button className={`btn ${analyzeMode === "normal" ? "btn-gold" : "btn-outline"}`} onClick={() => setAnalyzeMode("normal")}>
                  Sonnet <span className="mode-badge mode-normal">Rapide</span>
                </button>
                <button className={`btn ${analyzeMode === "approfondi" ? "btn-blue" : "btn-outline"}`} onClick={() => setAnalyzeMode("approfondi")}>
                  Opus <span className="mode-badge mode-approfondi">Approfondi</span>
                </button>
              </div>
              <textarea
                placeholder={"Colle ici l'URL ou le texte complet de l'annonce.\n\nSonnet : extraction rapide (~2 centimes)\nOpus : analyse experte avec détection de risques cachés (~10 centimes)"}
                value={urlText}
                onChange={e => setUrlText(e.target.value)}
                style={{ minHeight: 100 }}
              />
              <div className="btn-row">
                <button
                  className={`btn ${analyzeMode === "approfondi" ? "btn-blue" : "btn-gold"}`}
                  onClick={handleAnalyze}
                  disabled={loading || !urlText.trim()}
                >
                  {loading ? "Analyse en cours…" : analyzeMode === "approfondi" ? "✦ Analyse Opus approfondie" : "✦ Analyser avec l'IA"}
                </button>
                <button className="btn btn-outline" onClick={() => { setParsed(null); setUrlText(""); }}>Réinitialiser</button>
              </div>
              {loading && (
                <>
                  <div className="lbar"><div className="lbar-fill" /></div>
                  <div className="ltext">{loadingMsg}</div>
                </>
              )}
            </div>

            {parsed && (
              <div className="pprev">
                <h4>✓ Données extraites {analyzeMode === "approfondi" && <span className="mode-badge mode-approfondi">Opus</span>}</h4>
                <div className="chips">
                  {parsed.typeLogement && <div className="chip">{parsed.typeLogement} · <span>{parsed.localisation}</span></div>}
                  {parsed.prix > 0 && <div className="chip">Prix <span>{fe(parsed.prix)}</span></div>}
                  {parsed.surface > 0 && <div className="chip">Surface <span>{parsed.surface} m²</span></div>}
                  {parsed.prixM2Bien > 0 && parsed.prixM2Marche > 0 && (
                    <div className={`chip ${parsed.prixM2Bien > parsed.prixM2Marche * 1.05 ? "wchip" : "okchip"}`}>
                      Prix/m² <span>{fmt(parsed.prixM2Bien)}€</span> vs marché <span>{fmt(parsed.prixM2Marche)}€</span>
                    </div>
                  )}
                  {parsed.dpe && <div className={`chip ${["F","G"].includes(parsed.dpe) ? "achip" : parsed.dpe === "E" ? "wchip" : ""}`}>DPE <span>{parsed.dpe}</span></div>}
                  {parsed.charges > 0 && <div className="chip">Charges <span>{fe(parsed.charges)}/mois</span></div>}
                  {parsed.loyerEstime > 0 && <div className="chip">Loyer <span>{fe(parsed.loyerEstime)}/mois</span></div>}
                  {parsed.prixNuitAirbnbEstime > 0 && <div className="chip">Airbnb <span>{fe(parsed.prixNuitAirbnbEstime)}/nuit · {parsed.occupancyAirbnbEstime}%</span></div>}
                  {parsed.tensionLocative && <div className="chip">Tension <span>{parsed.tensionLocative}</span></div>}
                  {parsed.negociationEstimee > 0 && <div className="okchip chip">Négo estimée <span>−{fe(parsed.negociationEstimee)}</span></div>}
                  {parsed.travauxEstimes > 0 && <div className="chip wchip">Travaux <span>{fe(parsed.travauxEstimes)}</span></div>}
                  {parsed.risqueAirbnbParis && <div className="chip achip">⚠ Risque Airbnb Paris</div>}
                  {parsed.encadrementLoyers && <div className="chip wchip">⚠ Loyers encadrés</div>}
                </div>
                {(parsed.alertes || []).map((a: string, i: number) => (
                  <div key={i} className="abox warning" style={{ marginTop: 6 }}><span className="aicon">⚠</span>{a}</div>
                ))}
                {(parsed.opportunites || []).map((o: string, i: number) => (
                  <div key={i} className="abox info" style={{ marginTop: 5 }}><span className="aicon">✓</span>{o}</div>
                ))}
                {parsed.analyseExpert && (
                  <div className="expert-box"><strong>Analyse Expert Opus</strong>{parsed.analyseExpert}</div>
                )}
                {(parsed.pointsCles || []).length > 0 && (
                  <div style={{ marginTop: 9, fontSize: "0.75rem", color: "var(--text2)", lineHeight: 1.6 }}>
                    <div style={{ fontSize: "0.67rem", color: "var(--text3)", fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Points clés</div>
                    {parsed.pointsCles.map((pt: string, i: number) => <div key={i}>· {pt}</div>)}
                  </div>
                )}
              </div>
            )}

            <div className="section">
              <div className="stitle">Données du bien</div>
              <div className="grid4">
                <NumField label="Prix de vente (€)" value={inputs.prix} onChange={v => setIn("prix", v)} />
                <NumField label="Surface (m²)" value={inputs.surface} onChange={v => setIn("surface", v)} />
                <SelField label="DPE" value={inputs.dpe || ""} onChange={v => setIn("dpe", v)}
                  options={[{ value: "", label: "Non renseigné" }, ...["A","B","C","D","E","F","G"].map(d => ({ value: d, label: d }))]}
                />
                <SelField label="Tension locative" value={inputs.tensionLocative} onChange={v => setIn("tensionLocative", v)}
                  options={[
                    { value: "faible", label: "Faible (vacance 12%)" },
                    { value: "moyenne", label: "Moyenne (vacance 8%)" },
                    { value: "forte", label: "Forte (vacance 5%)" },
                    { value: "tres_forte", label: "Très forte (vacance 3%)" },
                  ]}
                />
              </div>
              <div className="grid4" style={{ marginTop: 9 }}>
                <NumField label="Charges copro (€/mois)" value={inputs.charges} onChange={v => setIn("charges", v)} />
                <NumField label="Taxe foncière (€/an)" value={inputs.taxeFonciere} onChange={v => setIn("taxeFonciere", v)} />
                <NumField label="Fonds travaux copro (€/an)" value={inputs.fondsTravauxCopro} onChange={v => setIn("fondsTravauxCopro", v)} />
                <NumField label="Frais agence (%)" value={inputs.fraisAgencePct} onChange={v => setIn("fraisAgencePct", v)} step={0.5} />
              </div>
              <div className="grid4" style={{ marginTop: 9 }}>
                <NumField label="Travaux prévus (€)" value={inputs.travaux} onChange={v => setIn("travaux", v)} />
                <NumField label="Ameublement (€)" value={inputs.ameublement} onChange={v => setIn("ameublement", v)} />
                <NumField label="Frais garantie bancaire (€)" value={inputs.fraisGarantie} onChange={v => setIn("fraisGarantie", v)} />
                <NumField label="Apport (€)" value={inputs.apport} onChange={v => setIn("apport", v)} />
              </div>
              <ToggleRow label="Encadrement des loyers (Paris, Lille, Lyon…)" checked={inputs.encadrementLoyers} onChange={v => setIn("encadrementLoyers", v)} />
              {inputs.encadrementLoyers && (
                <div style={{ marginTop: 9 }}>
                  <NumField label="Loyer max encadré HC (€/mois)" value={inputs.loyerMaxEncadre} onChange={v => setIn("loyerMaxEncadre", v)} />
                </div>
              )}
            </div>

            <div className="section">
              <div className="stitle">Revenus locatifs</div>
              <div className="grid4">
                <NumField label="Loyer meublé HC (€/mois)" value={inputs.loyerEstime} onChange={v => setIn("loyerEstime", v)} />
                <NumField label="Prix nuit Airbnb (€)" value={inputs.prixNuitAirbnb} onChange={v => setIn("prixNuitAirbnb", v)} />
                <NumField label="Taux occupation (%)" value={inputs.occupancyAirbnb} onChange={v => setIn("occupancyAirbnb", v)} step={1} min={0} max={100} />
                <NumField label="Taux GLI (%)" value={inputs.tauxGLI} onChange={v => setIn("tauxGLI", v)} step={0.1} />
              </div>
              <ToggleRow label="Avec conciergerie Airbnb (22% des revenus)" checked={inputs.avecConciergerie} onChange={v => setIn("avecConciergerie", v)} />
              <ToggleRow label="GLI — Garantie Loyers Impayés" checked={inputs.avecGLI} onChange={v => setIn("avecGLI", v)} />
            </div>

            <button className="btn btn-gold btn-full" onClick={handleCompute}>
              Calculer le modèle financier →
            </button>
          </>
        )}

        {/* ── PARAMÈTRES ── */}
        {tab === "parametres" && (
          <>
            <div className="section">
              <div className="stitle">Financement</div>
              <div className="grid4">
                <NumField label="Taux prêt (%)" value={inputs.tauxPret} onChange={v => setIn("tauxPret", v)} step={0.05} />
                <NumField label="Durée prêt (ans)" value={inputs.dureePret} onChange={v => setIn("dureePret", v)} />
                <NumField label="Taux assurance (%)" value={inputs.tauxAssurance} onChange={v => setIn("tauxAssurance", v)} step={0.01} />
                <NumField label="Frais comptable LMNP (€/an)" value={inputs.fraisComptable} onChange={v => setIn("fraisComptable", v)} />
              </div>
            </div>
            <div className="section">
              <div className="stitle">Hypothèses économiques (conservatrices)</div>
              <div className="grid4">
                <NumField label="Inflation loyers (%/an)" value={inputs.inflationLoyer} onChange={v => setIn("inflationLoyer", v)} step={0.1} />
                <NumField label="Inflation charges (%/an)" value={inputs.inflationCharges} onChange={v => setIn("inflationCharges", v)} step={0.1} />
                <NumField label="Revalorisation prix (%/an)" value={inputs.inflationPrix} onChange={v => setIn("inflationPrix", v)} step={0.1} />
                <NumField label="Horizon de calcul (ans)" value={inputs.horizon} onChange={v => setIn("horizon", v)} />
              </div>
            </div>
            <div className="abox info">
              <span className="aicon">ℹ</span>
              <div>
                Profil : <strong>{profil.prenom || "Non configuré"}</strong> · TMI {profil.tmi}% · RP {fmt(profil.mensualiteRP)}€/mois · Revenus {fmt(revenuMensuel)}€/mois.{" "}
                <span style={{ cursor: "pointer", color: "var(--gold)", textDecoration: "underline" }} onClick={() => setShowProfil(true)}>Modifier le profil →</span>
              </div>
            </div>
            <button className="btn btn-gold btn-full" onClick={handleCompute}>Recalculer →</button>
          </>
        )}

        {/* ── RÉSULTATS ── */}
        {tab === "resultats" && r && (() => {
          const edColor = r.tauxEndettement > 35 ? "var(--red2)" : r.tauxEndettement > 32 ? "var(--amber2)" : "var(--green2)";
          const bestCF = Math.max(r.cfDirectLMNP, r.cfSCIIR, r.cfSCIIS);
          return (
            <>
              <div className="score-banner">
                <div className="score-circle" style={{ color: r.scoreColor, borderColor: r.scoreColor }}>
                  <span className="snum" style={{ color: r.scoreColor }}>{r.scoreOpportunite}</span>
                  <span className="sten">/100</span>
                </div>
                <div className="sinfo">
                  <h3 style={{ color: r.scoreColor }}>{r.scoreLabel}</h3>
                  <p>Score conservateur · rendement, cashflow, endettement, DPE, TRI {inputs.horizon} ans, stress test</p>
                  <div className="ebar">
                    <div className="elabel">
                      <span>Taux d'endettement total</span>
                      <span style={{ color: edColor }}>{fp(r.tauxEndettement)} / 35% HCSF</span>
                    </div>
                    <div className="btrack">
                      <div className="bfill" style={{ width: `${Math.min(100, r.tauxEndettement / 0.35)}%`, background: edColor }} />
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right", minWidth: 110 }}>
                  <div style={{ fontSize: "0.65rem", color: "var(--text3)", fontFamily: "var(--mono)", textTransform: "uppercase", marginBottom: 3 }}>Break-even</div>
                  <div style={{ fontFamily: "var(--mono)", fontSize: "1rem", color: r.breakEven <= inputs.horizon ? "var(--green2)" : "var(--amber2)" }}>
                    {r.breakEven <= inputs.horizon ? `Année ${r.breakEven}` : "> horizon"}
                  </div>
                  <div style={{ fontSize: "0.65rem", color: "var(--text3)", fontFamily: "var(--mono)", marginTop: 2 }}>CF cumulé ≥ 0</div>
                </div>
              </div>

              {r.margeEndettement < 0 && (
                <div className="abox danger"><span className="aicon">🚫</span>
                  <div><strong>Taux d'endettement dépassé.</strong> Dépasse la règle HCSF 35%. Augmentez l'apport ({fe(-r.margeEndettement)}/mois à libérer).</div>
                </div>
              )}
              {(inputs.dpe === "F" || inputs.dpe === "G") && (
                <div className="abox danger"><span className="aicon">⚡</span>
                  <div><strong>DPE {inputs.dpe} — Passoire thermique.</strong> Location interdite. Travaux obligatoires ({fe(r.travauxDPE)} estimés, +15% imprévus inclus).</div>
                </div>
              )}
              {inputs.encadrementLoyers && inputs.loyerMaxEncadre > 0 && inputs.loyerEstime > inputs.loyerMaxEncadre && (
                <div className="abox warning"><span className="aicon">⚠</span>
                  <div><strong>Loyer encadré.</strong> Plafond légal {fe(inputs.loyerMaxEncadre)}/mois appliqué dans le modèle.</div>
                </div>
              )}
              {parsed?.risqueAirbnbParis && (
                <div className="abox warning"><span className="aicon">⚠</span>
                  <div><strong>Risque Airbnb Paris.</strong> {parsed.risqueReglementaireAirbnb || "Vérifiez le règlement PLU."}</div>
                </div>
              )}

              <div className="section">
                <div className="stitle">Acquisition & Financement</div>
                <div className="mgrid">
                  <div className="mcard"><div className="mlabel">Prix FAI</div><div className="mval">{fe(inputs.prix)}</div></div>
                  <div className="mcard"><div className="mlabel">Frais notaire</div><div className="mval warn">{fe(r.fraisNotaire)}</div><div className="msub">8,2% ancien</div></div>
                  <div className="mcard"><div className="mlabel">Travaux + DPE</div><div className="mval warn">{fe(r.travauxTotal)}</div><div className="msub">+15% imprévus</div></div>
                  <div className="mcard"><div className="mlabel">Garantie + courtier</div><div className="mval">{fe(r.fraisGarantie + r.fraisCourtier)}</div></div>
                  <div className="mcard"><div className="mlabel">Montant emprunté</div><div className="mval">{fe(r.montantEmprunte)}</div></div>
                  <div className="mcard"><div className="mlabel">Mensualité totale</div><div className="mval">{fe(r.mensualiteTotale)}</div><div className="msub">crédit + assurance</div></div>
                  <div className="mcard"><div className="mlabel">Coût total crédit</div><div className="mval neg">{fe(r.coutTotalCredit)}</div></div>
                  <div className="mcard"><div className="mlabel">Cash sorti</div><div className="mval neg">{fe(r.totalInvesti)}</div><div className="msub">apport + travaux + meubles</div></div>
                  <div className="mcard"><div className="mlabel">Total acquisition</div><div className="mval">{fe(r.totalAcquisition)}</div></div>
                </div>
              </div>

              <div className="section">
                <div className="stitle">Patrimoine à horizon {inputs.horizon} ans</div>
                <div className="mgrid">
                  <div className="mcard"><div className="mlabel">Valeur estimée</div><div className="mval">{fe(inputs.prix * Math.pow(1 + inputs.inflationPrix / 100, inputs.horizon))}</div><div className="msub">+{fp(inputs.inflationPrix)}/an</div></div>
                  <div className="mcard"><div className="mlabel">Plus-value brute</div><div className="mval pos">{fe(r.plusValueBrute)}</div></div>
                  <div className="mcard"><div className="mlabel">Impôt plus-value</div><div className="mval neg">{fe(r.impotPlusValue)}</div><div className="msub">après abattements</div></div>
                  <div className="mcard"><div className="mlabel">Patrimoine net</div><div className="mval pos">{fe(r.patrimoineNetHorizon)}</div><div className="msub">valeur − CRD − impôt PV</div></div>
                  <div className="mcard"><div className="mlabel">CF LLD cumulé</div><div className={`mval ${r.lld.cashflowAnnuel * inputs.horizon >= 0 ? "pos" : "neg"}`}>{fe(r.lld.cashflowAnnuel * inputs.horizon)}</div></div>
                  <div className="mcard"><div className="mlabel">Break-even</div><div className={`mval ${r.breakEven <= inputs.horizon ? "pos" : "warn"}`}>{r.breakEven <= inputs.horizon ? `An ${r.breakEven}` : "> horizon"}</div></div>
                </div>
              </div>

              <div className="section">
                <div className="stitle">Stress Test (impact cashflow mensuel LLD)</div>
                <div className="stress-grid">
                  <div className="stress-card">
                    <h5>Taux +1%</h5>
                    <div className={`sv ${r.stressTest.tauxPlus1 >= 0 ? "pos" : "neg"}`}>{fe(r.stressTest.tauxPlus1)}/mois</div>
                    <div style={{ fontSize: "0.67rem", color: "var(--text3)", marginTop: 3 }}>Si taux +1pt</div>
                  </div>
                  <div className="stress-card">
                    <h5>Vacance +5%</h5>
                    <div className={`sv ${r.stressTest.vacancePlus5 >= 0 ? "pos" : "neg"}`}>{fe(r.stressTest.vacancePlus5)}/mois</div>
                    <div style={{ fontSize: "0.67rem", color: "var(--text3)", marginTop: 3 }}>Vacance supplémentaire</div>
                  </div>
                  <div className="stress-card">
                    <h5>Loyer −10%</h5>
                    <div className={`sv ${r.stressTest.loyerMoins10 >= 0 ? "pos" : "neg"}`}>{fe(r.stressTest.loyerMoins10)}/mois</div>
                    <div style={{ fontSize: "0.67rem", color: "var(--text3)", marginTop: 3 }}>Loyer surestimé</div>
                  </div>
                  <div className="stress-card" style={{ borderColor: r.stressTest.cumulatif >= 0 ? "var(--green)" : "var(--red)" }}>
                    <h5>Scénario cumulatif ⚠</h5>
                    <div className={`sv ${r.stressTest.cumulatif >= 0 ? "pos" : "neg"}`}>{fe(r.stressTest.cumulatif)}/mois</div>
                    <div style={{ fontSize: "0.67rem", color: "var(--text3)", marginTop: 3 }}>Taux+1% + vacance+5% + loyer-10%</div>
                  </div>
                </div>
              </div>

              <div className="stabs">
                {[["lld","📋 LLD Meublé"],["airbnb","✈ Airbnb"],["structure","⚖ Structures"]].map(([id, label]) => (
                  <button key={id} className={`stab ${sTab === id ? "active" : ""}`} onClick={() => setSTab(id)}>{label}</button>
                ))}
              </div>

              {sTab === "lld" && (
                <div className="sp">
                  <div className="sp-hdr">
                    <div>
                      <h3>Location Longue Durée — Meublé LMNP Réel</h3>
                      <p>Tension {inputs.tensionLocative} · GLI {inputs.avecGLI ? "incluse" : "exclue"} · Gestion {profil.gestionDirecte ? "directe" : "agence 8%"}</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="bigcf-l">Cashflow mensuel net</div>
                      <div className={`bigcf ${r.lld.cashflowMensuel >= 0 ? "pos" : "neg"}`}>{fe(r.lld.cashflowMensuel)}</div>
                    </div>
                  </div>
                  <div className="mgrid">
                    <div className="mcard"><div className="mlabel">Rendement brut</div><div className="mval">{fp(r.lld.rendementBrut)}</div></div>
                    <div className="mcard"><div className="mlabel">Rendement net-net</div><div className={`mval ${r.lld.rendementNet >= 4 ? "pos" : r.lld.rendementNet >= 2 ? "warn" : "neg"}`}>{fp(r.lld.rendementNet)}</div></div>
                    <div className="mcard"><div className="mlabel">TRI {inputs.horizon} ans</div><div className={`mval ${r.lld.tri >= 6 ? "pos" : r.lld.tri >= 3 ? "warn" : "neg"}`}>{fp(r.lld.tri)}</div></div>
                  </div>
                  <table className="bktable">
                    <tbody>
                      {Object.entries(r.lld.detailCharges).map(([k, v]) => (
                        <tr key={k} className={(v as number) < 0 ? "sub" : ""}>
                          <td>{k}</td>
                          <td className={(v as number) < 0 ? "neg" : ""}>{(v as number) < 0 ? "− " : ""}{fe(Math.abs(v as number))}</td>
                        </tr>
                      ))}
                      <tr className="trow">
                        <td>= Cashflow net annuel</td>
                        <td className={r.lld.cashflowAnnuel >= 0 ? "pos" : "neg"}>{fe(r.lld.cashflowAnnuel)}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="dvd" />
                  <div style={{ fontSize: "0.74rem", color: "var(--text2)" }}>
                    ✦ Amortissements LMNP déductibles : {fe(r.totalAmort)}/an · Économie fiscale estimée : ~{fe(r.totalAmort * profil.tmi / 100)}/an
                  </div>
                </div>
              )}

              {sTab === "airbnb" && (
                <div className="sp">
                  <div className="sp-hdr">
                    <div>
                      <h3>Airbnb / Location Courte Durée</h3>
                      <p>{inputs.avecConciergerie ? "Conciergerie 22%" : "Autogestion 4%"} · −10% conservateur</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="bigcf-l">Cashflow mensuel net</div>
                      <div className={`bigcf ${r.airbnb.cashflowMensuel >= 0 ? "pos" : "neg"}`}>{fe(r.airbnb.cashflowMensuel)}</div>
                    </div>
                  </div>
                  <div className="mgrid">
                    <div className="mcard"><div className="mlabel">CA Airbnb annuel</div><div className="mval">{fe(r.airbnb.detailCharges["CA brut Airbnb"] as number)}</div></div>
                    <div className="mcard"><div className="mlabel">Rendement brut</div><div className={`mval ${r.airbnb.rendementBrut >= 8 ? "pos" : "warn"}`}>{fp(r.airbnb.rendementBrut)}</div></div>
                    <div className="mcard"><div className="mlabel">TRI {inputs.horizon} ans</div><div className={`mval ${r.airbnb.tri >= 6 ? "pos" : r.airbnb.tri >= 3 ? "warn" : "neg"}`}>{fp(r.airbnb.tri)}</div></div>
                  </div>
                  <table className="bktable">
                    <tbody>
                      {Object.entries(r.airbnb.detailCharges).map(([k, v]) => (
                        <tr key={k} className={(v as number) < 0 ? "sub" : ""}>
                          <td>{k}</td>
                          <td className={(v as number) < 0 ? "neg" : ""}>{(v as number) < 0 ? "− " : ""}{fe(Math.abs(v as number))}</td>
                        </tr>
                      ))}
                      <tr className="trow">
                        <td>= Cashflow net annuel</td>
                        <td className={r.airbnb.cashflowAnnuel >= 0 ? "pos" : "neg"}>{fe(r.airbnb.cashflowAnnuel)}</td>
                      </tr>
                    </tbody>
                  </table>
                  {parsed?.risqueAirbnbParis && (
                    <div className="abox danger" style={{ marginTop: 10 }}><span className="aicon">🚫</span>
                      <div><strong>Paris — Vérification obligatoire.</strong> Ce scénario peut être illégal selon la zone.</div>
                    </div>
                  )}
                </div>
              )}

              {sTab === "structure" && (
                <div className="sp">
                  <div className="stitle" style={{ marginBottom: 10 }}>Comparatif structures juridiques</div>
                  <div className="sgrid">
                    {[
                      { title: "LMNP Direct Réel", cf: r.cfDirectLMNP, desc: "Amortissement bien + mobilier déductible. Déficit BIC imputable. Optimal pour 1-2 biens avec TMI 30%." },
                      { title: "SCI à l'IR", cf: r.cfSCIIR, desc: "Revenus fonciers, pas d'amortissement. PS 17,2% en sus. Utile pour transmission patrimoniale." },
                      { title: "SCI à l'IS", cf: r.cfSCIIS, desc: "IS 15% jusqu'à 42 500€. Amortissement possible. Mais double imposition dividendes (PFU 30%) + à la revente." },
                    ].map(({ title, cf, desc }) => (
                      <div key={title} className={`scard ${cf === bestCF ? "best" : ""}`}>
                        <h4>{title}{cf === bestCF && <span className="bbadge">✓ Optimal</span>}</h4>
                        <div className={`scf ${cf >= 0 ? "pos" : "neg"}`}>{fe(cf)}/an</div>
                        <p>{desc}</p>
                      </div>
                    ))}
                  </div>
                  <div className="abox info" style={{ marginTop: 10 }}>
                    <span className="aicon">💡</span>
                    <div>Avec TMI {profil.tmi}%, la <strong>détention directe LMNP réel</strong> est quasi systématiquement optimale sur 1-2 biens. Consultez un expert-comptable LMNP.</div>
                  </div>
                  <div className="abox blue" style={{ marginTop: 7 }}>
                    <span className="aicon">📋</span>
                    <div><strong>Dispositif Jeanbrun 2026 :</strong> Remplace Pinel (voté jan. 2026). Amortissement 3,5–5,5% dans l'ancien rénové. Rendements nets jusqu'à 8–9% dans certaines villes moyennes.</div>
                  </div>
                </div>
              )}

              <Chat results={r} inputs={inputs} profil={profil} />
            </>
          );
        })()}

        {/* ── PROJECTIONS ── */}
        {tab === "projections" && r && (
          <>
            <div className="section">
              <div className="stitle">Projections LLD — {inputs.horizon} ans</div>
              <div style={{ overflowX: "auto" }}>
                <table className="proj-table">
                  <thead>
                    <tr>
                      <th>Année</th><th>Loyer brut</th><th>Charges</th><th>Intérêts</th>
                      <th>Impôt</th><th>Cashflow</th><th>CF cumulé</th><th>Valeur bien</th><th>Patrimoine net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.lld.projections.map(row => (
                      <tr key={row.annee}>
                        <td>An {row.annee}</td>
                        <td>{fe(row.loyerBrut)}</td>
                        <td className="neg">{fe(row.chargesTotal)}</td>
                        <td className="neg">{fe(row.interets)}</td>
                        <td className="neg">{fe(row.impot)}</td>
                        <td className={row.cashflow >= 0 ? "pos" : "neg"}>{fe(row.cashflow)}</td>
                        <td className={row.cashflowCumule >= 0 ? "pos" : "neg"}>{fe(row.cashflowCumule)}</td>
                        <td>{fe(row.valeurBien)}</td>
                        <td className="pos">{fe(row.patrimoineNet)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="section">
              <div className="stitle">Projections Airbnb — {inputs.horizon} ans</div>
              <div style={{ overflowX: "auto" }}>
                <table className="proj-table">
                  <thead>
                    <tr>
                      <th>Année</th><th>CA Airbnb</th><th>Charges var.</th><th>Intérêts</th>
                      <th>Impôt</th><th>Cashflow</th><th>CF cumulé</th><th>Patrimoine net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.airbnb.projections.map(row => (
                      <tr key={row.annee}>
                        <td>An {row.annee}</td>
                        <td>{fe(row.loyerBrut)}</td>
                        <td className="neg">{fe(row.chargesTotal)}</td>
                        <td className="neg">{fe(row.interets)}</td>
                        <td className="neg">{fe(row.impot)}</td>
                        <td className={row.cashflow >= 0 ? "pos" : "neg"}>{fe(row.cashflow)}</td>
                        <td className={row.cashflowCumule >= 0 ? "pos" : "neg"}>{fe(row.cashflowCumule)}</td>
                        <td className="pos">{fe(row.patrimoineNet)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ── AMORT ── */}
        {tab === "amort" && r && (
          <div className="section">
            <div className="stitle">Tableau d'amortissement</div>
            <div className="mgrid" style={{ marginBottom: 14 }}>
              <div className="mcard"><div className="mlabel">Capital emprunté</div><div className="mval">{fe(r.montantEmprunte)}</div></div>
              <div className="mcard"><div className="mlabel">Mensualité totale</div><div className="mval">{fe(r.mensualiteTotale)}</div><div className="msub">crédit + assurance</div></div>
              <div className="mcard"><div className="mlabel">Coût total crédit</div><div className="mval neg">{fe(r.coutTotalCredit)}</div></div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="atable">
                <thead>
                  <tr><th>Année</th><th>Intérêts</th><th>Capital remb.</th><th>Capital restant</th></tr>
                </thead>
                <tbody>
                  {r.amortTable.map((row, i) => {
                    const prev = r.amortTable[i - 1];
                    const showSep = i > 0 && row.an - prev.an > 1;
                    return (
                      <>
                        {showSep && <tr key={`s${i}`} className="sep-row"><td colSpan={4} /></tr>}
                        <tr key={row.an}>
                          <td>Année {row.an}</td>
                          <td style={{ color: "var(--red2)" }}>− {fe(row.int)}</td>
                          <td style={{ color: "var(--green2)" }}>{fe(row.cap)}</td>
                          <td>{fe(row.crd)}</td>
                        </tr>
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: "0.68rem", color: "var(--text3)", marginTop: 8, fontFamily: "var(--mono)" }}>
              5 premières + 5 dernières années · {inputs.tauxPret}% · {inputs.dureePret} ans
            </p>
          </div>
        )}
      </div>
    </>
  );
}
