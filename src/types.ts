// ─── PROFIL INVESTISSEUR ────────────────────────────────────────────────────

export type TypeBien = "appartement" | "maison" | "immeuble" | "parking" | "commerce" | "sci_ir" | "sci_is" | "scpi" | "autre";
export type RegimeFiscalBien = "lmnp_reel" | "lmnp_micro" | "foncier_reel" | "micro_foncier" | "sci_ir" | "sci_is" | "scpi" | "rp" | "autre";

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
  // Identité
  prenom: string;
  // Revenus
  salaireBrutAnnuel: number;
  bonusAnnuel: number;
  autresRevenusAnnuels: number; // revenus fonciers, dividendes, etc.
  // Situation familiale
  situationFamiliale: SituationFamiliale;
  nbEnfants: number;
  nbPartsFC: number; // parts fiscales
  // Fiscalité (calculée ou saisie)
  tmi: number; // 0, 11, 30, 41, 45
  // Emprunt RP
  mensualiteRP: number;
  valeurRP: number;
  capitalRestantDuRP: number;
  // Patrimoine immobilier
  biens: BienPatrimoine[];
  // Capacité
  apportDisponible: number;
  epargneSecurite: number; // épargne de précaution à conserver
  // Objectifs
  objectif: ObjectifInvestissement;
  horizonDetention: number; // années
  toleranceRisque: ToleranceRisque;
  // Préférences
  gestionDirecte: boolean; // préfère gérer soi-même
  zoneCible: string; // Paris, province, etc.
}

export const DEFAULT_PROFIL: ProfilInvestisseur = {
  prenom: "",
  salaireBrutAnnuel: 69000,
  bonusAnnuel: 7000,
  autresRevenusAnnuels: 0,
  situationFamiliale: "celibataire",
  nbEnfants: 0,
  nbPartsFC: 1,
  tmi: 30,
  mensualiteRP: 1271,
  valeurRP: 380000,
  capitalRestantDuRP: 220334,
  biens: [],
  apportDisponible: 40000,
  epargneSecurite: 10000,
  objectif: "mixte",
  horizonDetention: 10,
  toleranceRisque: "modere",
  gestionDirecte: false,
  zoneCible: "province",
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
  fraisGarantie: number; // caution crédit logement ~1500€ ou hypothèque ~2%
  fraisCourtier: number;
  // Bien
  surface: number;
  dpe: string;
  charges: number; // mensuel
  taxeFonciere: number; // annuel
  fondsTravauxCopro: number; // annuel article 14-2
  travaux: number;
  ameublement: number;
  // Localisation
  ville: string;
  tensionLocative: "faible" | "moyenne" | "forte" | "tres_forte";
  encadrementLoyers: boolean;
  loyerMaxEncadre: number; // si encadrement
  // Revenus LLD
  loyerEstime: number; // mensuel HC meublé
  // Airbnb
  occupancyAirbnb: number;
  prixNuitAirbnb: number;
  avecConciergerie: boolean;
  // GLI
  avecGLI: boolean; // garantie loyers impayés
  tauxGLI: number; // % des loyers ~2.5-3.5%
  // Comptable LMNP
  fraisComptable: number; // annuel ~1000€
  // Hypothèses
  inflationLoyer: number;
  inflationCharges: number;
  inflationPrix: number;
  horizon: number;
}

export const DEFAULT_INPUTS: InputsBien = {
  prix: 180000,
  apport: 36000,
  tauxPret: 3.5,
  dureePret: 20,
  tauxAssurance: 0.25,
  fraisAgencePct: 0,
  fraisGarantie: 1500,
  fraisCourtier: 0,
  surface: 35,
  dpe: "D",
  charges: 100,
  taxeFonciere: 800,
  fondsTravauxCopro: 0,
  travaux: 10000,
  ameublement: 8000,
  ville: "",
  tensionLocative: "moyenne",
  encadrementLoyers: false,
  loyerMaxEncadre: 0,
  loyerEstime: 750,
  occupancyAirbnb: 50,
  prixNuitAirbnb: 85,
  avecConciergerie: true,
  avecGLI: true,
  tauxGLI: 3,
  fraisComptable: 1000,
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
  // Acquisition
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
  // Endettement
  tauxEndettement: number;
  margeEndettement: number;
  revenuMensuelBrut: number;
  // Scénarios
  lld: ResultatsScenario;
  airbnb: ResultatsScenario;
  // Structures
  cfDirectLMNP: number;
  cfSCIIR: number;
  cfSCIIS: number;
  // Stress test
  stressTest: {
    tauxPlus1: number;
    vacancePlus5: number;
    loyerMoins10: number;
    cumulatif: number;
  };
  // Patrimoine
  patrimoineNetHorizon: number;
  plusValueBrute: number;
  plusValueImposable: number;
  impotPlusValue: number;
  // Opportunité
  breakEven: number; // année
  scoreOpportunite: number;
  scoreLabel: string;
  scoreColor: string;
  // Amort
  amortTable: { an: number; int: number; cap: number; crd: number }[];
  // Divers
  assurancePNO: number;
  provisionTravaux: number;
  totalAmort: number;
  chargesAn: number;
  gestionLocative: number;
  coutGLI: number;
}
