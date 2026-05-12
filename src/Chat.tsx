import { useState, useRef, useEffect } from "react";
import type { ResultatsComplets, InputsBien, ProfilInvestisseur } from "./types";
import { fe, fp, fmt } from "./model";

interface Message {
  role: "user" | "assistant";
  content: string;
}

function buildContext(results: ResultatsComplets | null, inputs: InputsBien, profil: ProfilInvestisseur): string {
  const base = `Tu es un expert en investissement immobilier français, intégré dans une app d'analyse locative.
Profil investisseur : ${profil.prenom || "Investisseur"}, TMI ${profil.tmi}%, revenus ${fmt((profil.salaireBrutAnnuel + profil.bonusAnnuel) / 12)}€/mois, mensualité RP ${fmt(profil.mensualiteRP)}€/mois, objectif : ${profil.objectif}.
Réponds toujours en français, de façon concise et directe. Tu peux faire des calculs approximatifs si on te demande des simulations.`;

  if (!results) return base + "\nAucune analyse n'a encore été effectuée — réponds aux questions générales sur l'investissement locatif.";

  return base + `

BIEN ACTUELLEMENT ANALYSÉ :
- Prix : ${fe(inputs.prix)} | Surface : ${inputs.surface}m² | DPE : ${inputs.dpe || "?"} | Ville : ${inputs.ville || "?"}
- Tension locative : ${inputs.tensionLocative} | Loyer meublé : ${fe(inputs.loyerEstime)}/mois
- Score opportunité : ${results.scoreOpportunite}/100 (${results.scoreLabel})
- Taux d'endettement : ${fp(results.tauxEndettement)} / 35% HCSF (marge : ${fe(results.margeEndettement)}/mois)
- Mensualité totale : ${fe(results.mensualiteTotale)}/mois | Cash sorti : ${fe(results.totalInvesti)}

LLD MEUBLÉ LMNP :
- Cashflow : ${fe(results.lld.cashflowMensuel)}/mois | Rendement brut : ${fp(results.lld.rendementBrut)} | Net-net : ${fp(results.lld.rendementNet)} | TRI : ${fp(results.lld.tri)}

AIRBNB :
- Cashflow : ${fe(results.airbnb.cashflowMensuel)}/mois | CA annuel : ${fe(results.airbnb.detailCharges["CA brut Airbnb"] as number)} | TRI : ${fp(results.airbnb.tri)}

STRESS TEST (LLD mensuel) :
- Taux+1% : ${fe(results.stressTest.tauxPlus1)} | Vacance+5% : ${fe(results.stressTest.vacancePlus5)} | Loyer-10% : ${fe(results.stressTest.loyerMoins10)} | Cumulatif : ${fe(results.stressTest.cumulatif)}

PATRIMOINE À ${inputs.horizon} ANS :
- Valeur estimée : ${fe(inputs.prix * Math.pow(1 + inputs.inflationPrix / 100, inputs.horizon))} | Plus-value nette : ${fe(results.plusValueBrute - results.impotPlusValue)} | Patrimoine net : ${fe(results.patrimoineNetHorizon)}
- Break-even cashflow : ${results.breakEven <= inputs.horizon ? `Année ${results.breakEven}` : "> horizon"}

STRUCTURES : LMNP direct ${fe(results.cfDirectLMNP)}/an | SCI IR ${fe(results.cfSCIIR)}/an | SCI IS ${fe(results.cfSCIIS)}/an`;
}

const SUGGESTIONS = [
  "C'est un bon investissement pour moi ?",
  "LLD ou Airbnb ici ?",
  "Quels sont les risques principaux ?",
  "Explique le TRI simplement",
  "Que faire pour améliorer le cashflow ?",
];

interface ChatProps {
  results: ResultatsComplets | null;
  inputs: InputsBien;
  profil: ProfilInvestisseur;
}

