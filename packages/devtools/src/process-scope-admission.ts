import { randomUUID } from "node:crypto";
import { processScopeAdmittedSchema } from "./process-scope-protocol.js";

export function processScopeToken() {
  const token = process.argv
    .find((value) => value.startsWith("--airjam-process-scope="))
    ?.split("=")[1];
  if (!process.connected || !token)
    throw new Error(
      "process_scope_unavailable: A scoped helper requires its owner's admission channel.",
    );
  return token;
}
export async function admitProcessScopeMember(processId: number) {
  const token = processScopeToken();
  const id = randomUUID();
  await new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timer);
      process.off("message", receive);
      process.off("disconnect", disconnected);
      if (error) reject(error);
      else resolve();
    };
    const receive = (value: unknown) => {
      const result = processScopeAdmittedSchema.safeParse(value);
      if (result.success && result.data.id === id)
        finish(result.data.error ? new Error(result.data.error) : undefined);
    };
    const disconnected = () =>
      finish(
        new Error("process_scope_unavailable: Admission owner disconnected."),
      );
    const timer = setTimeout(
      () =>
        finish(new Error("process_scope_unavailable: Admission timed out.")),
      10000,
    );
    process.on("message", receive);
    process.once("disconnect", disconnected);
    process.send?.(
      { type: "airjam-process-scope/admit", id, token, processId },
      undefined,
      undefined,
      (error: Error | null) => {
        if (error) finish(error);
      },
    );
  });
}
