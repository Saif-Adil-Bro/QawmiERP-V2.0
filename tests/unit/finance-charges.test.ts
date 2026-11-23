import { describe, it, expect } from "vitest";
import { monthlyCharges } from "@/lib/finance/monthly-charges";
const ft = {
  id: "tuition",
  code: "MONTHLY",
  name: "Tuition",
  frequency: "MONTHLY",
  is_active: true,
  default_amount: 15,
  fund_id: "school",
  fund_name: "School",
};
const pupil = { id: "p", class_id: "C" },
  params = { sessionId: "S" };
const schedule = (id: string, amount: number, cl = "ALL", cat = "ALL") => ({
  id,
  session_id: "S",
  class_id: cl,
  student_category: cat,
  items: [{ fee_type_id: "tuition", frequency: "MONTHLY", amount }],
});
describe("monthly charges (manual and cron)", () => {
  it("chooses the most specific eligible structure, honors a zero contract, and applies only current approved concessions", () => {
    const book: any = {
      fee_types: [ft],
      fee_structures: [
        schedule("all", 11),
        schedule("class", 10, "C"),
        schedule("resident", 7.25, "C", "RESIDENTIAL"),
      ],
      student_profiles: { p: { residential_status: "আবাসিক" } },
      discounts: [
        {
          student_id: "p",
          session_id: "old",
          status: "APPROVED",
          discount_type: "FULL_WAIVER",
        },
        {
          student_id: "p",
          session_id: "S",
          status: "APPROVED",
          discount_type: "PERCENTAGE",
          value: 10,
        },
      ],
    };
    for (const auto of [true, false])
      expect(monthlyCharges(book, pupil, { ...params, auto })).toMatchObject([
        { baseAmount: 7.25, discountAmount: 0.73, payable: 6.52 },
      ]);
    book.student_profiles.p.monthly_fee = 0;
    expect(monthlyCharges(book, pupil, params)[0].payable).toBe(0);
  });
  it("refuses ambiguous structures, inactive components and missing funds", () => {
    expect(() =>
      monthlyCharges(
        {
          fee_types: [ft],
          fee_structures: [schedule("a", 12), schedule("b", 22)],
        } as any,
        pupil,
        params,
      ),
    ).toThrow();
    for (const change of [{ is_active: false }, { fund_id: "" }])
      expect(() =>
        monthlyCharges(
          {
            fee_types: [{ ...ft, ...change }],
            fee_structures: [schedule("a", 8)],
          } as any,
          pupil,
          params,
        ),
      ).toThrow();
    expect(monthlyCharges({}, pupil, { ...params, auto: true })).toEqual([]);
  });
});
