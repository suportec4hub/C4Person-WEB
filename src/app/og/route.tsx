import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0a0a0f 0%, #0f0a1e 50%, #0a0f1e 100%)",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Ambient glow */}
        <div style={{
          position: "absolute", top: "-100px", left: "50%", transform: "translateX(-50%)",
          width: "600px", height: "600px",
          background: "radial-gradient(circle, rgba(139,92,246,0.25) 0%, transparent 70%)",
          borderRadius: "50%",
        }} />
        <div style={{
          position: "absolute", bottom: "-100px", right: "0",
          width: "400px", height: "400px",
          background: "radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)",
          borderRadius: "50%",
        }} />

        {/* Badge */}
        <div style={{
          display: "flex", alignItems: "center", gap: "8px",
          background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.4)",
          borderRadius: "100px", padding: "8px 20px", marginBottom: "24px",
        }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#8B5CF6" }} />
          <span style={{ color: "#a78bfa", fontSize: "14px", fontWeight: 600, letterSpacing: "0.1em" }}>
            PRODUTIVIDADE PESSOAL
          </span>
        </div>

        {/* Logo + Title */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "16px" }}>
          <div style={{
            width: "56px", height: "56px", borderRadius: "16px",
            background: "linear-gradient(135deg, #7c3aed, #8B5CF6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "28px", fontWeight: 900, color: "white",
          }}>
            C4
          </div>
          <span style={{ fontSize: "52px", fontWeight: 900, color: "white", letterSpacing: "-0.03em" }}>
            C4Person
          </span>
        </div>

        {/* Subtitle */}
        <p style={{
          fontSize: "24px", color: "rgba(255,255,255,0.65)", textAlign: "center",
          maxWidth: "700px", lineHeight: 1.4, marginBottom: "40px",
        }}>
          Tarefas · Hábitos · Finanças · Metas · Agenda · IA
        </p>

        {/* Features row */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "40px", flexWrap: "wrap", justifyContent: "center" }}>
          {["✅ Gestão de Tarefas", "🔥 Streak de Hábitos", "💰 Controle Financeiro", "🤖 IA Integrada"].map(f => (
            <div key={f} style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px", padding: "8px 16px",
              color: "rgba(255,255,255,0.8)", fontSize: "14px", fontWeight: 500,
            }}>
              {f}
            </div>
          ))}
        </div>

        {/* Price CTA */}
        <div style={{
          display: "flex", alignItems: "center", gap: "16px",
          background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
          borderRadius: "16px", padding: "14px 32px",
          boxShadow: "0 8px 32px rgba(139,92,246,0.4)",
        }}>
          <span style={{ color: "white", fontSize: "20px", fontWeight: 700 }}>
            Comece por R$15,90/mês
          </span>
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "16px" }}>→</span>
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "14px" }}>c4person.com.br</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
