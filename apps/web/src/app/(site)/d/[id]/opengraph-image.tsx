import { ImageResponse } from "next/og";
import { ogFonts } from "@/lib/server/og";
import { isUuid } from "@/lib/server/db";
import { getDebateCard } from "@/lib/server/domain/debates";

export const alt = "A FaceOff debate";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OG({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = isUuid(id) ? await getDebateCard(id, null) : null;
  const prop = d?.proposition ?? "A FaceOff debate";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#FBF7EF", color: "#0B1419", fontFamily: "Source Serif" }}>
        <div style={{ display: "flex", padding: "48px 64px 0", fontSize: 30, fontWeight: 800 }}>
          FaceOff
          {d?.status === "live" && <span style={{ marginLeft: 20, background: "#E5504A", color: "white", borderRadius: 999, padding: "4px 18px", fontSize: 24, fontFamily: "sans-serif" }}>LIVE</span>}
        </div>
        <div style={{ display: "flex", flex: 1, alignItems: "center", padding: "0 64px", fontSize: prop.length > 70 ? 56 : 68, fontWeight: 700, lineHeight: 1.1 }}>{prop}</div>
        <div style={{ display: "flex", height: 150 }}>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, background: "#EEF4F7", padding: "0 64px" }}>
            <span style={{ color: "#3B7189", fontSize: 26, fontFamily: "sans-serif" }}>For</span>
            <span style={{ fontSize: 40, fontWeight: 700 }}>{d?.forSide.displayName ?? ""}</span>
          </div>
          <div style={{ width: 6, background: "#0B1419" }} />
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-end", flex: 1, background: "#FCEDEC", padding: "0 64px" }}>
            <span style={{ color: "#C93B35", fontSize: 26, fontFamily: "sans-serif" }}>Against</span>
            <span style={{ fontSize: 40, fontWeight: 700 }}>{d?.againstSide.displayName ?? ""}</span>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
