import { NextResponse } from "next/server";
import { getMadrasaInfo, toPublicMadrasaInfo } from "@/lib/getMadrasaInfo";

/**
 * পাবলিক মাদ্রাসা ইনফো (favicon, রসিদের হেডার, স্ক্যানার ইত্যাদি ব্যবহার করে)।
 *
 * ⛔ সিকিউরিটি ফিক্স: আগে এখানে `getMadrasaInfo()`-এর **পুরো** অবজেক্ট ফেরত যেত —
 * তার ভেতরে `metadata` সহ payment gateway-এর `store_passwd`/`app_secret`,
 * biometric device-এর `secret_token` এবং `backup_history` (অ্যাক্টর ইমেইল/নোট)।
 * রুটটি লগইন ছাড়াই কলযোগ্য হওয়ায় যে কেউ `GET /api/madrasa-info` দিয়ে
 * সব গোপন কী পড়ে নিতে পারত।
 *
 * এখন শুধু `toPublicMadrasaInfo()`-এর whitelisted ফিল্ড যায় (নাম, ঠিকানা, লোগো,
 * ফোন, ইমেইল, নিবন্ধন নম্বর ইত্যাদি প্রদর্শন-তথ্য) — `metadata` কখনো নয়।
 */
export async function GET() {
  try {
    const info = await getMadrasaInfo();
    return NextResponse.json(toPublicMadrasaInfo(info), {
      headers: {
        // পাবলিক তথ্য হলেও ক্রেডেনশিয়াল ফাঁস রোধে ক্যাশ সীমিত রাখা হয়
        "Cache-Control": "public, max-age=60, s-maxage=300",
      },
    });
  } catch (err: any) {
    console.error("Error in /api/madrasa-info:", err);
    return NextResponse.json({ error: "Failed to fetch madrasa info" }, { status: 500 });
  }
}
