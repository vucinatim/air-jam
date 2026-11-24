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
