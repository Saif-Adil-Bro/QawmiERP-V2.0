"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "./students";
import { revalidatePath } from "next/cache";

export async function registerMadrasa(formData: FormData) {
  const madrasaName = formData.get("madrasaName") as string;
  const contactEmail = formData.get("contactEmail") as string;
  const adminName = formData.get("adminName") as string;
  const adminEmail = formData.get("adminEmail") as string;
  const adminPassword = formData.get("adminPassword") as string;

  if (!madrasaName || !contactEmail || !adminName || !adminEmail || !adminPassword) {
    return { error: "All fields are required" };
  }

  const supabase = await createAdminClient();

  // 1. Create the Madrasa record (Tenant)
  const { data: madrasaData, error: madrasaError } = await supabase
    .from("madrasas")
    .insert({
      name: madrasaName,
      contact_email: contactEmail,
      subscription_plan: "free",
    })
    .select("id")
    .single();

  if (madrasaError || !madrasaData) {
    return { error: madrasaError?.message || "Failed to create madrasa" };
  }

  const madrasaId = madrasaData.id;

  // 2. Create the Admin User in Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    // Rollback madrasa creation on fail
    await supabase.from("madrasas").delete().eq("id", madrasaId);
    return { error: authError?.message || "Failed to create auth user" };
  }

  const authUserId = authData.user.id;

  // 3. Create the User record in public schema
  const { error: userError } = await supabase
    .from("users")
    .insert({
      id: authUserId,
      madrasa_id: madrasaId,
      role: "super_admin", // Given they are the creator, they could be super_admin or admin
      full_name: adminName,
      email: adminEmail,
    });

  if (userError) {
    // Rollback if failed
    await supabase.auth.admin.deleteUser(authUserId);
    await supabase.from("madrasas").delete().eq("id", madrasaId);
    return { error: userError.message || "Failed to create user profile" };
  }

  return { success: true, message: "Madrasa registered successfully!" };
}


export async function getMadrasaDetails() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const madrasaId = await getAuthMadrasaId(supabase, user);
  if (!madrasaId) return null;
  
  const { data, error } = await supabase
    .from("madrasas")
    .select("*")
    .eq("id", madrasaId)
    .single();
    
  if (error || !data) return null;

  let meta: Record<string, any> = {};
  if (data.registration_no) {
    try {
      if (data.registration_no.startsWith("{")) {
        meta = JSON.parse(data.registration_no);
      } else {
        meta = { reg_no: data.registration_no };
      }
    } catch {
      meta = { reg_no: data.registration_no };
    }
  }

  const { data: logoData } = supabase.storage.from('logos').getPublicUrl(`madrasa_logo_${data.id}.png`);
  const { data: sigData } = supabase.storage.from('signatures').getPublicUrl(`madrasa_signature_${data.id}.png`);

  return {
    ...data,
    registration_no: meta.reg_no || (typeof data.registration_no === "string" && !data.registration_no.startsWith("{") ? data.registration_no : ""),
    reg_no: meta.reg_no || "",
    established_year: meta.established_year || "",
    principal_name: meta.principal_name || "",
    principal_signature_url: meta.signature_url || sigData?.publicUrl || "",
    signature_url: meta.signature_url || sigData?.publicUrl || "",
    eiin_code: meta.eiin_code || "",
    slogan: meta.slogan || "",
    website: meta.website || "",
    logo_url: meta.logo_url || logoData?.publicUrl || "",
    metadata: meta,
  };
}

export async function getMadrasaProfileWithLogo() {
  const madrasa = await getMadrasaDetails();
  if (!madrasa) return null;
  const supabase = await createClient();
  const { data: { publicUrl: logoUrl } } = supabase.storage.from('logos').getPublicUrl(`madrasa_logo_${madrasa.id}.png`);
  const { data: { publicUrl: signatureUrl } } = supabase.storage.from('signatures').getPublicUrl(`madrasa_signature_${madrasa.id}.png`);
  
  return {
    madrasa: {
      id: madrasa.id,
      name: madrasa.name,
      address: madrasa.address,
      phone: madrasa.contact_phone || madrasa.phone,
      email: madrasa.contact_email,
      registration_no: madrasa.registration_no || madrasa.reg_no,
      established_year: madrasa.established_year,
      principal_name: madrasa.principal_name,
      principal_signature_url: madrasa.principal_signature_url || signatureUrl,
      eiin_code: madrasa.eiin_code,
      slogan: madrasa.slogan,
      website: madrasa.website,
    },
    logoUrl: madrasa.logo_url || logoUrl,
    signatureUrl: madrasa.principal_signature_url || signatureUrl,
  };
}

