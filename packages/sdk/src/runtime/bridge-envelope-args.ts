/** Keep required event payloads separate from optional bridge correlation. */
export const splitBridgeEnvelopeArgs = (
  args: unknown[],
  requiredEventArgs: number,
): { eventArgs: unknown[]; requestId?: string } => {
  const maybeOptions = args[args.length - 1] as
    | { requestId?: string }
    | undefined;
  const hasOptions =
    args.length > requiredEventArgs &&
    typeof maybeOptions === "object" &&
    maybeOptions !== null &&
    "requestId" in maybeOptions;

  return {
    eventArgs: hasOptions ? args.slice(0, -1) : args,
    ...(hasOptions && maybeOptions.requestId
      ? { requestId: maybeOptions.requestId }
      : {}),
  };
};