export function Chat({ results, inputs, profil }: ChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const newMsgs: Message[] = [...messages, { role: "user", content: text.trim() }];
    setMessages(newMsgs);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5",
          max_tokens: 500,
          system: buildContext(results, inputs, profil),
          messages: newMsgs.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      const txt = data?.content?.[0]?.text || "Erreur — réessaie.";
      setMessages(prev => [...prev, { role: "assistant", content: txt }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Erreur de connexion." }]);
    }
    setLoading(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  return (
    <>
      <style>{`
        .chat-fab {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: var(--gold3);
          border: 2px solid var(--gold);
          color: var(--gold2);
          font-size: 1.3rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 200;
          box-shadow: 0 4px 20px rgba(0,0,0,0.4);
          transition: all 0.2s;
        }
        .chat-fab:hover { background: var(--gold); color: #0F0E0C; transform: scale(1.05); }
        .chat-fab.open { background: var(--surface2); border-color: var(--border2); color: var(--text2); }

        .chat-sidebar {
          position: fixed;
          bottom: 88px;
          right: 24px;
          width: 340px;
          max-height: 520px;
          background: var(--surface);
          border: 1px solid var(--border2);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          z-index: 199;
          box-shadow: 0 8px 40px rgba(0,0,0,0.5);
          overflow: hidden;
          animation: slideUp 0.2s ease;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media(max-width: 600px) {
          .chat-sidebar { right: 12px; left: 12px; width: auto; bottom: 80px; }
          .chat-fab { right: 16px; bottom: 16px; }
        }

        .chat-head {
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
          background: var(--surface2);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .chat-head-left h4 {
          font-family: 'Playfair Display', serif;
          font-size: 0.9rem;
          color: var(--gold);
        }
        .chat-head-left p {
          font-size: 0.65rem;
          color: var(--text3);
          font-family: var(--mono);
          margin-top: 1px;
        }
        .chat-head-right { display: flex; gap: 6px; align-items: center; }
        .chat-clear {
          background: transparent;
          border: 1px solid var(--border2);
          border-radius: 5px;
          padding: 3px 8px;
          font-size: 0.68rem;
          color: var(--text3);
          cursor: pointer;
          font-family: 'IBM Plex Sans', sans-serif;
          transition: all 0.15s;
        }
        .chat-clear:hover { border-color: var(--text2); color: var(--text2); }

        .chat-msgs {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          min-height: 0;
        }
        .chat-msgs::-webkit-scrollbar { width: 3px; }
        .chat-msgs::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 2px; }

        .chat-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 20px;
          gap: 6px;
          color: var(--text3);
          font-size: 0.78rem;
          font-family: var(--mono);
          text-align: center;
        }
        .chat-empty-state .e-icon { font-size: 1.8rem; opacity: 0.35; margin-bottom: 4px; }
        .chat-empty-state span { color: var(--text3); }

        .chat-suggs {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 8px 12px;
          border-top: 1px solid var(--border);
        }
        .chat-sugg {
          background: var(--surface2);
          border: 1px solid var(--border2);
          border-radius: 6px;
          padding: 6px 10px;
          font-size: 0.75rem;
          color: var(--text2);
          cursor: pointer;
          font-family: 'IBM Plex Sans', sans-serif;
          text-align: left;
          transition: all 0.15s;
        }
        .chat-sugg:hover { border-color: var(--gold3); color: var(--gold2); background: rgba(138,106,32,0.08); }

        .cmsg { display: flex; flex-direction: column; max-width: 88%; }
        .cmsg.user { align-self: flex-end; align-items: flex-end; }
        .cmsg.assistant { align-self: flex-start; align-items: flex-start; }
        .cmsg-lbl { font-size: 0.62rem; color: var(--text3); font-family: var(--mono); margin-bottom: 2px; padding: 0 3px; }
        .cmsg-bubble {
          padding: 8px 12px;
          border-radius: 9px;
          font-size: 0.8rem;
          line-height: 1.55;
          font-family: 'IBM Plex Sans', sans-serif;
        }
        .cmsg.user .cmsg-bubble { background: var(--gold3); color: var(--gold2); border-bottom-right-radius: 2px; }
        .cmsg.assistant .cmsg-bubble { background: var(--surface2); color: var(--text); border: 1px solid var(--border2); border-bottom-left-radius: 2px; white-space: pre-wrap; }

        .typing { display: flex; gap: 3px; padding: 8px 12px; background: var(--surface2); border: 1px solid var(--border2); border-radius: 9px; border-bottom-left-radius: 2px; width: fit-content; }
        .tdot { width: 5px; height: 5px; background: var(--text3); border-radius: 50%; animation: tb 1.2s infinite; }
        .tdot:nth-child(2){animation-delay:0.2s}.tdot:nth-child(3){animation-delay:0.4s}
        @keyframes tb { 0%,60%,100%{transform:translateY(0);opacity:.3} 30%{transform:translateY(-5px);opacity:1} }

        .chat-input-area {
          display: flex;
          gap: 7px;
          padding: 10px 12px;
          border-top: 1px solid var(--border);
        }
        .cinput {
          flex: 1;
          background: var(--surface2);
          border: 1px solid var(--border2);
          border-radius: 7px;
          padding: 8px 11px;
          color: var(--text);
          font-family: 'IBM Plex Sans', sans-serif;
          font-size: 0.8rem;
          outline: none;
          resize: none;
          min-height: 36px;
          max-height: 90px;
          line-height: 1.4;
          transition: border-color 0.15s;
        }
        .cinput:focus { border-color: var(--gold3); }
        .cinput::placeholder { color: var(--text3); }
        .csend {
          background: var(--gold3);
          border: 1px solid var(--gold);
          border-radius: 7px;
          padding: 8px 12px;
          color: var(--gold2);
          cursor: pointer;
          font-size: 0.85rem;
          transition: all 0.15s;
          flex-shrink: 0;
          align-self: flex-end;
        }
        .csend:hover { background: var(--gold); color: #0F0E0C; }
        .csend:disabled { opacity: 0.4; cursor: not-allowed; }

        .chat-no-analysis {
          font-size: 0.72rem;
          color: var(--amber2);
          font-family: var(--mono);
          padding: 6px 10px;
          background: rgba(138,90,26,0.1);
          border: 1px solid var(--amber);
          border-radius: 6px;
          margin: 8px 12px 0;
          text-align: center;
        }
      `}</style>

      {/* FAB button */}
      <button className={`chat-fab ${open ? "open" : ""}`} onClick={() => setOpen(o => !o)} title="Demander à Claude">
        {open ? "✕" : "💬"}
      </button>

      {/* Sidebar panel */}
      {open && (
        <div className="chat-sidebar">
          <div className="chat-head">
            <div className="chat-head-left">
              <h4>💬 Claude Haiku</h4>
              <p>{results ? `Analyse chargée · ${inputs.ville || "bien"}` : "Pas encore d'analyse"} · ~0,2¢/msg</p>
            </div>
            <div className="chat-head-right">
              {messages.length > 0 && (
                <button className="chat-clear" onClick={() => setMessages([])}>Effacer</button>
              )}
            </div>
          </div>

          {!results && (
            <div className="chat-no-analysis">
              ⚠ Lance une analyse d'abord pour des réponses contextualisées
            </div>
          )}

          <div className="chat-msgs">
            {messages.length === 0 ? (
              <div className="chat-empty-state">
                <div className="e-icon">🏠</div>
                <span>Pose une question sur l'investissement</span>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`cmsg ${m.role}`}>
                  <div className="cmsg-lbl">{m.role === "user" ? "Toi" : "Claude"}</div>
                  <div className="cmsg-bubble">{m.content}</div>
                </div>
              ))
            )}
            {loading && (
              <div className="cmsg assistant">
                <div className="cmsg-lbl">Claude</div>
                <div className="typing">
                  <div className="tdot"/><div className="tdot"/><div className="tdot"/>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {messages.length === 0 && (
            <div className="chat-suggs">
              {SUGGESTIONS.map((q, i) => (
                <button key={i} className="chat-sugg" onClick={() => send(q)}>{q}</button>
              ))}
            </div>
          )}

          <div className="chat-input-area">
            <textarea
              ref={inputRef}
              className="cinput"
              placeholder="Question… (Entrée pour envoyer)"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              rows={1}
            />
            <button className="csend" onClick={() => send(input)} disabled={loading || !input.trim()}>➤</button>
          </div>
        </div>
      )}
    </>
  );
}
