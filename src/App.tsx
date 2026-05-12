import { useState } from "react";

// ─────────────────────────────────────────────
// FINANCIAL ENGINE
// ─────────────────────────────────────────────
function pmt(rate: number, nper: number, pv: number): number {
  if (rate === 0) return pv / nper;
  return (pv * rate * Math.pow(1 + rate, nper)) / (Math.pow(1 + rate, nper) - 1);
}
function irrCalc(cashflows: number[], guess = 0.08): number {
  let rate = guess;
  for (let i = 0; i < 200; i++) {
    const f = cashflows.reduce((s, cf, t) => s + cf / Math.pow(1 + rate, t), 0);
    const df = cashflows.reduce((s, cf, t) => s - (t * cf) / Math.pow(1 + rate, t + 1), 0);
    if (Math.abs(df) < 1e-12) break;
    const nr = rate - f / df;
    if (Math.abs(nr - rate) < 1e-9) { rate = nr; break; }
    rate = Math.max(-0.99, Math.min(nr, 5));
  }
  return rate;
}
function fmt(n: number, d = 0): string {
  if (n == null || isNaN(n) || !isFinite(n)) return "—";
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
}
const fe = (n: number, d = 0) => fmt(n, d) + " €";
const fp = (n: number, d = 1) => fmt(n, d) + " %";

interface Inputs {
  prix: number; apport: number; tauxPret: number; dureePret: number; tauxAssurance: number;
  fraisAgencePct: number; surface: number; dpe: string; charges: number; taxeFonciere: number;
  travaux: number; ameublement: number; loyerEstime: number;
  occupancyAirbnb: number; prixNuitAirbnb: number; avecConciergerie: boolean;
  inflationLoyer: number; inflationCharges: number; inflationPrix: number;
  tmi: number; horizon: number; revenuMensuelBrut: number; mensualiteRP: number;
}

