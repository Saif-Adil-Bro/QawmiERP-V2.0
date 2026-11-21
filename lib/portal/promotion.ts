import type {
  MadrasaMetaWithSessions,
  ExtendedStudentProfile,
} from "../sessions";

type Placement = {
  id: string;
  previous_class: string | null;
  previous_roll: string | null;
  class_id: string | null;
  roll_number: string | null;
  class_name: string | null;
  student_status: ExtendedStudentProfile["student_status"];
};
// A promotion into a future year changes its enrollment now, not today's directory.
// Keep expected prior values so activation cannot silently overwrite a later manual transfer.
export function schedulePlacement(
  meta: MadrasaMetaWithSessions,
  session: string,
  placement: Placement,
) {
  const staged = (meta.pending_portal_promotions ||= {});
  (staged[session] ||= {})[placement.id] = placement;
}
export function activatePlacements(
  meta: MadrasaMetaWithSessions,
  session: string,
) {
  const plan: Placement[] = Object.values(
    meta.pending_portal_promotions?.[session] || {},
  );
  const changes = plan.map(
    ({
      id,
      previous_class,
      previous_roll,
      class_id,
      roll_number,
      class_name,
      student_status,
    }) => {
      const profiles = (meta.student_profiles ||= {}),
        prior = profiles[id] || {};
      profiles[id] = {
        ...prior,
        class_id: class_id || undefined,
        class_name: class_name || undefined,
        roll_number: roll_number || undefined,
        student_status,
        ...(previous_class !== class_id || !class_id
          ? { section: "", section_id: "", department_id: null }
          : {}),
      };
      return { id, previous_class, previous_roll, class_id, roll_number };
    },
  );
  if (meta.pending_portal_promotions)
    delete meta.pending_portal_promotions[session];
  return changes;
}