export async function updateMadrasaDetails(formData: FormData) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "ইউজার লগইন করা নেই" };
    
    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদরাসা আইডি পাওয়া যায়নি" };
    
    const name = (formData.get("name") as string)?.trim();
    const address = (formData.get("address") as string)?.trim() || "";
    const phone = (formData.get("phone") as string)?.trim() || "";
    const email = (formData.get("email") as string)?.trim() || "";
    const establishedYear = (formData.get("establishedYear") as string)?.trim() || "";
    const principalName = (formData.get("principalName") as string)?.trim() || "";
    const registrationNo = (formData.get("registrationNo") as string)?.trim() || "";
    const eiinCode = (formData.get("eiinCode") as string)?.trim() || "";
    const slogan = (formData.get("slogan") as string)?.trim() || "";
    const website = (formData.get("website") as string)?.trim() || "";

    const logoFile = formData.get("logo") as File | null;
    const logoUrl = (formData.get("logoUrl") as string)?.trim() || "";
    const signatureFile = formData.get("signature") as File | null;
    const signatureUrl = (formData.get("signatureUrl") as string)?.trim() || "";
    
    if (!name) {
      return { error: "মাদরাসার নাম অবশ্যই দিতে হবে" };
    }
    
    const adminClient = await createAdminClient();

    // Ensure signatures bucket exists
    try {
      await adminClient.storage.createBucket("signatures", {
        public: true,
        fileSizeLimit: 2097152,
        allowedMimeTypes: ["image/png", "image/jpeg", "image/jpg", "image/webp"]
      });
    } catch {
      // Bucket already exists
    }

    let finalLogoUrl = logoUrl;
    let finalSignatureUrl = signatureUrl;

    const FREEIMAGE_API_KEY = "6d207e02198a847aa98d0a2a901485a5";

    // 1. Handle Logo Upload if File provided
    if (logoFile && logoFile.size > 0) {
      const filePath = `madrasa_logo_${madrasaId}.png`;
      const arrayBuffer = await logoFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString("base64");
      
      // Try uploading to Freeimage / iili.io
      let cloudUrl: string | null = null;
      try {
        const iiliFormData = new FormData();
        iiliFormData.append("key", FREEIMAGE_API_KEY);
        iiliFormData.append("action", "upload");
        iiliFormData.append("source", base64);
        iiliFormData.append("format", "json");

        const iiliRes = await fetch("https://freeimage.host/api/1/upload", {
          method: "POST",
          headers: { "User-Agent": "Mozilla/5.0" },
          body: iiliFormData,
          signal: AbortSignal.timeout(6000),
        });
        if (iiliRes.ok) {
          const data = await iiliRes.json();
          if (data?.image?.url || data?.image?.display_url) {
            cloudUrl = data.image.url || data.image.display_url;
          }
        }
      } catch {
        // Continue to Catbox / Supabase
      }

      // Try Catbox if iili failed
      if (!cloudUrl) {
        try {
          const catboxFormData = new FormData();
          catboxFormData.append("reqtype", "fileupload");
          const blob = new Blob([buffer], { type: logoFile.type || "image/png" });
          catboxFormData.append("fileToUpload", blob, logoFile.name || "logo.png");

          const catboxRes = await fetch("https://catbox.moe/user/api.php", {
            method: "POST",
            body: catboxFormData,
            signal: AbortSignal.timeout(6000),
          });
          if (catboxRes.ok) {
            const text = (await catboxRes.text()).trim();
            if (text.startsWith("http://") || text.startsWith("https://")) {
              cloudUrl = text;
            }
          }
        } catch {
          // Continue to storage
        }
      }

      // Also persist to Supabase Storage
      const { error: uploadError } = await adminClient.storage
        .from('logos')
        .upload(filePath, buffer, {
          contentType: logoFile.type || "image/png",
          upsert: true
        });
        
      if (uploadError && !cloudUrl) {
        return { error: "লোগো আপলোড করতে ব্যর্থ হয়েছে: " + uploadError.message };
      }
      const { data: pubLogo } = adminClient.storage.from('logos').getPublicUrl(filePath);
      finalLogoUrl = cloudUrl || pubLogo.publicUrl;
    } else if (logoUrl && logoUrl.length > 0) {
      // If external URL provided (Catbox, iili.io, Google Drive, etc.), try caching to storage
      let fetchUrl = logoUrl;
      if (fetchUrl.includes("drive.google.com")) {
        const fileDMatch = fetchUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        const idMatch = fetchUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        const dMatch = fetchUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
        const fileId = (fileDMatch && fileDMatch[1]) || (idMatch && idMatch[1]) || (dMatch && dMatch[1]);
        if (fileId) {
          fetchUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        }
      }
      
      try {
        const fetchRes = await fetch(fetchUrl);
        if (fetchRes.ok) {
          const contentType = fetchRes.headers.get("content-type") || "image/png";
          const arrayBuffer = await fetchRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const filePath = `madrasa_logo_${madrasaId}.png`;
          await adminClient.storage.from('logos').upload(filePath, buffer, {
            contentType,
            upsert: true
          });
        }
      } catch {
        // Fall back to direct external URL
      }
    }

    // 2. Handle Signature Upload if File provided
    if (signatureFile && signatureFile.size > 0) {
      const filePath = `madrasa_signature_${madrasaId}.png`;
      const arrayBuffer = await signatureFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString("base64");
      
      // Try uploading to Freeimage / iili.io
      let cloudSigUrl: string | null = null;
      try {
        const iiliFormData = new FormData();
        iiliFormData.append("key", FREEIMAGE_API_KEY);
        iiliFormData.append("action", "upload");
        iiliFormData.append("source", base64);
        iiliFormData.append("format", "json");

        const iiliRes = await fetch("https://freeimage.host/api/1/upload", {
          method: "POST",
          headers: { "User-Agent": "Mozilla/5.0" },
          body: iiliFormData,
          signal: AbortSignal.timeout(6000),
        });
        if (iiliRes.ok) {
          const data = await iiliRes.json();
          if (data?.image?.url || data?.image?.display_url) {
            cloudSigUrl = data.image.url || data.image.display_url;
          }
        }
      } catch {
        // Continue to Catbox / Supabase
      }

      // Try Catbox if iili failed
      if (!cloudSigUrl) {
        try {
          const catboxFormData = new FormData();
          catboxFormData.append("reqtype", "fileupload");
          const blob = new Blob([buffer], { type: signatureFile.type || "image/png" });
          catboxFormData.append("fileToUpload", blob, signatureFile.name || "signature.png");

          const catboxRes = await fetch("https://catbox.moe/user/api.php", {
            method: "POST",
            body: catboxFormData,
            signal: AbortSignal.timeout(6000),
          });
          if (catboxRes.ok) {
            const text = (await catboxRes.text()).trim();
            if (text.startsWith("http://") || text.startsWith("https://")) {
              cloudSigUrl = text;
            }
          }
        } catch {
          // Continue to storage
        }
      }

      const { error: uploadSigError } = await adminClient.storage
        .from('signatures')
        .upload(filePath, buffer, {
          contentType: signatureFile.type || "image/png",
          upsert: true
        });
        
      if (uploadSigError && !cloudSigUrl) {
        return { error: "স্বাক্ষর আপলোড করতে ব্যর্থ হয়েছে: " + uploadSigError.message };
      }
      const { data: pubSig } = adminClient.storage.from('signatures').getPublicUrl(filePath);
      finalSignatureUrl = cloudSigUrl || pubSig.publicUrl;
    } else if (signatureUrl && signatureUrl.length > 0) {
      // If external URL provided for signature
      let fetchUrl = signatureUrl;
      if (fetchUrl.includes("drive.google.com")) {
        const fileDMatch = fetchUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        const idMatch = fetchUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        const dMatch = fetchUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
        const fileId = (fileDMatch && fileDMatch[1]) || (idMatch && idMatch[1]) || (dMatch && dMatch[1]);
        if (fileId) {
          fetchUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        }
      }
      
      try {
        const fetchRes = await fetch(fetchUrl);
        if (fetchRes.ok) {
          const contentType = fetchRes.headers.get("content-type") || "image/png";
          const arrayBuffer = await fetchRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const filePath = `madrasa_signature_${madrasaId}.png`;
          await adminClient.storage.from('signatures').upload(filePath, buffer, {
            contentType,
            upsert: true
          });
        }
      } catch {
        // Fall back to direct external URL
      }
    }

    // 3. Serialize metadata to registration_no
    const metadataPayload = {
      reg_no: registrationNo,
      established_year: establishedYear,
      principal_name: principalName,
      signature_url: finalSignatureUrl,
      eiin_code: eiinCode,
      slogan: slogan,
      website: website,
      logo_url: finalLogoUrl,
    };

    // 4. Update madrasas table
    const updatePayload: Record<string, any> = {
      name,
      address,
      contact_phone: phone,
      registration_no: JSON.stringify(metadataPayload),
    };
    if (email) {
      updatePayload.contact_email = email;
    }

    const { error: updateError } = await adminClient
      .from("madrasas")
      .update(updatePayload)
      .eq("id", madrasaId);
      
    if (updateError) {
      return { error: "তথ্য আপডেট করতে ব্যর্থ হয়েছে: " + updateError.message };
    }
    
    // Clear cache to show the updated settings immediately
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard", "layout");
    revalidatePath("/dashboard/academic/certificates");
    revalidatePath("/dashboard/academic/id-cards");
    revalidatePath("/dashboard/academic/routine");
    
    return { 
      success: true, 
      message: "মাদরাসার তথ্য, মুহতামিমের বিবরণ ও স্বাক্ষর সফলভাবে সংরক্ষিত হয়েছে।" 
    };
  } catch (error: any) {
    return { error: error?.message || "একটি অজানা সমস্যা হয়েছে" };
  }
}