function computeModel(p: Inputs) {
  const { prix, apport, tauxPret, dureePret, tauxAssurance, fraisAgencePct, dpe,
    charges, taxeFonciere, travaux, ameublement, loyerEstime,
    occupancyAirbnb, prixNuitAirbnb, avecConciergerie,
    inflationLoyer, inflationCharges, inflationPrix, tmi, horizon,
    revenuMensuelBrut, mensualiteRP } = p;

  const fraisNotaire = prix * 0.082;
  const fraisAgence = (fraisAgencePct / 100) * prix;
  const dpeMap: Record<string, number> = { A: 0, B: 0, C: 0, D: 8000, E: 20000, F: 40000, G: 70000 };
  const travauxDPE = dpe ? (dpeMap[dpe] || 0) : 0;
  const travauxTot = travaux + travauxDPE * 1.15;
  const totalAcquisition = prix + fraisNotaire + fraisAgence + travauxTot + ameublement;
  const montantEmprunte = prix - apport + fraisNotaire + fraisAgence;
  const tauxM = tauxPret / 100 / 12;
  const tauxAssM = tauxAssurance / 100 / 12;
  const nbMois = dureePret * 12;
  const mensualiteCredit = pmt(tauxM, nbMois, montantEmprunte);
  const mensualiteAssurance = montantEmprunte * tauxAssM;
  const mensualiteTotale = mensualiteCredit + mensualiteAssurance;
  const coutTotalCredit = mensualiteTotale * nbMois - montantEmprunte;
  const totalInvesti = apport + travauxTot + ameublement;
  const tauxEndettement = ((mensualiteRP + mensualiteTotale) / revenuMensuelBrut) * 100;
  const capaciteResiduelle = revenuMensuelBrut * 0.35 - mensualiteRP;
  const margeEndettement = capaciteResiduelle - mensualiteTotale;
  const chargesAn = charges * 12;
  const assurancePNO = Math.max(prix * 0.001, 150);
  const provisionTravaux = prix * 0.005;
  const amortBien = (prix * 0.85) / 30;
  const amortTravaux = travauxTot / 10;
  const amortMeuble = ameublement / 7;
  const totalAmort = amortBien + amortTravaux + amortMeuble;

  // LLD
  const vacanceLLD = loyerEstime * 12 * 0.08;
  const revenuBrutLLD = loyerEstime * 12 - vacanceLLD;
  const gestionLocative = revenuBrutLLD * 0.08;
  const interetsAn1 = montantEmprunte * (tauxPret / 100);
  const chargesDedLMNP = chargesAn + taxeFonciere + assurancePNO + gestionLocative + interetsAn1 + totalAmort + provisionTravaux;
  const impotLMNP = Math.max(0, revenuBrutLLD - chargesDedLMNP) * (tmi / 100);
  const cashflowLLDAn = revenuBrutLLD - chargesAn - taxeFonciere - assurancePNO - gestionLocative - mensualiteTotale * 12 - impotLMNP - provisionTravaux;
  const cashflowLLDMois = cashflowLLDAn / 12;
  const impotMicroBIC = revenuBrutLLD * 0.5 * (tmi / 100 + 0.172);
  const cashflowMicroBIC = (revenuBrutLLD - chargesAn - taxeFonciere - assurancePNO - gestionLocative - mensualiteTotale * 12 - impotMicroBIC - provisionTravaux) / 12;
  const rendBrutLLD = (loyerEstime * 12 / prix) * 100;
  const rendNetLLD = ((revenuBrutLLD - chargesAn - taxeFonciere - assurancePNO - gestionLocative - impotLMNP) / totalAcquisition) * 100;

  const cfsLLD = [-totalInvesti];
  for (let y = 1; y <= horizon; y++) {
    const loySim = loyerEstime * 12 * Math.pow(1 + inflationLoyer / 100, y - 1) * 0.92;
    const chgSim = chargesAn * Math.pow(1 + inflationCharges / 100, y - 1);
    const tfSim = taxeFonciere * Math.pow(1 + 0.02, y - 1);
    const intY = montantEmprunte * (tauxPret / 100) * Math.max(0, 1 - y / dureePret);
    const amortY = y <= dureePret ? totalAmort : 0;
    const imposY = Math.max(0, loySim - chgSim - tfSim - assurancePNO - gestionLocative - intY - amortY) * (tmi / 100);
    const cf = loySim - chgSim - tfSim - assurancePNO - gestionLocative - mensualiteTotale * 12 - imposY - provisionTravaux;
    if (y === horizon) {
      const pxRevente = prix * Math.pow(1 + inflationPrix / 100, y);
      const crd = montantEmprunte * (1 - Math.min(1, (y * 12) / nbMois)) * 0.85;
      cfsLLD.push(cf + pxRevente - crd);
    } else cfsLLD.push(cf);
  }
  const triLLD = irrCalc(cfsLLD) * 100;

  // Airbnb
  const nuitesAn = 365 * (occupancyAirbnb / 100) * 0.9;
  const revBrutAirbnb = nuitesAn * prixNuitAirbnb;
  const fraisPlateformeAirbnb = revBrutAirbnb * 0.03;
  const fraisConciergerie = avecConciergerie ? revBrutAirbnb * 0.22 : 0;
  const fraisAutoGestion = avecConciergerie ? 0 : revBrutAirbnb * 0.04;
  const linge = nuitesAn * 6;
  const consommables = nuitesAn * 4;
  const electriciteSupp = nuitesAn * 3;
  const chargesVarAirbnb = fraisPlateformeAirbnb + fraisConciergerie + fraisAutoGestion + linge + consommables + electriciteSupp;
  const revNetAvImpotAirbnb = revBrutAirbnb - chargesVarAirbnb - chargesAn - taxeFonciere - assurancePNO - provisionTravaux;
  const dedAirbnb = chargesVarAirbnb + chargesAn + taxeFonciere + assurancePNO + interetsAn1 + totalAmort + provisionTravaux;
  const imposAirbnbReel = Math.max(0, revBrutAirbnb - dedAirbnb) * (tmi / 100);
  const cfAirbnbAn = revNetAvImpotAirbnb - mensualiteTotale * 12 - imposAirbnbReel;
  const cfAirbnbMois = cfAirbnbAn / 12;
  const rendBrutAirbnb = (revBrutAirbnb / prix) * 100;
  const rendNetAirbnb = ((revNetAvImpotAirbnb - imposAirbnbReel) / totalAcquisition) * 100;

  const cfsAirbnb = [-totalInvesti];
  for (let y = 1; y <= horizon; y++) {
    const revSim = revBrutAirbnb * Math.pow(1 + inflationLoyer / 100, y - 1) * 0.9;
    const chgVar = chargesVarAirbnb * Math.pow(1 + inflationCharges / 100, y - 1);
    const chgFix = chargesAn * Math.pow(1 + inflationCharges / 100, y - 1);
    const tfSim = taxeFonciere * Math.pow(1 + 0.02, y - 1);
    const intY = montantEmprunte * (tauxPret / 100) * Math.max(0, 1 - y / dureePret);
    const amortY = y <= dureePret ? totalAmort : 0;
    const impos = Math.max(0, revSim - chgVar - chgFix - tfSim - assurancePNO - intY - amortY) * (tmi / 100);
    const cf = revSim - chgVar - chgFix - tfSim - assurancePNO - mensualiteTotale * 12 - impos - provisionTravaux;
    if (y === horizon) {
      const pxRevente = prix * Math.pow(1 + inflationPrix / 100, y);
      const crd = montantEmprunte * (1 - Math.min(1, (y * 12) / nbMois)) * 0.85;
      cfsAirbnb.push(cf + pxRevente - crd);
    } else cfsAirbnb.push(cf);
  }
  const triAirbnb = irrCalc(cfsAirbnb) * 100;

  // Structures
  const chargesDedSCIIR = chargesAn + taxeFonciere + assurancePNO + gestionLocative + interetsAn1;
  const impotSCIIR = Math.max(0, revenuBrutLLD - chargesDedSCIIR) * (tmi / 100 + 0.172);
  const cfSCIIRAn = revenuBrutLLD - chargesAn - taxeFonciere - assurancePNO - gestionLocative - mensualiteTotale * 12 - impotSCIIR;
  const chargesDedSCIIS = chargesAn + taxeFonciere + assurancePNO + gestionLocative + interetsAn1 + totalAmort;
  const benefSCIIS = Math.max(0, revenuBrutLLD - chargesDedSCIIS);
  const isSCIIS = benefSCIIS <= 42500 ? benefSCIIS * 0.15 : 42500 * 0.15 + (benefSCIIS - 42500) * 0.25;
  const cfSCIISAn = revenuBrutLLD - chargesAn - taxeFonciere - assurancePNO - gestionLocative - mensualiteTotale * 12 - isSCIIS;

  // Amort table
  const amortTable: { an: number; int: number; cap: number; crd: number }[] = [];
  let crd = montantEmprunte;
  let intAn = 0, capAn = 0;
  for (let m = 1; m <= nbMois; m++) {
    const int = crd * tauxM;
    const cap = mensualiteCredit - int;
    crd = Math.max(0, crd - cap);
    intAn += int; capAn += cap;
    if (m % 12 === 0) {
      const an = m / 12;
      amortTable.push({ an, int: intAn, cap: capAn, crd });
      intAn = 0; capAn = 0;
    }
  }

  // Score
  let score = 50;
  if (rendBrutLLD >= 8) score += 15; else if (rendBrutLLD >= 6) score += 10; else if (rendBrutLLD >= 5) score += 5; else if (rendBrutLLD < 4) score -= 15;
  if (cashflowLLDMois >= 200) score += 10; else if (cashflowLLDMois >= 0) score += 5; else if (cashflowLLDMois < -300) score -= 15; else if (cashflowLLDMois < 0) score -= 5;
  if (tauxEndettement > 35) score -= 20; else if (tauxEndettement > 30) score -= 8;
  if (dpe === "F" || dpe === "G") score -= 15; else if (dpe === "E") score -= 7; else if (dpe === "A" || dpe === "B") score += 5;
  if (triLLD >= 8) score += 10; else if (triLLD >= 5) score += 5; else if (triLLD < 2) score -= 10;
  if (margeEndettement < 0) score -= 25;
  score = Math.max(0, Math.min(100, score));
  const scoreLabel = score >= 75 ? "Excellente opportunité" : score >= 60 ? "Bonne opportunité" : score >= 45 ? "Opportunité correcte" : score >= 30 ? "Opportunité risquée" : "À éviter";
  const scoreColor = score >= 75 ? "#5FAF7A" : score >= 60 ? "#8BC870" : score >= 45 ? "#D4A84B" : score >= 30 ? "#C88A3A" : "#C44F4F";

  return {
    fraisNotaire, fraisAgence, travauxTot, travauxDPE, totalAcquisition, totalInvesti,
    montantEmprunte, mensualiteCredit, mensualiteAssurance, mensualiteTotale, coutTotalCredit,
    tauxEndettement, margeEndettement, capaciteResiduelle, chargesAn, assurancePNO, provisionTravaux, totalAmort,
    revenuBrutLLD, vacanceLLD, gestionLocative, impotLMNP, impotMicroBIC,
    cashflowLLDMois, cashflowLLDAn, cashflowMicroBIC, rendBrutLLD, rendNetLLD, triLLD,
    nuitesAn, revBrutAirbnb, fraisPlateformeAirbnb, fraisConciergerie, fraisAutoGestion,
    chargesVarAirbnb, imposAirbnbReel, cfAirbnbMois, cfAirbnbAn, rendBrutAirbnb, rendNetAirbnb, triAirbnb,
    impotSCIIR, cfSCIIRAn, isSCIIS, cfSCIISAn,
    amortTable, score, scoreLabel, scoreColor,
  };
}

