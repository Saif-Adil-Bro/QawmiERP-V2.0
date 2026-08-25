"use client";

import { useState } from "react";
import { registerMadrasa } from "./actions/tenant";
import Link from "next/link";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const formData = new FormData(e.currentTarget);
      
      const timeoutPromise = new Promise<any>((_, reject) => 
        setTimeout(() => reject(new Error("Request timed out. Please verify your Supabase configuration.")), 8000)
      );

      const result = await Promise.race([
        registerMadrasa(formData),
        timeoutPromise
      ]);

      if (result.error) {
        setError(result.error);
      } else if (result.success) {
        setMessage(result.message!);
      }
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred during registration. Please check database configuration.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md border border-slate-100">
        <h1 className="text-2xl font-bold mb-2 text-center text-slate-800">QawmiERP Setup</h1>
        <p className="text-slate-500 mb-6 text-center">Register a new Madrasa tenant</p>
        
        {message && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md text-sm">{message}</div>}
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Madrasa Name</label>
            <input name="madrasaName" required className="w-full p-2 border rounded-md" placeholder="Jamia Islamia..." />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Contact Email</label>
            <input name="contactEmail" type="email" required className="w-full p-2 border rounded-md" placeholder="info@jamia.edu" />
          </div>
          <hr className="my-4" />
          <div>
            <label className="block text-sm font-medium mb-1">Admin Name</label>
            <input name="adminName" required className="w-full p-2 border rounded-md" placeholder="Abdullah" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Admin Email</label>
            <input name="adminEmail" type="email" required className="w-full p-2 border rounded-md" placeholder="admin@jamia.edu" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Admin Password</label>
            <input name="adminPassword" type="password" required className="w-full p-2 border rounded-md" placeholder="••••••••" />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-slate-900 text-white p-2 rounded-md hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? "Registering..." : "Register Madrasa"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          <p>Already have an account? <Link href="/login" className="text-slate-900 font-semibold hover:underline">Sign In</Link></p>
        </div>
      </div>
    </div>
  );
}
