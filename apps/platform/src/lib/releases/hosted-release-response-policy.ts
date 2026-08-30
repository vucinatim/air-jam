export const createHostedReleaseSecurityHeaders = ({
  platformPublicOrigin,
  allowInsecureDevFrames,
}: {
  platformPublicOrigin: string;
  allowInsecureDevFrames: boolean;
}) => {
  const connectSrc = allowInsecureDevFrames
    ? "connect-src 'self' http: https: ws: wss:"
    : "connect-src 'self' https: wss:";
  const frameSrc = allowInsecureDevFrames
    ? "frame-src 'self' http: https:"
    : "frame-src 'self' https:";
  const contentSecurityPolicy = [
    "default-src 'self' data: blob:",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
    "style-src 'self' 'unsafe-inline' https:",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    connectSrc,
    "media-src 'self' blob: https:",
    "worker-src 'self' blob:",
    frameSrc,
    `frame-ancestors ${platformPublicOrigin}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https:",
  ].join("; ");
  const permissionsPolicy = [
    "accelerometer=(self)",
    "autoplay=(self)",
    "camera=()",
    "encrypted-media=(self)",
    "fullscreen=(self)",
    "gamepad=(self)",
    "geolocation=()",
    "gyroscope=(self)",
    "microphone=()",
    "payment=()",
    "picture-in-picture=(self)",
    "usb=()",
  ].join(", ");

  return [
    { key: "X-AirJam-Content-Class", value: "untrusted-release" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "no-referrer" },
    { key: "Permissions-Policy", value: permissionsPolicy },
    { key: "Content-Security-Policy", value: contentSecurityPolicy },
    { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  ];
};
