import React from "react";
import AmalTrackerClient from "./AmalTrackerClient";
import { getAmalTrackerData } from "@/app/actions/amal-tracker";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "ছাত্রদের বাড়ির কর্মসূচি ও আমল ট্র্যাকার | কওমি ড্যাশবোর্ড",
  description: "কওমি মাদরাসা শিক্ষার্থীদের বাড়ির কর্মসূচি, নামাজ ও আমল ট্র্যাকার এবং A4 প্রিন্ট স্টুডিও।",
};

export default async function AmalTrackerPage() {
  const data = await getAmalTrackerData();

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <AmalTrackerClient
        initialTemplates={data.templates || []}
        initialLogs={data.evaluationLogs || []}
        classes={data.classes || []}
        students={data.students || []}
        madrasaInfo={data.madrasaInfo}
      />
    </div>
  );
}
