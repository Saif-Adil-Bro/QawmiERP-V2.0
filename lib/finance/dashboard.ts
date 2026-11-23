import { ledgerEntries, money, type Books } from "./entries";

// Completed central postings; unsettled event books are not deposits into a central fund.
export function dashboardFinance(books: Books, today: string) {
  let totalIncome = 0,
    totalExpense = 0,
    todayIncome = 0,
    todayExpense = 0,
    bazarSum = 0;
  const monthlyData: Record<string, { income: number; expense: number }> = {};
  for (const e of ledgerEntries(books)) {
    if (e.status === "VOID") continue;
    if (e.income) {
      totalIncome = money(totalIncome + e.amount);
      if (e.date === today) todayIncome = money(todayIncome + e.amount);
    } else {
      totalExpense = money(totalExpense + e.amount);
      if (e.date === today) todayExpense = money(todayExpense + e.amount);
      if (e.source === "bazar") bazarSum = money(bazarSum + e.amount);
    }
    if (!e.date) continue;
    const m = e.date.slice(0, 7),
      key = e.income ? "income" : "expense";
    monthlyData[m] ??= { income: 0, expense: 0 };
    monthlyData[m][key] = money(monthlyData[m][key] + e.amount);
  }
  return {
    totalIncome,
    totalExpense,
    todayIncome,
    todayExpense,
    bazarSum,
    expensesSum: money(totalExpense - bazarSum),
    monthlyData,
  };
}
