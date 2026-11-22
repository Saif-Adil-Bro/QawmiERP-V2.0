// Static service-worker shell. Reuse the actual teacher forms and family report,
// not cached authenticated HTML. This is loaded only on the Hifz/academic routes.
import { createRoot } from "react-dom/client";
import HifzForm from "@/app/teacher-portal/hifz/HifzForm";
import { StudentReport } from "./Report";
import { browserSession, ownerKey } from "@/lib/offline-auth";
import { snapshotBundle } from "@/lib/hifz/drafts";
import { toDhakaDateString } from "@/lib/date-utils";
export function mount(node: HTMLElement, row: any) {
  const d = row.data,
    owner = ownerKey(browserSession());
  if (!node.isConnected || owner !== row.owner) return;
  const root = createRoot(node),
    bundle = snapshotBundle(d);
  if (owner.endsWith(":teacher"))
    root.render(
      <HifzForm
        seed={{
          classes: d.classes,
          students: d.students,
          teachers: d.hifzListeners || [],
          asOf: row.syncedAt,
          owner,
          bundle,
        }}
        currentClassId={d.classes[0]?.id || ""}
        currentDate={toDhakaDateString()}
      />,
    );
  else if (row.studentId && row.studentId === d.activeStudent?.id)
    root.render(<StudentReport bundle={bundle} studentId={row.studentId} />);
  window.addEventListener("storage", () => {
    if (ownerKey(browserSession()) !== owner) root.unmount();
  });
}
