import type { InputsBien, ProfilInvestisseur, ResultatsComplets, AnneeProjection, ResultatsScenario } from './types';

// ─── MATH HELPERS ────────────────────────────────────────────────────────────
function pmt(rate: number, nper: number, pv: number): number {
  if (rate === 0) return pv / nper;
  return (pv * rate * Math.pow(1 + rate, nper)) / (Math.pow(1 + rate, nper) - 1);
}

function irrCalc(cashflows: number[], guess = 0.08): number {
  let rate = guess;
  for (let i = 0; i < 300; i++) {
    const f = cashflows.reduce((s, cf, t) => s + cf / Math.pow(1 + rate, t), 0);
    const df = cashflows.reduce((s, cf, t) => s - (t * cf) / Math.pow(1 + rate, t + 1), 0);
    if (Math.abs(df) < 1e-12) break;
    const nr = rate - f / df;
    if (Math.abs(nr - rate) < 1e-9) { rate = nr; break; }
    rate = Math.max(-0.99, Math.min(nr, 10));
  }
  return isFinite(rate) ? rate : 0;
}

// ─── FISCALITÉ ───────────────────────────────────────────────────────────────
function calcTMI(revenuImposable: number, nbParts: number): number {
  const qi = revenuImposable / nbParts;
  if (qi <= 11497) return 0;
  if (qi <= 29315) return 11;
  if (qi <= 83823) return 30;
  if (qi <= 180294) return 41;
  return 45;
}

function calcImpotLMNPReel(
  revenuBrut: number,
  chargesDed: number,
  amortissements: number,
  tmi: number
): number {
  const revImposable = Math.max(0, revenuBrut - chargesDed - amortissements);
  return revImposable * (tmi / 100); // pas de PS sur BIC
}

function calcImpotFoncierReel(
  revenuBrut: number,
  chargesDed: number,
  tmi: number
): number {
  const revImposable = Math.max(0, revenuBrut - chargesDed);
  return revImposable * (tmi / 100 + 0.172);
}

function calcPlusValue(
  prixAchat: number,
  fraisAchat: number,
  travaux: number,
  prixVente: number,
  dureeDetention: number,
  isRP: boolean
): { brute: number; imposable: number; impot: number } {
  if (isRP) return { brute: prixVente - prixAchat, imposable: 0, impot: 0 };
  const prixRevientTotal = prixAchat + fraisAchat + travaux;
  const pvBrute = Math.max(0, prixVente - prixRevientTotal);
  // Abattement IR : 6%/an de 6 à 21 ans, 4% à 22 ans → exonération à 22 ans
  // Abattement PS : 1.65%/an de 6 à 21 ans, 1.6% à 22 ans, 9%/an de 23 à 30 ans → exo à 30 ans
  const anneesAbattement = Math.max(0, dureeDetention - 5);
  const abattIR = Math.min(1, anneesAbattement <= 16 ? anneesAbattement * 0.06 : Math.min(1, 0.96 + (anneesAbattement - 16) * 0.04));
  const abattPS = Math.min(1, anneesAbattement <= 17 ? anneesAbattement * 0.0165 : anneesAbattement <= 17 ? 0 : Math.min(1, (anneesAbattement - 17) * 0.09 + 0.2805));
  const pvImposableIR = pvBrute * (1 - abattIR);
  const pvImposablePS = pvBrute * (1 - abattPS);
  const impot = pvImposableIR * 0.19 + pvImposablePS * 0.172;
  return { brute: pvBrute, imposable: pvImposableIR, impot };
}

