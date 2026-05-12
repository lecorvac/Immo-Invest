import { useState, useRef, useEffect } from "react";
import type { ResultatsComplets } from "./types";
import type { InputsBien, ProfilInvestisseur } from "./types";
import { fe, fp, fmt } from "./model";

interface Message {
  role: "user" | "assistant";
  content: string;
}

function buildContext(results: ResultatsComplets, inputs: InputsBien, profil: ProfilInvestisseur): string {
  return `Tu es un expert en investissement immobilier français. Tu analyses un bien spécifique pour un investisseur.

PROFIL INVESTISSEUR :
- Prénom : ${profil.prenom || "Non renseigné"}
- TMI : ${profil.tmi}%
- Revenus bruts mensuels : ${fmt((profil.salaireBrutAnnuel + profil.bonusAnnuel) / 12)} €
- Mensualité RP actuelle : ${fmt(profil.mensualiteRP)} €
- Objectif : ${profil.objectif}
- Tolérance au risque : ${profil.toleranceRisque}

BIEN ANALYSÉ :
- Prix : ${fe(inputs.prix)}
- Surface : ${inputs.surface} m²
- DPE : ${inputs.dpe || "Non renseigné"}
- Ville : ${inputs.ville || "Non renseignée"}
- Tension locative : ${inputs.tensionLocative}
- Loyer meublé estimé : ${fe(inputs.loyerEstime)}/mois
- Travaux prévus : ${fe(inputs.travaux)}

RÉSULTATS DU MODÈLE FINANCIER :
- Score opportunité : ${results.scoreOpportunite}/100 (${results.scoreLabel})
- Taux d'endettement : ${fp(results.tauxEndettement)} / 35% max HCSF
- Marge d'endettement : ${fe(results.margeEndettement)}/mois
- Montant emprunté : ${fe(results.montantEmprunte)}
- Mensualité totale : ${fe(results.mensualiteTotale)}/mois
- Coût total crédit : ${fe(results.coutTotalCredit)}
- Cash sorti : ${fe(results.totalInvesti)}

SCÉNARIO LLD (Location Longue Durée Meublé LMNP) :
- Cashflow mensuel net : ${fe(results.lld.cashflowMensuel)}
- Rendement brut : ${fp(results.lld.rendementBrut)}
- Rendement net-net : ${fp(results.lld.rendementNet)}
- TRI ${inputs.horizon} ans : ${fp(results.lld.tri)}
- Impôt annuel : ${fe(results.lld.impotAnnuel)}

SCÉNARIO AIRBNB :
- Cashflow mensuel net : ${fe(results.airbnb.cashflowMensuel)}
- CA annuel estimé : ${fe(results.airbnb.detailCharges["CA brut Airbnb"] as number)}
- Rendement brut : ${fp(results.airbnb.rendementBrut)}
- TRI ${inputs.horizon} ans : ${fp(results.airbnb.tri)}

STRUCTURES JURIDIQUES :
- LMNP direct : ${fe(results.cfDirectLMNP)}/an
- SCI IR : ${fe(results.cfSCIIR)}/an
- SCI IS : ${fe(results.cfSCIIS)}/an

STRESS TEST (impact cashflow mensuel LLD) :
- Taux +1% : ${fe(results.stressTest.tauxPlus1)}/mois
- Vacance +5% : ${fe(results.stressTest.vacancePlus5)}/mois
- Loyer -10% : ${fe(results.stressTest.loyerMoins10)}/mois
- Scénario cumulatif : ${fe(results.stressTest.cumulatif)}/mois

PATRIMOINE À ${inputs.horizon} ANS :
- Valeur estimée : ${fe(inputs.prix * Math.pow(1 + inputs.inflationPrix / 100, inputs.horizon))}
- Plus-value brute : ${fe(results.plusValueBrute)}
- Impôt plus-value : ${fe(results.impotPlusValue)}
- Patrimoine net : ${fe(results.patrimoineNetHorizon)}
- Break-even cashflow : ${results.breakEven <= inputs.horizon ? `Année ${results.breakEven}` : "> horizon"}

Réponds toujours en français, de façon concise et directe. Tu peux utiliser des chiffres précis tirés de l'analyse ci-dessus. Si on te demande une simulation différente (autre apport, autre taux, etc.), fais le calcul approximatif dans ta tête et donne une estimation. Sois honnête — si l'opportunité est mauvaise, dis-le clairement.`;
}

const SUGGESTED_QUESTIONS = [
  "C'est un bon investissement pour mon profil ?",
  "Explique-moi le TRI en termes simples",
  "Que se passerait-il si je mettais 10k€ d'apport de plus ?",
  "LLD ou Airbnb, lequel choisir ici ?",
  "Quels sont les principaux risques ?",
  "Est-ce que je peux me permettre cet achat ?",
];

