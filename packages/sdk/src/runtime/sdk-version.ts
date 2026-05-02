declare const __AIR_JAM_SDK_VERSION__: string;

export const AIR_JAM_SDK_VERSION =
  typeof __AIR_JAM_SDK_VERSION__ === "string"
    ? __AIR_JAM_SDK_VERSION__
    : "0.0.0";
