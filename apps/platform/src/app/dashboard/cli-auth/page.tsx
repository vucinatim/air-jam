"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { platformMachineApiErrorSchema } from "@air-jam/sdk/platform-machine";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

const normalizeUserCode = (value: string): string =>
  value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

const formatUserCode = (value: string): string => {
  const normalized = normalizeUserCode(value);
  if (normalized.length <= 4) {
    return normalized;
  }

  return `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}`;
};

export default function DashboardCliAuthPage() {
  const searchParams = useSearchParams();
  const [userCode, setUserCode] = useState(() =>
    formatUserCode(searchParams.get("userCode") ?? ""),
  );
  const approval = useMutation({
    retry: false,
    mutationFn: async (code: string) => {
      const normalized = normalizeUserCode(code);
      if (!normalized) {
        throw new Error("Enter the Air Jam CLI approval code first.");
      }

      const response = await fetch("/api/cli/auth/device/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userCode: normalized }),
      });

      if (!response.ok) {
        const payload: unknown = await response.json();
        throw new Error(platformMachineApiErrorSchema.parse(payload).message);
      }
    },
  });
  const isLocked = approval.isPending || approval.isSuccess;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Approve CLI Login</h1>
        <p className="text-muted-foreground">
          Confirm local Air Jam CLI access for your creator account.
        </p>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Device Code</CardTitle>
          <CardDescription>
            Paste the approval code shown by <code>airjam auth login</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!isLocked) approval.mutate(userCode);
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="user-code">Approval code</Label>
              <Input
                id="user-code"
                autoFocus
                placeholder="ABCD-EFGH"
                value={userCode}
                onChange={(event) =>
                  setUserCode(formatUserCode(event.target.value))
                }
                disabled={isLocked}
              />
            </div>

            {approval.isError && (
              <Alert variant="destructive">
                <AlertTitle>CLI access was not confirmed</AlertTitle>
                <AlertDescription>{approval.error.message}</AlertDescription>
              </Alert>
            )}
            {approval.isSuccess && (
              <Alert role="status">
                <AlertTitle>Device approval complete</AlertTitle>
                <AlertDescription>
                  Return to the CLI window and it will finish login
                  automatically.
                </AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={isLocked}>
              {approval.isPending ? (
                <Loader2 data-icon="inline-start" className="animate-spin" />
              ) : null}
              Approve CLI Access
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