const chatCss = `
.chat-panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  margin-top: 14px;
  overflow: hidden;
}
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
  background: var(--surface2);
}
.chat-header h3 {
  font-family: 'Playfair Display', serif;
  font-size: 0.95rem;
  color: var(--gold);
  display: flex;
  align-items: center;
  gap: 8px;
}
.chat-header p {
  font-size: 0.7rem;
  color: var(--text3);
  font-family: var(--mono);
  margin-top: 2px;
}
.chat-messages {
  height: 320px;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  scroll-behavior: smooth;
}
.chat-messages::-webkit-scrollbar { width: 4px; }
.chat-messages::-webkit-scrollbar-track { background: transparent; }
.chat-messages::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 2px; }
.msg {
  display: flex;
  flex-direction: column;
  max-width: 85%;
}
.msg.user { align-self: flex-end; align-items: flex-end; }
.msg.assistant { align-self: flex-start; align-items: flex-start; }
.msg-bubble {
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 0.82rem;
  line-height: 1.6;
  font-family: 'IBM Plex Sans', sans-serif;
}
.msg.user .msg-bubble {
  background: var(--gold3);
  color: var(--gold2);
  border-bottom-right-radius: 3px;
}
.msg.assistant .msg-bubble {
  background: var(--surface2);
  color: var(--text);
  border: 1px solid var(--border2);
  border-bottom-left-radius: 3px;
  white-space: pre-wrap;
}
.msg-label {
  font-size: 0.65rem;
  color: var(--text3);
  font-family: var(--mono);
  margin-bottom: 3px;
  padding: 0 4px;
}
.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 10px 14px;
  background: var(--surface2);
  border: 1px solid var(--border2);
  border-radius: 10px;
  border-bottom-left-radius: 3px;
  width: fit-content;
}
.typing-dot {
  width: 6px;
  height: 6px;
  background: var(--text3);
  border-radius: 50%;
  animation: typingBounce 1.2s infinite;
}
.typing-dot:nth-child(2) { animation-delay: 0.2s; }
.typing-dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes typingBounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-6px); opacity: 1; }
}
.suggestions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  padding: 10px 16px;
  border-top: 1px solid var(--border);
  background: var(--surface2);
}
.suggestion-btn {
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: 14px;
  padding: 4px 10px;
  font-size: 0.72rem;
  color: var(--text2);
  cursor: pointer;
  font-family: 'IBM Plex Sans', sans-serif;
  transition: all 0.15s;
  white-space: nowrap;
}
.suggestion-btn:hover {
  border-color: var(--gold3);
  color: var(--gold2);
  background: rgba(138,106,32,0.1);
}
.chat-input-row {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--border);
}
.chat-input {
  flex: 1;
  background: var(--surface2);
  border: 1px solid var(--border2);
  border-radius: 8px;
  padding: 9px 13px;
  color: var(--text);
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 0.83rem;
  outline: none;
  transition: border-color 0.15s;
  resize: none;
  min-height: 40px;
  max-height: 120px;
  line-height: 1.4;
}
.chat-input:focus { border-color: var(--gold3); }
.chat-input::placeholder { color: var(--text3); }
.send-btn {
  background: var(--gold3);
  border: 1px solid var(--gold);
  border-radius: 8px;
  padding: 9px 14px;
  color: var(--gold2);
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.15s;
  flex-shrink: 0;
  align-self: flex-end;
}
.send-btn:hover { background: var(--gold); color: #0F0E0C; }
.send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.chat-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 8px;
  color: var(--text3);
}
.chat-empty .icon { font-size: 2rem; opacity: 0.4; }
.chat-empty p { font-size: 0.8rem; font-family: var(--mono); }
`;

interface ChatProps {
  results: ResultatsComplets;
  inputs: InputsBien;
  profil: ProfilInvestisseur;
}

export function Chat({ results, inputs, profil }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const context = buildContext(results, inputs, profil);
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5",
          max_tokens: 600,
          system: context,
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await response.json();
      const txt = data?.content?.[0]?.text || "Désolé, une erreur s'est produite.";
      setMessages(prev => [...prev, { role: "assistant", content: txt }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Erreur de connexion. Réessaie." }]);
    }
    setLoading(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      <style>{chatCss}</style>
      <div className="chat-panel">
        <div className="chat-header">
          <div>
            <h3>💬 Demander à Claude</h3>
            <p>Haiku · Contexte complet de l'analyse injecté · ~0,2 centime/message</p>
          </div>
          {messages.length > 0 && (
            <button
              className="btn btn-outline"
              style={{ padding: "4px 10px", fontSize: "0.72rem" }}
              onClick={() => setMessages([])}
            >
              Effacer
            </button>
          )}
        </div>

        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="chat-empty">
              <div className="icon">🏠</div>
              <p>Pose une question sur l'analyse</p>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>
                <div className="msg-label">{m.role === "user" ? "Toi" : "Claude Haiku"}</div>
                <div className="msg-bubble">{m.content}</div>
              </div>
            ))
          )}
          {loading && (
            <div className="msg assistant">
              <div className="msg-label">Claude Haiku</div>
              <div className="typing-indicator">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {messages.length === 0 && (
          <div className="suggestions">
            {SUGGESTED_QUESTIONS.map((q, i) => (
              <button key={i} className="suggestion-btn" onClick={() => sendMessage(q)}>
                {q}
              </button>
            ))}
          </div>
        )}

        <div className="chat-input-row">
          <textarea
            ref={inputRef}
            className="chat-input"
            placeholder="Pose une question sur cette analyse… (Entrée pour envoyer)"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            rows={1}
          />
          <button className="send-btn" onClick={() => sendMessage(input)} disabled={loading || !input.trim()}>
            ➤
          </button>
        </div>
      </div>
    </>
  );
}
