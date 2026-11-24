"use client";
import { useEffect, useState } from "react";
export function MemoControl({
  id,
  compact = false,
}: {
  id: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [file, setFile] = useState<File | null>(null),
    [image, setImage] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const url = "/api/accounting/expenses/" + encodeURIComponent(id) + "/memo";
  useEffect(
    () => () => {
      if (image) URL.revokeObjectURL(image);
    },
    [image],
  );
  async function view() {
    setOpen(true);
    setBusy(true);
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) {
        setMessage((await r.json()).error);
        return;
      }
      setImage(URL.createObjectURL(await r.blob()));
      setMessage("");
    } catch {
      setMessage("মেমো পড়া যায়নি।");
    } finally {
      setBusy(false);
    }
  }
  async function upload() {
    if (!file || busy) return;
    setBusy(true);
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type, "X-Qawmi-Memo": "1" },
        body: file,
      });
      if (!r.ok) {
        setMessage((await r.json()).error);
        return;
      }
      await view();
    } catch {
      setMessage("আপলোড নিশ্চিত হয়নি। আবার পাঠানোর আগে মেমো দেখুন।");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="my-2 print:hidden">
      <button
        type="button"
        className="text-sm font-medium text-emerald-800 underline"
        disabled={busy}
        onClick={() => (open ? setOpen(false) : view())}
      >
        {open
          ? "মেমো বন্ধ করুন"
          : compact
            ? "মেমো"
            : "সরবরাহকারীর ক্যাশ মেমো দেখুন / যুক্ত করুন"}
      </button>
      {open && (
        <div className="space-y-2 rounded border bg-white p-3 text-sm">
          {message && <p role="status">{message}</p>}
          {image ? (
            <a href={image} target="_blank" rel="noreferrer">
              <img
                alt="সরবরাহকারীর মূল মেমো"
                src={image}
                className="max-h-72 max-w-full object-contain"
              />
            </a>
          ) : (
            <>
              <label className="block">
                মেমোর ছবি (JPG, PNG, WebP; সর্বোচ্চ ২ মেগাবাইট)
                <input
                  className="block w-full"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
              <button
                type="button"
                className="rounded border px-3 py-1"
                disabled={!file || file.size > 2097152 || busy}
                onClick={upload}
              >
                মেমো সংরক্ষণ করুন
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