async function analyzeWithAI(text: string) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: "Tu es un expert en investissement immobilier français. Réponds UNIQUEMENT en JSON valide, sans backticks ni texte autour.",
      messages: [{ role: "user", content: `Analyse cette annonce immobilière et extrais toutes les données. Si une donnée manque, estime-la de manière CONSERVATRICE.\n\n${text}\n\nRetourne ce JSON:\n{"prix":number,"surface":number,"dpe":"A"|"B"|"C"|"D"|"E"|"F"|"G"|null,"charges":number,"taxeFonciere":number,"loyerEstime":number,"prixNuitAirbnbEstime":number,"occupancyAirbnbEstime":number,"fraisAgencePct":number,"travauxEstimes":number,"ameublementEstime":number,"localisation":string,"typeLogement":string,"risqueAirbnbParis":boolean,"alertes":string[],"pointsCles":string[]}` }],
    }),
  });
  const data = await response.json();
  return JSON.parse(data.content[0].text.replace(/```json|```/g, "").trim());
}

const DEFAULTS: Inputs = {
  prix: 180000, apport: 36000, tauxPret: 3.5, dureePret: 20, tauxAssurance: 0.25,
  fraisAgencePct: 5, surface: 35, dpe: "D", charges: 100, taxeFonciere: 800,
  travaux: 10000, ameublement: 8000, loyerEstime: 750,
  occupancyAirbnb: 50, prixNuitAirbnb: 85, avecConciergerie: true,
  inflationLoyer: 2, inflationCharges: 2.5, inflationPrix: 1.5,
  tmi: 30, horizon: 10, revenuMensuelBrut: 6375, mensualiteRP: 1271,
};

