"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const signIn = async () => {
    await authClient.signIn.email({
      email,
      password,
    }, {
      onSuccess: () => {
        router.push("/dashboard");
      },
      onError: (ctx) => {
        alert(ctx.error.message);
      }
    });
  };

  const signUp = async () => {
    await authClient.signUp.email({
      email,
      password,
      name: email.split("@")[0],
    }, {
      onSuccess: () => {
        router.push("/dashboard");
      },
      onError: (ctx) => {
         alert(ctx.error.message);
      }
    });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="text-4xl font-bold">Air Jam Platform</h1>
      <div className="flex flex-col gap-2 w-64">
        <input 
          className="border p-2 rounded text-black bg-white" 
          placeholder="Email" 
          value={email} 
          onChange={e => setEmail(e.target.value)} 
        />
        <input 
          className="border p-2 rounded text-black bg-white" 
          type="password" 
          placeholder="Password" 
          value={password} 
          onChange={e => setPassword(e.target.value)} 
        />
        <button onClick={signIn} className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600">Sign In</button>
        <button onClick={signUp} className="bg-green-500 text-white p-2 rounded hover:bg-green-600">Sign Up</button>
      </div>
    </div>
  );
}
