import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";
import { loadPublicProfile } from "@/lib/profile/public";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${BRAND.name} profile`;

// The preview LinkedIn, WhatsApp and X show for a shared profile.
export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const p = await loadPublicProfile(handle);
  const score = p?.rating.score;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0a0d12", color: "white", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 32, fontWeight: 600 }}>
          <div style={{ width: 44, height: 44, borderRadius: 999, background: "linear-gradient(135deg, #7f56d9, #2e90fa, #06aed4, #ee46bc)" }} />
          {BRAND.name}
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 640 }}>
            <div style={{ fontSize: 60, fontWeight: 700, letterSpacing: -2 }}>{p?.name ?? "A Ship or Skip learner"}</div>
            <div style={{ fontSize: 28, color: "rgba(255,255,255,0.6)" }}>{p?.title ?? "Learning to judge AI-written code"}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ fontSize: 24, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: 3 }}>AI Code Judgement</div>
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <span style={{ fontSize: 150, fontWeight: 700, letterSpacing: -6, lineHeight: 1 }}>{score == null ? "–" : score.toFixed(1)}</span>
              <span style={{ fontSize: 44, color: "rgba(255,255,255,0.5)", marginLeft: 8 }}>/10</span>
            </div>
            {p?.rating.band && (
              <div style={{ marginTop: 8, background: "white", color: "#0a0d12", borderRadius: 999, padding: "8px 22px", fontSize: 26, fontWeight: 700 }}>
                {p.rating.band}
              </div>
            )}
          </div>
        </div>
        <div style={{ fontSize: 24, color: "rgba(255,255,255,0.5)" }}>AI writes the code now. Can you tell when it&apos;s wrong?</div>
      </div>
    ),
    size,
  );
}
