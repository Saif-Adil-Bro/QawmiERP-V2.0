// Allocate the month's actual cost, not a rounded display rate. Distribute stray
// poisha by largest remainder with a stable student-ID tie break. Concessions
// reduce the pupil's due; they are not incoming cash or a transfer from Lillah.
export function boardingGross(
  costPoisha: number,
  meals: ReadonlyMap<string, number>,
) {
  const total = [...meals.values()].reduce((a, b) => a + b, 0);
  if (!Number.isSafeInteger(costPoisha) || costPoisha < 0)
    throw Error("বাজার খরচের অঙ্ক যাচাই করুন।");
  const shares = [...meals]
    .map(([id, n]) => {
      const weight = costPoisha * n;
      if (!Number.isSafeInteger(weight) || !Number.isSafeInteger(n) || n <= 0)
        throw Error("মিলের হিসাব যাচাই করুন।");
      return { id, gross: Math.floor(weight / total), rem: weight % total };
    })
    .sort((a, b) => b.rem - a.rem || (a.id < b.id ? -1 : 1));
  const spare = costPoisha - shares.reduce((sum, s) => sum + s.gross, 0);
  return new Map(shares.map((s, i) => [s.id, s.gross + (i < spare ? 1 : 0)]));
}
export function boardingCharge(grossPoisha: number, boardingType: string) {
  const discount =
    boardingType === "লিল্লাহ বোর্ডিং (ফ্রি)"
      ? grossPoisha
      : boardingType === "হাফ-ফ্রি"
        ? Math.round(grossPoisha / 2)
        : 0;
  return {
    gross_amount: grossPoisha / 100,
    discount_amount: discount / 100,
    bill_amount: (grossPoisha - discount) / 100,
  };
}
