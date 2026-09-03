import Image, { type ImageProps } from "next/image";

const AIR_JAM_LOGO_PATH = "/images/airjam-logo.png";

type AirJamLogoProps = Omit<ImageProps, "src" | "unoptimized">;

/**
 * Renders the bundled Air Jam mark directly from the application origin.
 *
 * The asset is already a small, production-ready PNG. Keeping it outside the
 * runtime image optimizer removes an unnecessary availability dependency from
 * every first-party navigation surface.
 */
export function AirJamLogo({ alt, ...props }: AirJamLogoProps) {
  return (
    <Image
      src={AIR_JAM_LOGO_PATH}
      alt={alt}
      width={391}
      height={330}
      unoptimized
      {...props}
    />
  );
}
