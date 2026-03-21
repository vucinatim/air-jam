"use client";

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
import { api } from "@/trpc/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { useEffect } from "react";
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

export default function AccountPage() {
  const utils = api.useUtils();
  const { data: me, isLoading } = api.user.me.useQuery();

  const updateProfile = api.user.updateProfile.useMutation({
    onSuccess: () => {
      void utils.user.me.invalidate();
      alert("Account updated");
    },
    onError: (error) => {
      alert(`Error: ${error.message}`);
    },
  });

  const form = useForm<AccountForm>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      displayName: "",
    },
  });

  useEffect(() => {
    if (!me) return;
    form.reset({ displayName: me.name || "" });
  }, [me, form]);

  const onSubmit = (values: AccountForm) => {
    updateProfile.mutate({ displayName: values.displayName });
  };

  if (isLoading) {
    return <div>Loading account...</div>;
  }

  if (!me) {
    return <div>Unable to load account.</div>;
  }

  return (
    <div className="space-y-6">
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
        <CardContent className="space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input value={me.email} disabled />
                </FormControl>
              </FormItem>

              <Button type="submit" disabled={updateProfile.isPending}>
                {updateProfile.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

