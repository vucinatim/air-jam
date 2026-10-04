"use client";

import { RetryNotice } from "@/components/retry-notice";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppRouter } from "@/server/api/root";
import { api } from "@/trpc/react";
import { zodResolver } from "@hookform/resolvers/zod";
import type { inferRouterOutputs } from "@trpc/server";
import { Loader2, Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const accountFormSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Display name is required")
    .max(50, "Display name must be 50 characters or fewer"),
});

type AccountForm = z.infer<typeof accountFormSchema>;
type CreatorAccount = inferRouterOutputs<AppRouter>["user"]["me"];

export default function AccountPage() {
  const query = api.user.me.useQuery();
  const readError = query.isError ? (
    <RetryNotice
      message="We couldn’t load your account."
      detail={
        query.data
          ? "Previously loaded account details are still shown."
          : undefined
      }
      isRetrying={query.isFetching}
      onRetry={() => void query.refetch()}
    />
  ) : null;

  if (!query.data) {
    return readError ?? <div role="status">Loading account…</div>;
  }

  return (
    <>
      {readError}
      <AccountProfile key={query.data.id} account={query.data} />
    </>
  );
}

function AccountProfile({ account }: { account: CreatorAccount }) {
  const utils = api.useUtils();
  const form = useForm<AccountForm>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: { displayName: account.name },
  });
  const updateProfile = api.user.updateProfile.useMutation({
    onSuccess: async (updatedAccount) => {
      await utils.user.me.cancel();
      utils.user.me.setData(undefined, updatedAccount);
      form.reset({ displayName: updatedAccount.name });
      void utils.user.me.invalidate();
    },
  });

  const onSubmit = (values: AccountForm) => {
    if (updateProfile.isPending) return;
    updateProfile.mutate({ displayName: values.displayName });
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Account</h1>
        <p className="text-muted-foreground">
          Manage your public creator identity.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Your display name appears in the arcade as the game author.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-6"
            >
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Your name"
                        disabled={updateProfile.isPending}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-col gap-2">
                <Label htmlFor="account-email">Email</Label>
                <Input id="account-email" value={account.email} disabled />
              </div>

              {updateProfile.isError && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {updateProfile.error.message}
                  </AlertDescription>
                </Alert>
              )}
              {updateProfile.isSuccess && !form.formState.isDirty && (
                <Alert role="status">
                  <AlertDescription>Account updated.</AlertDescription>
                </Alert>
              )}

              <Button type="submit" disabled={updateProfile.isPending}>
                {updateProfile.isPending && (
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                )}
                <Save data-icon="inline-start" />
                Save Changes
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
