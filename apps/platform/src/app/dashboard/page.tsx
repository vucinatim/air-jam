"use client";

import { api } from "@/trpc/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function Dashboard() {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const router = useRouter();
  
  const utils = api.useUtils();
  const { data: games, isLoading } = api.game.list.useQuery();
  
  const createGame = api.game.create.useMutation({
    onSuccess: () => {
      setName("");
      setUrl("");
      utils.game.list.invalidate();
    },
    onError: (err) => alert(err.message),
  });

  const createKey = api.game.createApiKey.useMutation({
      onSuccess: (data) => {
          alert(`API Key Created: ${data.key}`);
      },
      onError: (err) => alert(err.message),
  });

  const handleSignOut = async () => {
      await authClient.signOut();
      router.push("/");
  };

  if (isLoading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8">
        <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">Developer Dashboard</h1>
            <button onClick={handleSignOut} className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600">Sign Out</button>
        </div>
      
      <div className="mb-8 p-4 border rounded shadow-sm">
        <h2 className="text-xl font-bold mb-4">Register New Game</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Name</label>
              <input 
                className="border p-2 rounded text-black bg-white w-64" 
                placeholder="My Awesome Game" 
                value={name} 
                onChange={e => setName(e.target.value)} 
              />
          </div>
          <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">URL</label>
              <input 
                className="border p-2 rounded text-black bg-white w-64" 
                placeholder="https://my-game.com" 
                value={url} 
                onChange={e => setUrl(e.target.value)} 
              />
          </div>
          <button 
            onClick={() => createGame.mutate({ name, url })} 
            disabled={createGame.isPending}
            className="bg-black text-white px-6 py-2 rounded hover:bg-gray-800 disabled:opacity-50 h-10"
          >
            {createGame.isPending ? "Saving..." : "Register Game"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {games?.map((game) => (
          <div key={game.id} className="border p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <div className="mb-4">
                <h3 className="text-xl font-bold">{game.name}</h3>
                <a href={game.url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline text-sm break-all">{game.url}</a>
            </div>
            <div className="pt-4 border-t">
                <button 
                    onClick={() => createKey.mutate({ gameId: game.id })}
                    disabled={createKey.isPending}
                    className="bg-blue-600 text-white px-3 py-2 rounded text-sm w-full hover:bg-blue-700 disabled:opacity-50"
                >
                    {createKey.isPending ? "Generating..." : "Generate API Key"}
                </button>
            </div>
          </div>
        ))}
        {games?.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-500">
                No games registered yet. Create one above!
            </div>
        )}
      </div>
    </div>
  );
}


