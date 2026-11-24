import { create } from "qrcode";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { RoomQrCode } from "../src/components/room-qr-code";

it("renders every dark QR module in an SVG with the requested quiet zone", () => {
  const value = "https://air-jam.app/join?room=ABCD";
  const { modules } = create(value, { errorCorrectionLevel: "M" });
  const markup = renderToStaticMarkup(<RoomQrCode value={value} />);
  const path = markup.match(/<path d="([^"]+)"/u)?.[1];

  expect(markup).toContain('<svg role="img"');
  expect(markup).toContain(
    `viewBox="-1 -1 ${modules.size + 2} ${modules.size + 2}"`,
  );
  expect(path?.match(/M/gu)).toHaveLength(
    modules.data.reduce((count, module) => count + module, 0),
  );
});

it("shows QR unavailable when a value exceeds QR capacity", () => {
  const markup = renderToStaticMarkup(
    <RoomQrCode value={`https://example.com/${"x".repeat(3000)}`} />,
  );

  expect(markup).toContain("QR unavailable");
  expect(markup).not.toContain("<svg");
});

it("never renders a QR for a loopback URL supplied directly by a game", () => {
  const markup = renderToStaticMarkup(
    <RoomQrCode value="http://127.0.0.1:3000/controller?room=ABCD" />,
  );
  expect(markup).not.toContain("<svg");
  expect(markup).not.toContain("127.0.0.1");
  expect(markup).toContain("only this computer can open");
});
