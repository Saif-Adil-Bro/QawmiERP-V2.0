import { useLiveQuery } from "dexie-react-hooks";
import { browserSession, ownerKey } from "@/lib/offline-auth";
import { getOfflineDb } from "@/lib/offlineDb";

export default function FrozenDraftNotice({
  owner,
  exam,
  group,
  subject,
}: {
  owner: string;
  exam: string;
  group: string;
  subject: string;
}) {
  const ids = useLiveQuery(async () => {
    if (!owner || owner !== ownerKey(browserSession())) return [];
    return getOfflineDb(owner)
      .offlineOutbox.where("status")
      .equals("failed")
      .filter(
        (i) =>
          i.rejected === "EXAM_LOCKED" &&
          i.payload.exam_id === exam &&
          i.payload.class_id === group &&
          i.payload.subject_name === subject,
      )
      .primaryKeys();
  }, [owner, exam, group, subject]);
  if (!ids?.length) return null;
  return (
    <div
      role="status"
      className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
    >
      পরীক্ষাটি লক থাকায় এই বিষয়ের অফলাইন খসড়া সংরক্ষিত হয়নি। এটি আর স্বয়ংক্রিয়ভাবে পাঠানো হবে না।
      <button
        type="button"
        className="ml-2 underline"
        onClick={() => {
          if (owner === ownerKey(browserSession()))
            void getOfflineDb(owner).offlineOutbox.bulkDelete(ids);
        }}
      >
        বাতিল খসড়া সরান
      </button>
    </div>
  );
}
