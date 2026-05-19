import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt =
  "Air Jam — phone-controller multiplayer games for the AI era";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const logo = await readFile(
    join(process.cwd(), "public/images/airjam-logo.png"),
  );
  const logoDataUrl = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#08090b",
          backgroundImage:
            "radial-gradient(ellipse 90% 70% at 50% -10%, rgba(0,211,243,0.16), transparent 60%), radial-gradient(ellipse 70% 60% at 110% 110%, rgba(192,87,255,0.12), transparent 55%)",
          color: "#fafafa",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            height: 2,
            width: "100%",
            backgroundImage:
              "linear-gradient(90deg, transparent 0%, rgba(0,211,243,0.0) 5%, rgba(0,211,243,0.7) 50%, rgba(0,211,243,0.0) 95%, transparent 100%)",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            padding: "72px 80px",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <img
              src={logoDataUrl}
              alt=""
              width={68}
              height={68}
              style={{ display: "block" }}
            />
            <div
              style={{
                fontSize: 38,
                fontWeight: 600,
                letterSpacing: "-0.01em",
                color: "rgba(250,250,250,0.95)",
              }}
            >
              Air Jam
            </div>
          </div>

          <div
            style={{ display: "flex", flexDirection: "column", gap: 30 }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 86,
                fontWeight: 700,
                lineHeight: 1.04,
                letterSpacing: "-0.038em",
                color: "#fafafa",
                maxWidth: 980,
              }}
            >
              Phone-controller multiplayer for the AI era.
            </div>
            <div
              style={{
                display: "flex",
                width: 88,
                height: 3,
                backgroundColor: "#00d3f3",
                boxShadow: "0 0 20px rgba(0,211,243,0.6)",
              }}
            />
            <div
              style={{
                display: "flex",
                fontSize: 30,
                lineHeight: 1.4,
                fontWeight: 400,
                color: "rgba(250,250,250,0.62)",
                maxWidth: 940,
              }}
            >
              Open-source framework. Scaffold a game with one command, deploy
              anywhere, play on any phone via QR code.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 24,
              color: "rgba(250,250,250,0.55)",
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  width: 9,
                  height: 9,
                  borderRadius: 9999,
                  backgroundColor: "#00d3f3",
                  boxShadow: "0 0 18px #00d3f3",
                }}
              />
              <span>airjam.io</span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 18px",
                borderRadius: 8,
                backgroundColor: "rgba(255,255,255,0.04)",
                color: "rgba(250,250,250,0.7)",
              }}
            >
              <span style={{ color: "rgba(0,211,243,0.9)" }}>$</span>
              <span>npx create-airjam</span>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
