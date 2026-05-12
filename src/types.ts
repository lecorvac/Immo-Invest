// ─── PROFIL INVESTISSEUR ────────────────────────────────────────────────────

export type TypeBien = "appartement" | "maison" | "immeuble" | "parking" | "commerce" | "sci_ir" | "sci_is" | "scpi" | "autre";
export type RegimeFiscalBien = "lmnp_reel" | "lmnp_micro" | "foncier_reel" | "micro_foncier" | "sci_ir" | "sci_is" | "scpi" | "rp" | "autre";
export type EstimationMode = "conservateur" | "realiste" | "agressif";

export interface BienPatrimoine {
  id: string;
  type: TypeBien;
  description: string;
  valeurEstimee: number;
  capitalRestantDu: number;
  mensualiteCredit: number;
  loyerMensuelPercu: number;
  regimeFiscal: RegimeFiscalBien;
}

export type ObjectifInvestissement = "cashflow" | "patrimoine" | "defiscalisation" | "retraite" | "mixte";
export type ToleranceRisque = "faible" | "modere" | "eleve";
export type SituationFamiliale = "celibataire" | "marie" | "pacse" | "divorce" | "veuf";

export interface ProfilInvestisseur {
  prenom: string;
  salaireBrutAnnuel: number;
  bonusAnnuel: number;
  autresRevenusAnnuels: number;
  situationFamiliale: SituationFamiliale;
  nbEnfants: number;
  nbPartsFC: number;
  tmi: number;
  mensualiteRP: number;
  valeurRP: number;
  capitalRestantDuRP: number;
  biens: BienPatrimoine[];
  apportDisponible: number;
  epargneSecurite: number;
  objectif: ObjectifInvestissement;
  horizonDetention: number;
  toleranceRisque: ToleranceRisque;
  gestionDirecte: boolean;
  zoneCible: string;
}

export const DEFAULT_PROFIL: ProfilInvestisseur = {
  prenom: "",
  salaireBrutAnnuel: 0,
  bonusAnnuel: 0,
  autresRevenusAnnuels: 0,
  situationFamiliale: "celibataire",
  nbEnfants: 0,
  nbPartsFC: 1,
  tmi: 30,
  mensualiteRP: 0,
  valeurRP: 0,
  capitalRestantDuRP: 0,
  biens: [],
  apportDisponible: 0,
  epargneSecurite: 0,
  objectif: "mixte",
  horizonDetention: 10,
  toleranceRisque: "modere",
  gestionDirecte: false,
  zoneCible: "",
};

// ─── INPUTS BIEN ────────────────────────────────────────────────────────────

export interface InputsBien {
  // Acquisition
  prix: number;
  apport: number;
  tauxPret: number;
  dureePret: number;
  tauxAssurance: number;
  fraisAgencePct: number;
  fraisGarantie: number;
  fraisCourtier: number;
  // Bien
  surface: number;
  dpe: string;
  charges: number;
  taxeFonciere: number;
  fondsTravauxCopro: number;
  travaux: number;
  ameublement: number;
  // Localisation
  ville: string;
  tensionLocative: "faible" | "moyenne" | "forte" | "tres_forte";
  encadrementLoyers: boolean;
  loyerMaxEncadre: number;
  // Revenus LLD
  loyerEstime: number;
  // Airbnb
  occupancyAirbnb: number;
  prixNuitAirbnb: number;
  avecConciergerie: boolean;
  // Protection
  avecGLI: boolean;
  tauxGLI: number;
  fraisComptable: number;
  // Hypothèses
  inflationLoyer: number;
  inflationCharges: number;
  inflationPrix: number;
  horizon: number;
}

export const DEFAULT_INPUTS: InputsBien = {
  // Acquisition — tout à 0, sera rempli par l'IA ou l'utilisateur
  prix: 0,
  apport: 0,
  tauxPret: 3.5,         // taux marché actuel 2026
  dureePret: 20,
  tauxAssurance: 0.25,
  fraisAgencePct: 0,
  fraisGarantie: 0,
  fraisCourtier: 0,
  // Bien
  surface: 0,
  dpe: "",
  charges: 0,
  taxeFonciere: 0,
  fondsTravauxCopro: 0,
  travaux: 0,
  ameublement: 0,
  // Localisation
  ville: "",
  tensionLocative: "moyenne",
  encadrementLoyers: false,
  loyerMaxEncadre: 0,
  // Revenus — tout à 0, estimé par l'IA
  loyerEstime: 0,
  occupancyAirbnb: 0,
  prixNuitAirbnb: 0,
  avecConciergerie: true,
  // Protection — activé par défaut, taux marché
  avecGLI: true,
  tauxGLI: 3,
  fraisComptable: 1000,
  // Hypothèses conservatrices par défaut
  inflationLoyer: 2,
  inflationCharges: 2.5,
  inflationPrix: 1.5,
  horizon: 10,
};

// ─── RÉSULTATS ───────────────────────────────────────────────────────────────

export interface AnneeProjection {
  annee: number;
  loyerBrut: number;
  vacance: number;
  chargesTotal: number;
  interets: number;
  impot: number;
  cashflow: number;
  cashflowCumule: number;
  capitalRestantDu: number;
  valeurBien: number;
  patrimoineNet: number;
}

export interface ResultatsScenario {
  cashflowMensuel: number;
  cashflowAnnuel: number;
  rendementBrut: number;
  rendementNet: number;
  tri: number;
  projections: AnneeProjection[];
  impotAnnuel: number;
  detailCharges: Record<string, number>;
}

export interface ResultatsComplets {
  fraisNotaire: number;
  fraisAgence: number;
  fraisGarantie: number;
  fraisCourtier: number;
  travauxTotal: number;
  travauxDPE: number;
  totalAcquisition: number;
  totalInvesti: number;
  montantEmprunte: number;
  mensualiteCredit: number;
  mensualiteAssurance: number;
  mensualiteTotale: number;
  coutTotalCredit: number;
  tauxEndettement: number;
  margeEndettement: number;
  revenuMensuelBrut: number;
  lld: ResultatsScenario;
  airbnb: ResultatsScenario;
  cfDirectLMNP: number;
  cfSCIIR: number;
  cfSCIIS: number;
  stressTest: {
    tauxPlus1: number;
    vacancePlus5: number;
    loyerMoins10: number;
    cumulatif: number;
  };
  patrimoineNetHorizon: number;
  plusValueBrute: number;
  plusValueImposable: number;
  impotPlusValue: number;
  breakEven: number;
  scoreOpportunite: number;
  scoreLabel: string;
  scoreColor: string;
  amortTable: { an: number; int: number; cap: number; crd: number }[];
  assurancePNO: number;
  provisionTravaux: number;
  totalAmort: number;
  chargesAn: number;
  gestionLocative: number;
  coutGLI: number;
}
