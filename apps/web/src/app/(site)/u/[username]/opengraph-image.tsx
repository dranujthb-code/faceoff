import { ImageResponse } from "next/og";
import { ogFonts } from "@/lib/server/og";
import { getProfileDetail } from "@/lib/server/domain/profiles";

export const alt = "A FaceOff Wall";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OG({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const p = await getProfileDetail(username.toLowerCase(), null);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#F3ECDF", color: "#0B1419", padding: 64, fontFamily: "Source Serif" }}>
        <div style={{ display: "flex", fontSize: 30, fontWeight: 800 }}>FaceOff</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 76, fontWeight: 700 }}>{p?.displayName ?? "FaceOff Wall"}</span>
          <span style={{ fontSize: 34, color: "#525C63", fontFamily: "sans-serif" }}>@{p?.username ?? username} — {p?.debatesCompleted ?? 0} debates — {p?.followers ?? 0} followers</span>
        </div>
        <div style={{ display: "flex", fontSize: 28, fontFamily: "sans-serif", color: "#525C63" }}>You have a voice.</div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