const css = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0F0E0C;--surface:#191714;--surface2:#232018;--border:#2E2B25;--border2:#3D3830;
  --gold:#D4A84B;--gold2:#F0C866;--gold3:#8A6A20;
  --green2:#5FAF7A;--red2:#C44F4F;--amber2:#C88A3A;
  --text:#F0EAD8;--text2:#A89880;--text3:#6A5E50;
  --mono:'IBM Plex Mono',monospace;
}
body{background:var(--bg);color:var(--text);font-family:'IBM Plex Sans',sans-serif;min-height:100vh;-webkit-font-smoothing:antialiased;}
.app{max-width:960px;margin:0 auto;padding:0 16px 80px}
.header{padding:32px 0 24px;border-bottom:1px solid var(--border);margin-bottom:24px;display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:12px}
.header h1{font-family:'Playfair Display',serif;font-size:1.8rem;font-weight:400;letter-spacing:-0.01em}
.header h1 span{color:var(--gold);font-style:italic}
.header p{color:var(--text2);font-size:0.78rem;margin-top:3px;font-weight:300}
.profile-chip{background:var(--surface2);border:1px solid var(--border2);border-radius:6px;padding:7px 12px;font-size:0.72rem;color:var(--text2);font-family:var(--mono)}
.profile-chip strong{color:var(--gold);display:block;font-size:0.68rem;margin-bottom:1px}
.tabs{display:flex;gap:2px;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:3px;margin-bottom:20px}
.tab{flex:1;padding:8px 10px;border-radius:5px;border:none;background:transparent;color:var(--text2);font-family:'IBM Plex Sans',sans-serif;font-size:0.78rem;font-weight:500;cursor:pointer;transition:all 0.15s;text-align:center}
.tab.active{background:var(--gold3);color:var(--gold2)}
.tab:hover:not(.active){color:var(--text);background:var(--surface2)}
.tab:disabled{opacity:0.35;cursor:not-allowed}
.section{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:18px;margin-bottom:14px}
.stitle{font-family:'Playfair Display',serif;font-size:0.95rem;color:var(--gold);margin-bottom:14px;display:flex;align-items:center;gap:8px}
.stitle::after{content:'';flex:1;height:1px;background:var(--border)}
textarea{width:100%;background:var(--surface2);border:1px solid var(--border2);border-radius:7px;padding:11px 13px;color:var(--text);font-family:var(--mono);font-size:0.8rem;outline:none;resize:vertical;min-height:100px;line-height:1.5;transition:border-color 0.15s}
textarea:focus{border-color:var(--gold3)}
textarea::placeholder{color:var(--text3)}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:9px}
@media(max-width:580px){.grid3{grid-template-columns:1fr 1fr}}
.field{display:flex;flex-direction:column;gap:3px}
.field label{font-size:0.68rem;color:var(--text3);font-family:var(--mono);text-transform:uppercase;letter-spacing:0.05em}
.field input,.field select{background:var(--surface2);border:1px solid var(--border2);border-radius:6px;padding:8px 10px;color:var(--text);font-family:var(--mono);font-size:0.82rem;outline:none;transition:border-color 0.15s;width:100%}
.field input:focus,.field select:focus{border-color:var(--gold3)}
.field select option{background:var(--surface2)}
.toggle-row{display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border)}
.toggle-row label{font-size:0.8rem;color:var(--text2)}
.toggle{position:relative;width:38px;height:21px;cursor:pointer}
.toggle input{opacity:0;width:0;height:0}
.tslider{position:absolute;inset:0;background:var(--border2);border-radius:11px;transition:0.2s}
.tslider::before{content:'';position:absolute;width:15px;height:15px;left:3px;bottom:3px;background:var(--text3);border-radius:50%;transition:0.2s}
.toggle input:checked+.tslider{background:var(--gold3)}
.toggle input:checked+.tslider::before{transform:translateX(17px);background:var(--gold2)}
.btn{display:inline-flex;align-items:center;gap:6px;padding:10px 18px;border-radius:7px;border:none;font-family:'IBM Plex Sans',sans-serif;font-size:0.85rem;font-weight:500;cursor:pointer;transition:all 0.15s}
.btn-gold{background:var(--gold3);color:var(--gold2);border:1px solid var(--gold)}
.btn-gold:hover{background:var(--gold);color:#0F0E0C}
.btn-outline{background:transparent;color:var(--text2);border:1px solid var(--border2)}
.btn-outline:hover{border-color:var(--text2);color:var(--text)}
.btn:disabled{opacity:0.4;cursor:not-allowed}
.btn-full{width:100%;justify-content:center;padding:12px;font-size:0.92rem;margin-top:6px}
.lbar{height:2px;background:var(--border);border-radius:1px;overflow:hidden;margin:10px 0}
.lbar-fill{height:100%;background:linear-gradient(90deg,var(--gold3),var(--gold2),var(--gold3));background-size:200%;animation:shimmer 1.2s infinite}
@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
.ltext{font-size:0.78rem;color:var(--text2);font-family:var(--mono)}
.pprev{background:var(--surface2);border:1px solid var(--border2);border-radius:8px;padding:13px;margin:10px 0}
.pprev h4{font-size:0.7rem;color:var(--gold);font-family:var(--mono);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:9px}
.chips{display:flex;flex-wrap:wrap;gap:5px}
.chip{background:var(--surface);border:1px solid var(--border2);border-radius:4px;padding:3px 8px;font-size:0.72rem;font-family:var(--mono);color:var(--text2)}
.chip span{color:var(--text);font-weight:500}
.achip{border-color:#8A3030;color:#C44F4F;background:rgba(138,48,48,0.1)}
.wchip{border-color:#8A5A1A;color:#C88A3A;background:rgba(138,90,26,0.1)}
.score-banner{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:18px 22px;display:flex;align-items:center;gap:18px;margin-bottom:14px;flex-wrap:wrap}
.score-circle{width:68px;height:68px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;border:2px solid currentColor;flex-shrink:0}
.snum{font-family:'Playfair Display',serif;font-size:1.5rem;font-weight:600;line-height:1}
.sten{font-size:0.6rem;color:var(--text3);font-family:var(--mono)}
.sinfo{flex:1;min-width:180px}
.sinfo h3{font-family:'Playfair Display',serif;font-size:1.05rem}
.sinfo p{font-size:0.76rem;color:var(--text2);margin-top:3px;line-height:1.4}
.ebar{margin-top:8px}
.elabel{font-size:0.68rem;color:var(--text3);font-family:var(--mono);margin-bottom:3px;display:flex;justify-content:space-between}
.btrack{height:5px;background:var(--border);border-radius:3px;overflow:hidden}
.bfill{height:100%;border-radius:3px;transition:width 0.5s ease}
.mgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:14px}
@media(max-width:480px){.mgrid{grid-template-columns:repeat(2,1fr)}}
.mcard{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px}
.mlabel{font-size:0.65rem;color:var(--text3);font-family:var(--mono);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:5px}
.mval{font-family:var(--mono);font-size:1.05rem;font-weight:500}
.msub{font-size:0.67rem;color:var(--text2);margin-top:2px}
.pos{color:var(--green2)!important}.neg{color:var(--red2)!important}.warn{color:var(--amber2)!important}
.stabs{display:flex;gap:4px;margin-bottom:10px;flex-wrap:wrap}
.stab{padding:6px 12px;border-radius:6px;border:1px solid var(--border2);background:transparent;color:var(--text2);font-size:0.77rem;font-family:'IBM Plex Sans',sans-serif;cursor:pointer;transition:all 0.15s}
.stab.active{background:var(--surface2);color:var(--text);border-color:var(--gold3)}
.sp{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:18px}
.sp-hdr{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:10px}
.sp-hdr h3{font-family:'Playfair Display',serif;font-size:1.05rem}
.sp-hdr p{font-size:0.75rem;color:var(--text2);margin-top:2px}
.bigcf{font-family:var(--mono);font-size:1.8rem;font-weight:500}
.bigcf-l{font-size:0.68rem;color:var(--text3);font-family:var(--mono);text-transform:uppercase}
.bktable{width:100%;border-collapse:collapse;font-size:0.77rem;margin-top:10px}
.bktable tr{border-bottom:1px solid var(--border)}
.bktable tr:last-child{border-bottom:none}
.bktable td{padding:6px 3px;color:var(--text2);font-family:var(--mono)}
.bktable td:last-child{text-align:right;color:var(--text)}
.bktable .sub td{padding-left:12px;color:var(--text3)!important;font-size:0.72rem}
.bktable .trow td{color:var(--gold)!important;border-top:1px solid var(--border2);padding-top:8px;font-weight:500}
.sgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:10px}
@media(max-width:480px){.sgrid{grid-template-columns:1fr}}
.scard{background:var(--surface2);border:1px solid var(--border2);border-radius:8px;padding:12px}
.scard.best{border-color:var(--gold3);background:rgba(138,106,32,0.08)}
.scard h4{font-size:0.7rem;font-family:var(--mono);color:var(--gold);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.04em}
.scard .scf{font-family:var(--mono);font-size:1.05rem;font-weight:500;margin-bottom:3px}
.scard p{font-size:0.7rem;color:var(--text2);line-height:1.4}
.bbadge{font-size:0.6rem;background:var(--gold3);color:var(--gold2);padding:1px 5px;border-radius:3px;margin-left:5px;vertical-align:middle}
.abox{border-radius:7px;padding:10px 13px;font-size:0.77rem;margin-bottom:8px;display:flex;gap:9px;align-items:flex-start;line-height:1.5}
.abox.danger{background:rgba(138,48,48,0.12);border:1px solid #8A3030;color:#C44F4F}
.abox.warning{background:rgba(138,90,26,0.1);border:1px solid #8A5A1A;color:#C88A3A}
.abox.info{background:rgba(61,122,82,0.08);border:1px solid #3D7A52;color:#5FAF7A}
.aicon{font-size:0.95rem;flex-shrink:0}
.dvd{height:1px;background:var(--border);margin:13px 0}
.atable{width:100%;border-collapse:collapse;font-size:0.75rem;font-family:var(--mono)}
.atable th{text-align:right;color:var(--text3);font-weight:400;padding:5px 7px;border-bottom:1px solid var(--border);font-size:0.67rem;text-transform:uppercase;letter-spacing:0.04em}
.atable th:first-child{text-align:left}
.atable td{text-align:right;padding:5px 7px;border-bottom:1px solid var(--border);color:var(--text2)}
.atable td:first-child{text-align:left;color:var(--text3)}
.atable tr:hover td{background:var(--surface2)}
.sep-row td{background:var(--border2);height:1px;padding:0}
`;

export default function App() {
  const [tab, setTab] = useState("saisie");
  const [inputs, setInputs] = useState<Inputs>(DEFAULTS);
  const [urlText, setUrlText] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [parsed, setParsed] = useState<any>(null);
  const [results, setResults] = useState<any>(null);
  const [sTab, setSTab] = useState("lld");

  const setIn = (k: keyof Inputs, v: any) => setInputs(prev => ({ ...prev, [k]: v }));

  const handleAnalyze = async () => {
    if (!urlText.trim()) return;
    setLoading(true);
    setLoadingMsg("Analyse IA de l'annonce…");
    try {
      const data = await analyzeWithAI(urlText);
      setParsed(data);
      const merged = {
        ...inputs,
        prix: data.prix || inputs.prix,
        surface: data.surface || inputs.surface,
        dpe: data.dpe || inputs.dpe,
        charges: data.charges || inputs.charges,
        taxeFonciere: data.taxeFonciere || inputs.taxeFonciere,
        loyerEstime: data.loyerEstime || inputs.loyerEstime,
        prixNuitAirbnb: data.prixNuitAirbnbEstime || inputs.prixNuitAirbnb,
        occupancyAirbnb: data.occupancyAirbnbEstime || inputs.occupancyAirbnb,
        travaux: data.travauxEstimes || inputs.travaux,
        ameublement: data.ameublementEstime || inputs.ameublement,
        fraisAgencePct: data.fraisAgencePct || inputs.fraisAgencePct,
      };
      setInputs(merged);
      setLoadingMsg("Calcul du modèle financier…");
      setResults(computeModel(merged));
      setTab("resultats");
    } catch (e: any) {
      alert("Erreur : " + e.message);
    }
    setLoading(false);
  };

  const handleCompute = () => {
    setResults(computeModel(inputs));
    setTab("resultats");
  };

  const F = ({ label, k, step, suffix, min, max }: { label: string; k: keyof Inputs; step?: number; suffix?: string; min?: number; max?: number }) => (
    <div className="field">
      <label>{label}{suffix ? ` (${suffix})` : ""}</label>
      <input type="number" value={inputs[k] as number} step={step || 1} min={min} max={max}
        onChange={e => setIn(k, parseFloat(e.target.value) || 0)} />
    </div>
  );

  const r = results;

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <div className="header">
          <div>
            <h1>Invest<span>Immo</span></h1>
            <p>Modèle d'analyse locative — Profil Louis</p>
          </div>
          <div className="profile-chip">
            <strong>PROFIL INVESTISSEUR</strong>
            TMI 30% · RP 1 271€/mois · Paris
          </div>
        </div>

        <div className="tabs">
          {[["saisie","① Saisie"],["parametres","② Paramètres"],["resultats","③ Résultats"],["amort","④ Tableau prêt"]].map(([id,label]) => (
            <button key={id} className={`tab ${tab === id ? "active" : ""}`}
              onClick={() => setTab(id)} disabled={["resultats","amort"].includes(id) && !results}>
              {label}
            </button>
          ))}
        </div>

        {/* SAISIE */}
        {tab === "saisie" && (
          <>
            <div className="section">
              <div className="stitle">Analyser une annonce</div>
              <textarea placeholder={"Colle ici :\n• L'URL de l'annonce (SeLoger, LeBonCoin, PAP…)\n• Ou le texte complet du descriptif\n\nL'IA extraira toutes les données automatiquement."} value={urlText} onChange={e => setUrlText(e.target.value)} />
              <div style={{ marginTop: 9, display: "flex", gap: 7, flexWrap: "wrap" }}>
                <button className="btn btn-gold" onClick={handleAnalyze} disabled={loading || !urlText.trim()}>
                  {loading ? "Analyse…" : "✦ Analyser avec l'IA"}
                </button>
                <button className="btn btn-outline" onClick={() => { setParsed(null); setUrlText(""); }}>Réinitialiser</button>
              </div>
              {loading && <><div className="lbar"><div className="lbar-fill" /></div><div className="ltext">{loadingMsg}</div></>}
            </div>

            {parsed && (
              <div className="pprev">
                <h4>✓ Données extraites par l'IA</h4>
                <div className="chips">
                  <div className="chip">{parsed.typeLogement} · <span>{parsed.localisation}</span></div>
                  <div className="chip">Prix <span>{fe(parsed.prix)}</span></div>
                  <div className="chip">Surface <span>{parsed.surface} m²</span></div>
                  <div className="chip">DPE <span>{parsed.dpe || "?"}</span></div>
                  <div className="chip">Loyer estimé <span>{fe(parsed.loyerEstime)}/mois</span></div>
                  <div className="chip">Airbnb <span>{fe(parsed.prixNuitAirbnbEstime)}/nuit · {parsed.occupancyAirbnbEstime}%</span></div>
                  {parsed.travauxEstimes > 0 && <div className="chip wchip">Travaux <span>{fe(parsed.travauxEstimes)}</span></div>}
                  {parsed.risqueAirbnbParis && <div className="chip achip">⚠ Risque Airbnb Paris</div>}
                </div>
                {(parsed.alertes || []).map((a: string, i: number) => (
                  <div key={i} className="abox warning" style={{ marginTop: 7 }}><span className="aicon">⚠</span>{a}</div>
                ))}
                {(parsed.pointsCles || []).length > 0 && (
                  <div style={{ marginTop: 9, fontSize: "0.75rem", color: "var(--text2)", lineHeight: 1.6 }}>
                    <div style={{ fontSize: "0.67rem", color: "var(--text3)", fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Points clés</div>
                    {parsed.pointsCles.map((p: string, i: number) => <div key={i}>· {p}</div>)}
                  </div>
                )}
              </div>
            )}

            <div className="section">
              <div className="stitle">Données du bien</div>
              <div className="grid3">
                <F label="Prix de vente" k="prix" suffix="€" />
                <F label="Surface" k="surface" suffix="m²" />
                <div className="field">
                  <label>DPE</label>
                  <select value={inputs.dpe || ""} onChange={e => setIn("dpe", e.target.value)}>
                    <option value="">Non renseigné</option>
                    {["A","B","C","D","E","F","G"].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <F label="Charges copro" k="charges" suffix="€/mois" />
                <F label="Taxe foncière" k="taxeFonciere" suffix="€/an" />
                <F label="Frais agence" k="fraisAgencePct" suffix="%" step={0.5} />
              </div>
              <div className="dvd" />
              <div className="grid3">
                <F label="Travaux prévus" k="travaux" suffix="€" />
                <F label="Ameublement" k="ameublement" suffix="€" />
                <F label="Apport" k="apport" suffix="€" />
              </div>
            </div>

            <div className="section">
              <div className="stitle">Revenus locatifs</div>
              <div className="grid3">
                <F label="Loyer meublé HC" k="loyerEstime" suffix="€/mois" />
                <F label="Prix nuit Airbnb" k="prixNuitAirbnb" suffix="€" />
                <F label="Taux occupation" k="occupancyAirbnb" suffix="%" step={1} min={0} max={100} />
              </div>
              <div className="toggle-row" style={{ marginTop: 10 }}>
                <label>Avec conciergerie Airbnb (22% des revenus)</label>
                <label className="toggle">
                  <input type="checkbox" checked={inputs.avecConciergerie} onChange={e => setIn("avecConciergerie", e.target.checked)} />
                  <span className="tslider" />
                </label>
              </div>
            </div>
            <button className="btn btn-gold btn-full" onClick={handleCompute}>Calculer le modèle financier →</button>
          </>
        )}

        {/* PARAMETRES */}
        {tab === "parametres" && (
          <>
            <div className="section">
              <div className="stitle">Financement</div>
              <div className="grid3">
                <F label="Taux prêt" k="tauxPret" suffix="%" step={0.05} />
                <F label="Durée prêt" k="dureePret" suffix="ans" />
                <F label="Taux assurance" k="tauxAssurance" suffix="%" step={0.01} />
              </div>
            </div>
            <div className="section">
              <div className="stitle">Hypothèses économiques</div>
              <div className="grid3">
                <F label="Inflation loyers" k="inflationLoyer" suffix="%/an" step={0.1} />
                <F label="Inflation charges" k="inflationCharges" suffix="%/an" step={0.1} />
                <F label="Revalorisation prix" k="inflationPrix" suffix="%/an" step={0.1} />
              </div>
              <div className="grid2" style={{ marginTop: 9 }}>
                <F label="Horizon" k="horizon" suffix="ans" />
                <div className="field">
                  <label>TMI</label>
                  <select value={inputs.tmi} onChange={e => setIn("tmi", parseInt(e.target.value))}>
                    {[11,30,41,45].map(t => <option key={t} value={t}>{t}%</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="section">
              <div className="stitle">Profil emprunteur</div>
              <div className="grid2">
                <F label="Revenus bruts mensuels" k="revenuMensuelBrut" suffix="€" />
                <F label="Mensualité RP actuelle" k="mensualiteRP" suffix="€" />
              </div>
              <div className="abox info" style={{ marginTop: 10 }}>
                <span className="aicon">ℹ</span>
                <div>Mensualité RP pré-remplie (SG, 4,05%). Taux d'endettement calculé vs règle HCSF 35%.</div>
              </div>
            </div>
            <button className="btn btn-gold btn-full" onClick={handleCompute}>Recalculer →</button>
          </>
        )}

        {/* RESULTATS */}
        {tab === "resultats" && r && (() => {
          const edColor = r.tauxEndettement > 35 ? "var(--red2)" : r.tauxEndettement > 30 ? "var(--amber2)" : "var(--green2)";
          const bestCF = Math.max(r.cashflowLLDAn, r.cfSCIIRAn, r.cfSCIISAn);
          return (
            <>
              <div className="score-banner">
                <div className="score-circle" style={{ color: r.scoreColor, borderColor: r.scoreColor }}>
                  <span className="snum" style={{ color: r.scoreColor }}>{r.score}</span>
                  <span className="sten">/100</span>
                </div>
                <div className="sinfo">
                  <h3 style={{ color: r.scoreColor }}>{r.scoreLabel}</h3>
                  <p>Score conservateur · rendement, cashflow, endettement, DPE, TRI {inputs.horizon} ans</p>
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
              </div>

              {r.margeEndettement < 0 && <div className="abox danger"><span className="aicon">🚫</span><div><strong>Taux d'endettement dépassé.</strong> Dépasse la règle HCSF 35%. Augmentez l'apport ({fe(-r.margeEndettement)}/mois à libérer).</div></div>}
              {(inputs.dpe === "F" || inputs.dpe === "G") && <div className="abox danger"><span className="aicon">⚡</span><div><strong>DPE {inputs.dpe} — Passoire thermique.</strong> Location interdite. Travaux obligatoires ({fe(r.travauxDPE)} estimés, +15% imprévus inclus).</div></div>}
              {parsed?.risqueAirbnbParis && <div className="abox warning"><span className="aicon">⚠</span><div><strong>Risque Airbnb Paris.</strong> Vérifiez le règlement PLU. Quota 120 nuits/an en résidence principale. Possible interdiction en résidence secondaire.</div></div>}

              <div className="section">
                <div className="stitle">Acquisition</div>
                <div className="mgrid">
                  <div className="mcard"><div className="mlabel">Prix FAI</div><div className="mval">{fe(inputs.prix)}</div></div>
                  <div className="mcard"><div className="mlabel">Frais notaire</div><div className="mval warn">{fe(r.fraisNotaire)}</div><div className="msub">8,2%</div></div>
                  <div className="mcard"><div className="mlabel">Travaux total</div><div className="mval warn">{fe(r.travauxTot)}</div><div className="msub">+15% imprévus</div></div>
                  <div className="mcard"><div className="mlabel">Montant emprunté</div><div className="mval">{fe(r.montantEmprunte)}</div></div>
                  <div className="mcard"><div className="mlabel">Mensualité totale</div><div className="mval">{fe(r.mensualiteTotale)}</div><div className="msub">crédit + assurance</div></div>
                  <div className="mcard"><div className="mlabel">Cash sorti</div><div className="mval neg">{fe(r.totalInvesti)}</div><div className="msub">apport+travaux+meubles</div></div>
                </div>
              </div>

              <div className="stabs">
                {[["lld","📋 Location meublée"],["airbnb","✈ Airbnb / LCD"],["structure","⚖ Structures"]].map(([id,label]) => (
                  <button key={id} className={`stab ${sTab === id ? "active" : ""}`} onClick={() => setSTab(id)}>{label}</button>
                ))}
              </div>

              {sTab === "lld" && (
                <div className="sp">
                  <div className="sp-hdr">
                    <div><h3>Location Longue Durée — Meublé LMNP</h3><p>Vacance 8% · Gestion 8% · Provision 0,5%/an</p></div>
                    <div style={{ textAlign: "right" }}>
                      <div className="bigcf-l">Cashflow mensuel net</div>
                      <div className={`bigcf ${r.cashflowLLDMois >= 0 ? "pos" : "neg"}`}>{fe(r.cashflowLLDMois)}</div>
                    </div>
                  </div>
                  <div className="mgrid">
                    <div className="mcard"><div className="mlabel">Rendement brut</div><div className="mval">{fp(r.rendBrutLLD)}</div></div>
                    <div className="mcard"><div className="mlabel">Rendement net-net</div><div className={`mval ${r.rendNetLLD >= 4 ? "pos" : r.rendNetLLD >= 2 ? "warn" : "neg"}`}>{fp(r.rendNetLLD)}</div></div>
                    <div className="mcard"><div className="mlabel">TRI {inputs.horizon} ans</div><div className={`mval ${r.triLLD >= 6 ? "pos" : r.triLLD >= 3 ? "warn" : "neg"}`}>{fp(r.triLLD)}</div></div>
                  </div>
                  <table className="bktable">
                    <tbody>
                      <tr><td>Loyer brut annuel</td><td>{fe(inputs.loyerEstime * 12)}</td></tr>
                      <tr className="sub"><td>Vacance 8%</td><td className="neg">− {fe(r.vacanceLLD)}</td></tr>
                      <tr><td>= Revenu encaissé</td><td>{fe(r.revenuBrutLLD)}</td></tr>
                      <tr className="sub"><td>Charges copro</td><td className="neg">− {fe(r.chargesAn)}</td></tr>
                      <tr className="sub"><td>Taxe foncière</td><td className="neg">− {fe(inputs.taxeFonciere)}</td></tr>
                      <tr className="sub"><td>Assurance PNO</td><td className="neg">− {fe(r.assurancePNO)}</td></tr>
                      <tr className="sub"><td>Gestion locative 8%</td><td className="neg">− {fe(r.gestionLocative)}</td></tr>
                      <tr className="sub"><td>Provision travaux</td><td className="neg">− {fe(r.provisionTravaux)}</td></tr>
                      <tr className="sub"><td>Mensualité crédit ×12</td><td className="neg">− {fe(r.mensualiteTotale * 12)}</td></tr>
                      <tr className="sub"><td>Impôt LMNP réel</td><td className="neg">− {fe(r.impotLMNP)}</td></tr>
                      <tr className="trow"><td>= Cashflow net annuel</td><td className={r.cashflowLLDAn >= 0 ? "pos" : "neg"}>{fe(r.cashflowLLDAn)}</td></tr>
                    </tbody>
                  </table>
                  <div className="dvd" />
                  <div style={{ fontSize: "0.75rem", color: "var(--text3)" }}>
                    <div style={{ color: "var(--text2)", marginBottom: 6 }}>Comparatif régimes fiscaux (cashflow mensuel)</div>
                    <div className="chips">
                      <div className="chip">LMNP Réel <span className={r.cashflowLLDMois >= 0 ? "pos" : "neg"}>{fe(r.cashflowLLDMois)}/mois</span></div>
                      <div className="chip">Micro-BIC 50% <span className={r.cashflowMicroBIC >= 0 ? "pos" : "neg"}>{fe(r.cashflowMicroBIC)}/mois</span></div>
                    </div>
                    <div style={{ marginTop: 7, color: "var(--text2)" }}>✦ Amortissements déductibles : {fe(r.totalAmort)}/an</div>
                  </div>
                </div>
              )}

              {sTab === "airbnb" && (
                <div className="sp">
                  <div className="sp-hdr">
                    <div><h3>Airbnb / Location Courte Durée</h3><p>{fmt(r.nuitesAn, 0)} nuits/an · {inputs.avecConciergerie ? "Conciergerie 22%" : "Autogestion"} · −10% conservateur</p></div>
                    <div style={{ textAlign: "right" }}>
                      <div className="bigcf-l">Cashflow mensuel net</div>
                      <div className={`bigcf ${r.cfAirbnbMois >= 0 ? "pos" : "neg"}`}>{fe(r.cfAirbnbMois)}</div>
                    </div>
                  </div>
                  <div className="mgrid">
                    <div className="mcard"><div className="mlabel">CA Airbnb annuel</div><div className="mval">{fe(r.revBrutAirbnb)}</div></div>
                    <div className="mcard"><div className="mlabel">Rendement brut</div><div className={`mval ${r.rendBrutAirbnb >= 8 ? "pos" : "warn"}`}>{fp(r.rendBrutAirbnb)}</div></div>
                    <div className="mcard"><div className="mlabel">TRI {inputs.horizon} ans</div><div className={`mval ${r.triAirbnb >= 6 ? "pos" : r.triAirbnb >= 3 ? "warn" : "neg"}`}>{fp(r.triAirbnb)}</div></div>
                  </div>
                  <table className="bktable">
                    <tbody>
                      <tr><td>CA brut Airbnb</td><td>{fe(r.revBrutAirbnb)}</td></tr>
                      <tr className="sub"><td>Frais plateforme 3%</td><td className="neg">− {fe(r.fraisPlateformeAirbnb)}</td></tr>
                      {inputs.avecConciergerie
                        ? <tr className="sub"><td>Conciergerie 22%</td><td className="neg">− {fe(r.fraisConciergerie)}</td></tr>
                        : <tr className="sub"><td>Autogestion / outils 4%</td><td className="neg">− {fe(r.fraisAutoGestion)}</td></tr>}
                      <tr className="sub"><td>Linge + consommables + énergie</td><td className="neg">− {fe(r.chargesVarAirbnb - r.fraisPlateformeAirbnb - r.fraisConciergerie - r.fraisAutoGestion)}</td></tr>
                      <tr className="sub"><td>Charges + TF + PNO</td><td className="neg">− {fe(r.chargesAn + inputs.taxeFonciere + r.assurancePNO)}</td></tr>
                      <tr className="sub"><td>Provision travaux</td><td className="neg">− {fe(r.provisionTravaux)}</td></tr>
                      <tr className="sub"><td>Mensualité crédit ×12</td><td className="neg">− {fe(r.mensualiteTotale * 12)}</td></tr>
                      <tr className="sub"><td>Impôt LMNP réel</td><td className="neg">− {fe(r.imposAirbnbReel)}</td></tr>
                      <tr className="trow"><td>= Cashflow net annuel</td><td className={r.cfAirbnbAn >= 0 ? "pos" : "neg"}>{fe(r.cfAirbnbAn)}</td></tr>
                    </tbody>
                  </table>
                  {parsed?.risqueAirbnbParis && <div className="abox danger" style={{ marginTop: 10 }}><span className="aicon">🚫</span><div><strong>Paris — Vérification obligatoire.</strong> Numéro d'enregistrement + quota 120 nuits/an. Résidence secondaire : interdiction dans plusieurs arrondissements.</div></div>}
                </div>
              )}

              {sTab === "structure" && (
                <div className="sp">
                  <div className="stitle" style={{ marginBottom: 10 }}>Comparatif structures juridiques — LLD</div>
                  <p style={{ fontSize: "0.77rem", color: "var(--text2)", marginBottom: 4 }}>Cashflow annuel après impôt</p>
                  <div className="sgrid">
                    {[
                      { id: "lmnp", title: "Détention directe LMNP Réel", cf: r.cashflowLLDAn, desc: "Amortissement bien + mobilier déductible. Déficit imputable sur BIC. Meilleur régime pour TMI 30% sur 1-2 biens." },
                      { id: "sciir", title: "SCI à l'IR", cf: r.cfSCIIRAn, desc: "Revenus fonciers, pas d'amortissement. PS 17,2% en sus. Utile pour transmission patrimoniale mais fiscalement moins avantageux." },
                      { id: "sciis", title: "SCI à l'IS", cf: r.cfSCIISAn, desc: "IS 15% jusqu'à 42 500€. Amortissement possible. Mais double imposition dividendes (PFU 30%) + à la revente." },
                    ].map(({ id, title, cf, desc }) => {
                      const isBest = cf === bestCF;
                      return (
                        <div key={id} className={`scard ${isBest ? "best" : ""}`}>
                          <h4>{title}{isBest && <span className="bbadge">✓ Optimal</span>}</h4>
                          <div className={`scf ${cf >= 0 ? "pos" : "neg"}`}>{fe(cf)}/an</div>
                          <p>{desc}</p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="abox info" style={{ marginTop: 12 }}>
                    <span className="aicon">💡</span>
                    <div><strong>Recommandation :</strong> Avec TMI 30% et un premier investissement locatif, la détention directe LMNP au réel est quasi systématiquement optimale. SCI IS pertinente à partir de 3+ biens avec réinvestissement des bénéfices. Consultez un expert-comptable spécialisé LMNP.</div>
                  </div>
                </div>
              )}
            </>
          );
        })()}

        {/* AMORT */}
        {tab === "amort" && r && (
          <div className="section">
            <div className="stitle">Tableau d'amortissement</div>
            <div className="mgrid" style={{ marginBottom: 14 }}>
              <div className="mcard"><div className="mlabel">Capital emprunté</div><div className="mval">{fe(r.montantEmprunte)}</div></div>
              <div className="mcard"><div className="mlabel">Mensualité totale</div><div className="mval">{fe(r.mensualiteTotale)}</div></div>
              <div className="mcard"><div className="mlabel">Coût total crédit</div><div className="mval neg">{fe(r.coutTotalCredit)}</div></div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="atable">
                <thead><tr><th>Année</th><th>Intérêts</th><th>Capital remb.</th><th>Capital restant</th></tr></thead>
                <tbody>
                  {r.amortTable.map((row: any, i: number) => {
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
            <p style={{ fontSize: "0.68rem", color: "var(--text3)", marginTop: 8, fontFamily: "var(--mono)" }}>5 premières + 5 dernières années · Taux {inputs.tauxPret}% · {inputs.dureePret} ans</p>
          </div>
        )}
      </div>
    </>
  );
}