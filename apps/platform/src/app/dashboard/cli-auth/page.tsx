"use client";

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
import { Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

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
  const initialUserCode = useMemo(
    () => formatUserCode(searchParams.get("userCode") ?? ""),
    [searchParams],
  );
  const [userCode, setUserCode] = useState(initialUserCode);
  const [status, setStatus] = useState<"idle" | "pending" | "done">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const submit = async () => {
    const normalized = normalizeUserCode(userCode);
    if (!normalized) {
      setMessage("Enter the Air Jam CLI approval code first.");
      return;
    }

    setStatus("pending");
    setMessage(null);

    const response = await fetch("/api/cli/auth/device/approve", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        userCode: normalized,
      }),
    });

    const payload = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;

    if (!response.ok) {
      setStatus("idle");
      setMessage(payload?.message ?? "Could not approve Air Jam CLI access.");
      return;
    }

    setStatus("done");
    setMessage(
      "Device approval complete. Return to the CLI window and it will finish login automatically.",
    );
  };

  return (
    <div className="space-y-6">
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
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="user-code">Approval code</Label>
            <Input
              id="user-code"
              autoFocus
              placeholder="ABCD-EFGH"
              value={userCode}
              onChange={(event) =>
                setUserCode(formatUserCode(event.target.value))
              }
              disabled={status === "pending" || status === "done"}
            />
          </div>

          {message ? (
            <p
              className={
                status === "done"
                  ? "text-sm text-emerald-600"
                  : "text-muted-foreground text-sm"
              }
            >
              {message}
            </p>
          ) : null}

          <Button
            onClick={() => void submit()}
            disabled={status === "pending" || status === "done"}
          >
            {status === "pending" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Approve CLI Access
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
