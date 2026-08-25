"use client";

import { useActionState } from "react";
import { login } from "../actions/auth";
import Link from "next/link";

const initialState: { error?: string; success?: boolean } = {};

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(login as any, initialState);

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md border border-slate-100">
        <h1 className="text-2xl font-bold mb-2 text-center text-slate-800">QawmiERP Login</h1>
        <p className="text-slate-500 mb-6 text-center">Sign in to your account</p>
        
        {state?.error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
            {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input name="email" type="email" required className="w-full p-2 border rounded-md" placeholder="admin@jamia.edu" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input name="password" type="password" required className="w-full p-2 border rounded-md" placeholder="••••••••" />
          </div>
          <button 
            type="submit" 
            disabled={isPending}
            className="w-full bg-slate-900 text-white p-2 rounded-md hover:bg-slate-800 disabled:opacity-50"
          >
            {isPending ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          <p>Don't have an account? <Link href="/" className="text-slate-900 font-semibold hover:underline">Register Madrasa</Link></p>
        </div>
      </div>
    </div>
  );
}