// ─── MOTEUR PRINCIPAL ────────────────────────────────────────────────────────
export function computeModel(inputs: InputsBien, profil: ProfilInvestisseur): ResultatsComplets {
  const {
    prix, apport, tauxPret, dureePret, tauxAssurance,
    fraisAgencePct, fraisGarantie, fraisCourtier,
    dpe, charges, taxeFonciere, fondsTravauxCopro,
    travaux, ameublement, loyerEstime,
    occupancyAirbnb, prixNuitAirbnb, avecConciergerie,
    avecGLI, tauxGLI, fraisComptable,
    inflationLoyer, inflationCharges, inflationPrix, horizon,
    encadrementLoyers, loyerMaxEncadre,
  } = inputs;

  const tmi = profil.tmi;
  const revenuMensuelBrut = (profil.salaireBrutAnnuel + profil.bonusAnnuel + profil.autresRevenusAnnuels) / 12;

  // ── Acquisition ──
  const fraisNotaire = prix * 0.082;
  const fraisAgence = (fraisAgencePct / 100) * prix;
  const dpeMap: Record<string, number> = { A: 0, B: 0, C: 0, D: 8000, E: 20000, F: 40000, G: 70000 };
  const travauxDPE = dpe ? (dpeMap[dpe] || 0) : 0;
  const travauxTotal = travaux + travauxDPE * 1.15;
  const totalAcquisition = prix + fraisNotaire + fraisAgence + fraisGarantie + fraisCourtier + travauxTotal + ameublement;
  const montantEmprunte = prix - apport + fraisNotaire + fraisAgence + fraisGarantie + fraisCourtier;
  const tauxM = tauxPret / 100 / 12;
  const tauxAssM = tauxAssurance / 100 / 12;
  const nbMois = dureePret * 12;
  const mensualiteCredit = pmt(tauxM, nbMois, montantEmprunte);
  const mensualiteAssurance = montantEmprunte * tauxAssM;
  const mensualiteTotale = mensualiteCredit + mensualiteAssurance;
  const coutTotalCredit = mensualiteTotale * nbMois - montantEmprunte;
  const totalInvesti = apport + travauxTotal + ameublement;

  // ── Autres emprunts en cours (patrimoine) ──
  const autresMensualites = profil.biens.reduce((s, b) => s + b.mensualiteCredit, 0);
  const mensualiteRPTotal = profil.mensualiteRP + autresMensualites;
  const tauxEndettement = ((mensualiteRPTotal + mensualiteTotale) / revenuMensuelBrut) * 100;
  const margeEndettement = revenuMensuelBrut * 0.35 - mensualiteRPTotal - mensualiteTotale;

  // ── Charges communes ──
  const chargesAn = charges * 12;
  const assurancePNO = Math.max(prix * 0.001, 150);
  const provisionTravaux = prix * 0.005;
  const fondsTravauxAn = fondsTravauxCopro;

  // ── Amortissements LMNP ──
  const amortBien = (prix * 0.85) / 30;
  const amortTravaux = travauxTotal / 10;
  const amortMeuble = ameublement / 7;
  const totalAmort = amortBien + amortTravaux + amortMeuble;

  // ── Loyer effectif (encadrement) ──
  const loyerEffectif = encadrementLoyers && loyerMaxEncadre > 0
    ? Math.min(loyerEstime, loyerMaxEncadre)
    : loyerEstime;

  // ── GLI ──
  const coutGLI = avecGLI ? loyerEffectif * 12 * (tauxGLI / 100) : 0;

  // ── Gestion locative ──
  const gestionLocative = profil.gestionDirecte ? loyerEffectif * 12 * 0.02 : loyerEffectif * 12 * 0.08;

  // ─────────────────────────────────────────────
  // SCÉNARIO LLD — LMNP Réel
  // ─────────────────────────────────────────────
  const vacancePct = inputs.tensionLocative === "tres_forte" ? 0.03 : inputs.tensionLocative === "forte" ? 0.05 : inputs.tensionLocative === "moyenne" ? 0.08 : 0.12;
  const vacanceLLD = loyerEffectif * 12 * vacancePct;
  const revenuBrutLLD = loyerEffectif * 12 - vacanceLLD;
  const interetsAn1 = montantEmprunte * (tauxPret / 100);

  const chargesDedLMNP = chargesAn + taxeFonciere + fondsTravauxAn + assurancePNO + gestionLocative + coutGLI + fraisComptable + interetsAn1;
  const impotLMNP = calcImpotLMNPReel(revenuBrutLLD, chargesDedLMNP, totalAmort, tmi);
  const cashflowLLDAn = revenuBrutLLD - chargesAn - taxeFonciere - fondsTravauxAn - assurancePNO - gestionLocative - coutGLI - fraisComptable - mensualiteTotale * 12 - impotLMNP - provisionTravaux;
  const cashflowLLDMois = cashflowLLDAn / 12;
  const rendBrutLLD = (loyerEffectif * 12 / prix) * 100;
  const rendNetLLD = ((revenuBrutLLD - chargesAn - taxeFonciere - fondsTravauxAn - assurancePNO - gestionLocative - coutGLI - fraisComptable - impotLMNP) / totalAcquisition) * 100;

  // Projections LLD
  const projLLD: AnneeProjection[] = [];
  const cfsLLD = [-totalInvesti];
  let crdLLD = montantEmprunte;
  let cfCumulLLD = 0;
  for (let y = 1; y <= horizon; y++) {
    const loySim = loyerEffectif * 12 * Math.pow(1 + inflationLoyer / 100, y - 1) * (1 - vacancePct);
    const chgSim = chargesAn * Math.pow(1 + inflationCharges / 100, y - 1);
    const tfSim = taxeFonciere * Math.pow(1 + 0.02, y - 1);
    const ftSim = fondsTravauxAn * Math.pow(1 + inflationCharges / 100, y - 1);
    const intY = y <= dureePret ? crdLLD * (tauxPret / 100) : 0;
    const amortY = y <= dureePret ? totalAmort : 0;
    const capRembY = y <= dureePret ? mensualiteCredit * 12 - intY : 0;
    crdLLD = Math.max(0, crdLLD - capRembY);
    const dedY = chgSim + tfSim + ftSim + assurancePNO + gestionLocative + coutGLI + fraisComptable + intY;
    const imposY = calcImpotLMNPReel(loySim, dedY, amortY, tmi);
    const mensAn = y <= dureePret ? mensualiteTotale * 12 : 0;
    const cf = loySim - chgSim - tfSim - ftSim - assurancePNO - gestionLocative - coutGLI - fraisComptable - mensAn - imposY - provisionTravaux;
    cfCumulLLD += cf;
    const valeurBien = prix * Math.pow(1 + inflationPrix / 100, y);
    projLLD.push({ annee: y, loyerBrut: loySim, vacance: loySim * vacancePct, chargesTotal: chgSim + tfSim + gestionLocative, interets: intY, impot: imposY, cashflow: cf, cashflowCumule: cfCumulLLD, capitalRestantDu: crdLLD, valeurBien, patrimoineNet: valeurBien - crdLLD });
    if (y === horizon) {
      const pv = calcPlusValue(prix, fraisNotaire + fraisAgence + fraisGarantie, travauxTotal, valeurBien, y, false);
      cfsLLD.push(cf + valeurBien - crdLLD - pv.impot);
    } else cfsLLD.push(cf);
  }
  const triLLD = irrCalc(cfsLLD) * 100;

  // Break-even LLD
  let breakEven = horizon + 1;
  for (let i = 0; i < projLLD.length; i++) {
    if (projLLD[i].cashflowCumule >= 0) { breakEven = projLLD[i].annee; break; }
  }

  const scenarioLLD: ResultatsScenario = {
    cashflowMensuel: cashflowLLDMois,
    cashflowAnnuel: cashflowLLDAn,
    rendementBrut: rendBrutLLD,
    rendementNet: rendNetLLD,
    tri: triLLD,
    projections: projLLD,
    impotAnnuel: impotLMNP,
    detailCharges: {
      "Loyer brut": loyerEffectif * 12,
      "Vacance locative": -vacanceLLD,
      "Charges copro": -chargesAn,
      "Taxe foncière": -taxeFonciere,
      "Fonds travaux": -fondsTravauxAn,
      "Assurance PNO": -assurancePNO,
      "Gestion locative": -gestionLocative,
      "GLI": -coutGLI,
      "Comptable LMNP": -fraisComptable,
      "Mensualité crédit": -mensualiteTotale * 12,
      "Provision travaux": -provisionTravaux,
      "Impôt LMNP réel": -impotLMNP,
    },
  };

  // ─────────────────────────────────────────────
  // SCÉNARIO AIRBNB
  // ─────────────────────────────────────────────
const nuitesAn = occupancyAirbnb > 0 ? 365 * (occupancyAirbnb / 100) * 0.9 : 0;
  const revBrutAirbnb = nuitesAn * prixNuitAirbnb;
  const fraisPlateAirbnb = revBrutAirbnb * 0.03;
  const fraisConcierge = avecConciergerie ? revBrutAirbnb * 0.22 : revBrutAirbnb * 0.04;
  const linge = nuitesAn * 7;
  const conso = nuitesAn * 5;
  const elec = nuitesAn * 3;
  const chargesVarAirbnb = fraisPlateAirbnb + fraisConcierge + linge + conso + elec;
  const revNetAvImpAirbnb = revBrutAirbnb - chargesVarAirbnb - chargesAn - taxeFonciere - fondsTravauxAn - assurancePNO - fraisComptable - provisionTravaux;
  const dedAirbnb = chargesVarAirbnb + chargesAn + taxeFonciere + fondsTravauxAn + assurancePNO + fraisComptable + interetsAn1;
  const imposAirbnb = calcImpotLMNPReel(revBrutAirbnb, dedAirbnb, totalAmort, tmi);
  const cfAirbnbAn = revNetAvImpAirbnb - mensualiteTotale * 12 - imposAirbnb;
  const cfAirbnbMois = cfAirbnbAn / 12;
  const rendBrutAirbnb = (revBrutAirbnb / prix) * 100;
  const rendNetAirbnb = ((revNetAvImpAirbnb - imposAirbnb) / totalAcquisition) * 100;

  const projAirbnb: AnneeProjection[] = [];
  const cfsAirbnb = [-totalInvesti];
  let crdAirbnb = montantEmprunte;
  let cfCumulAirbnb = 0;
  for (let y = 1; y <= horizon; y++) {
    const revSim = revBrutAirbnb * Math.pow(1 + inflationLoyer / 100, y - 1) * 0.9;
    const chgVar = chargesVarAirbnb * Math.pow(1 + inflationCharges / 100, y - 1);
    const chgFix = chargesAn * Math.pow(1 + inflationCharges / 100, y - 1);
    const tfSim = taxeFonciere * Math.pow(1 + 0.02, y - 1);
    const intY = y <= dureePret ? crdAirbnb * (tauxPret / 100) : 0;
    const amortY = y <= dureePret ? totalAmort : 0;
    const capRembY = y <= dureePret ? mensualiteCredit * 12 - intY : 0;
    crdAirbnb = Math.max(0, crdAirbnb - capRembY);
    const ded = chgVar + chgFix + tfSim + assurancePNO + fraisComptable + intY;
    const impos = calcImpotLMNPReel(revSim, ded, amortY, tmi);
    const mensAn = y <= dureePret ? mensualiteTotale * 12 : 0;
    const cf = revSim - chgVar - chgFix - tfSim - assurancePNO - fraisComptable - mensAn - impos - provisionTravaux;
    cfCumulAirbnb += cf;
    const valeurBien = prix * Math.pow(1 + inflationPrix / 100, y);
    projAirbnb.push({ annee: y, loyerBrut: revSim, vacance: revSim * 0.1, chargesTotal: chgVar + chgFix + tfSim, interets: intY, impot: impos, cashflow: cf, cashflowCumule: cfCumulAirbnb, capitalRestantDu: crdAirbnb, valeurBien, patrimoineNet: valeurBien - crdAirbnb });
    if (y === horizon) {
      const pv = calcPlusValue(prix, fraisNotaire + fraisAgence + fraisGarantie, travauxTotal, valeurBien, y, false);
      cfsAirbnb.push(cf + valeurBien - crdAirbnb - pv.impot);
    } else cfsAirbnb.push(cf);
  }
  const triAirbnb = irrCalc(cfsAirbnb) * 100;

  const scenarioAirbnb: ResultatsScenario = {
    cashflowMensuel: cfAirbnbMois,
    cashflowAnnuel: cfAirbnbAn,
    rendementBrut: rendBrutAirbnb,
    rendementNet: rendNetAirbnb,
    tri: triAirbnb,
    projections: projAirbnb,
    impotAnnuel: imposAirbnb,
    detailCharges: {
      "CA brut Airbnb": revBrutAirbnb,
      "Frais plateforme 3%": -fraisPlateAirbnb,
      "Conciergerie / Autogestion": -fraisConcierge,
      "Linge + conso + énergie": -(linge + conso + elec),
      "Charges copro": -chargesAn,
      "Taxe foncière": -taxeFonciere,
      "Fonds travaux": -fondsTravauxAn,
      "Assurance PNO": -assurancePNO,
      "Comptable LMNP": -fraisComptable,
      "Mensualité crédit": -mensualiteTotale * 12,
      "Provision travaux": -provisionTravaux,
      "Impôt LMNP réel": -imposAirbnb,
    },
  };

  // ─────────────────────────────────────────────
  // STRUCTURES JURIDIQUES
  // ─────────────────────────────────────────────
  const chargesDedSCIIR = chargesAn + taxeFonciere + fondsTravauxAn + assurancePNO + gestionLocative + coutGLI + interetsAn1;
  const impotSCIIR = calcImpotFoncierReel(revenuBrutLLD, chargesDedSCIIR, tmi);
  const cfSCIIRAn = revenuBrutLLD - chargesAn - taxeFonciere - fondsTravauxAn - assurancePNO - gestionLocative - coutGLI - mensualiteTotale * 12 - impotSCIIR - provisionTravaux;

  const chargesDedSCIIS = chargesAn + taxeFonciere + fondsTravauxAn + assurancePNO + gestionLocative + coutGLI + interetsAn1 + totalAmort;
  const benefSCIIS = Math.max(0, revenuBrutLLD - chargesDedSCIIS);
  const isSCIIS = benefSCIIS <= 42500 ? benefSCIIS * 0.15 : 42500 * 0.15 + (benefSCIIS - 42500) * 0.25;
  const cfSCIISAn = revenuBrutLLD - chargesAn - taxeFonciere - fondsTravauxAn - assurancePNO - gestionLocative - coutGLI - mensualiteTotale * 12 - isSCIIS - provisionTravaux;

  // ─────────────────────────────────────────────
  // STRESS TEST
  // ─────────────────────────────────────────────
  const stressTauxPlus1 = (cashflowLLDMois - (montantEmprunte * 0.01) / 12);
  const stressVacancePlus5 = cashflowLLDMois - (loyerEffectif * 0.05);
  const stressLoyerMoins10 = cashflowLLDMois - (loyerEffectif * 0.10);
  const stressCumulatif = cashflowLLDMois - (montantEmprunte * 0.01) / 12 - loyerEffectif * 0.05 - loyerEffectif * 0.10;

  // ─────────────────────────────────────────────
  // PLUS-VALUE & PATRIMOINE
  // ─────────────────────────────────────────────
  const valeurRevente = prix * Math.pow(1 + inflationPrix / 100, horizon);
  const crdHorizon = projLLD[projLLD.length - 1]?.capitalRestantDu || 0;
  const pvCalc = calcPlusValue(prix, fraisNotaire + fraisAgence + fraisGarantie, travauxTotal, valeurRevente, horizon, false);
  const patrimoineNetHorizon = valeurRevente - crdHorizon - pvCalc.impot;

  // ─────────────────────────────────────────────
  // SCORE D'OPPORTUNITÉ (conservateur)
  // ─────────────────────────────────────────────
  let score = 50;
  if (rendBrutLLD >= 8) score += 15; else if (rendBrutLLD >= 6) score += 10; else if (rendBrutLLD >= 5) score += 5; else if (rendBrutLLD < 4) score -= 15;
  if (cashflowLLDMois >= 200) score += 12; else if (cashflowLLDMois >= 0) score += 6; else if (cashflowLLDMois < -300) score -= 15; else if (cashflowLLDMois < 0) score -= 7;
  if (tauxEndettement > 35) score -= 25; else if (tauxEndettement > 32) score -= 10;
  if (dpe === "F" || dpe === "G") score -= 15; else if (dpe === "E") score -= 7; else if (dpe === "A" || dpe === "B") score += 5;
  if (triLLD >= 8) score += 10; else if (triLLD >= 5) score += 5; else if (triLLD < 2) score -= 10;
  if (margeEndettement < 0) score -= 25;
  if (inputs.tensionLocative === "tres_forte") score += 8; else if (inputs.tensionLocative === "forte") score += 4; else if (inputs.tensionLocative === "faible") score -= 8;
  if (stressCumulatif < -500) score -= 10; else if (stressCumulatif >= 0) score += 5;
  score = Math.max(0, Math.min(100, Math.round(score)));
  const scoreLabel = score >= 75 ? "Excellente opportunité" : score >= 60 ? "Bonne opportunité" : score >= 45 ? "Opportunité correcte" : score >= 30 ? "Opportunité risquée" : "À éviter";
  const scoreColor = score >= 75 ? "#5FAF7A" : score >= 60 ? "#8BC870" : score >= 45 ? "#D4A84B" : score >= 30 ? "#C88A3A" : "#C44F4F";

  // ─────────────────────────────────────────────
  // TABLEAU AMORTISSEMENT
  // ─────────────────────────────────────────────
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
      if (an <= 5 || an > dureePret - 5) {
        amortTable.push({ an, int: intAn, cap: capAn, crd });
      }
      intAn = 0; capAn = 0;
    }
  }

  return {
    fraisNotaire, fraisAgence, fraisGarantie, fraisCourtier,
    travauxTotal, travauxDPE, totalAcquisition, totalInvesti,
    montantEmprunte, mensualiteCredit, mensualiteAssurance, mensualiteTotale, coutTotalCredit,
    tauxEndettement, margeEndettement, revenuMensuelBrut,
    lld: scenarioLLD,
    airbnb: scenarioAirbnb,
    cfDirectLMNP: cashflowLLDAn,
    cfSCIIR: cfSCIIRAn,
    cfSCIIS: cfSCIISAn,
    stressTest: { tauxPlus1: stressTauxPlus1, vacancePlus5: stressVacancePlus5, loyerMoins10: stressLoyerMoins10, cumulatif: stressCumulatif },
    patrimoineNetHorizon,
    plusValueBrute: pvCalc.brute,
    plusValueImposable: pvCalc.imposable,
    impotPlusValue: pvCalc.impot,
    breakEven,
    scoreOpportunite: score,
    scoreLabel,
    scoreColor,
    amortTable,
    assurancePNO, provisionTravaux, totalAmort, chargesAn, gestionLocative, coutGLI,
  };
}

// ─── FORMATTERS ──────────────────────────────────────────────────────────────
export function fmt(n: number, d = 0): string {
  if (n == null || isNaN(n) || !isFinite(n)) return "—";
  return new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
}
export const fe = (n: number, d = 0) => fmt(n, d) + " €";
export const fp = (n: number, d = 1) => fmt(n, d) + " %";
