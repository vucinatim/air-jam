"use client";

import { api } from "@/trpc/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { Play, LogOut, Plus, Key, Gamepad2, Loader2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

export default function Dashboard() {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const router = useRouter();
  
  const utils = api.useUtils();
  const { data: games, isLoading } = api.game.list.useQuery();
  
  const createGame = api.game.create.useMutation({
    onSuccess: () => {
      setName("");
      setUrl("");
      utils.game.list.invalidate();
    },
    onError: (err) => alert(err.message), // Could use toast here later
  });

  const createKey = api.game.createApiKey.useMutation({
      onSuccess: (data) => {
          // In a real app, maybe show a dialog or toast with the key
          alert(`API Key Created: ${data.key}`);
      },
      onError: (err) => alert(err.message),
  });

  const handleSignOut = async () => {
      await authClient.signOut();
      router.push("/");
  };
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-background border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Gamepad2 className="h-6 w-6 text-foreground" />
            <h1 className="text-xl font-bold text-foreground">Air Jam Developer Console</h1>
          </div>
          <Button variant="outline" onClick={handleSignOut} size="sm">
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Sidebar / Create Game Section */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Register Game</CardTitle>
                <CardDescription>Add a new game to your portfolio.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label>Game Name</Label>
                    <Input 
                      placeholder="My Awesome Game" 
                      value={name} 
                      onChange={e => setName(e.target.value)} 
                    />
                </div>
                <div className="space-y-2">
                    <Label>Game URL</Label>
                    <Input 
                      placeholder="https://my-game.com" 
                      value={url} 
                      onChange={e => setUrl(e.target.value)} 
                    />
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full"
                  onClick={() => createGame.mutate({ name, url })} 
                  disabled={createGame.isPending || !name || !url}
                >
                  {createGame.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Register Game
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* Main Content / Games List */}
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold mb-6">Your Games</h2>
            
            {isLoading ? (
              <div className="grid gap-4">
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : games?.length === 0 ? (
               <Card className="border-dashed">
                 <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                   <Gamepad2 className="h-12 w-12 mb-4 opacity-20" />
                   <p className="text-lg font-medium">No games yet</p>
                   <p className="text-sm">Register your first game to get started.</p>
                 </CardContent>
               </Card>
            ) : (
              <div className="grid gap-6">
                {games?.map((game) => (
                  <Card key={game.id} className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle>{game.name}</CardTitle>
                          <CardDescription className="mt-1 break-all">{game.url}</CardDescription>
                        </div>
                        <Link href={`/play/${game.id}`}>
                           <Button size="sm" className="bg-green-600 hover:bg-green-700">
                             <Play className="h-4 w-4 mr-2" />
                             Play
                           </Button>
                        </Link>
                      </div>
                    </CardHeader>
                    <Separator />
                    <CardContent className="pt-4">
                        <div className="flex flex-col gap-2">
                            <Label className="text-xs text-muted-foreground uppercase tracking-wider">API Keys</Label>
                            <div className="flex items-center gap-2">
                                <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => createKey.mutate({ gameId: game.id })}
                                    disabled={createKey.isPending}
                                >
                                    {createKey.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Key className="h-3 w-3 mr-2" />}
                                    Generate New Key
                                </Button>
                                {/* We could list existing keys here if we fetched them */}
                            </div>
                        </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
