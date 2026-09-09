import { getExpenses } from "@/app/actions/accounting";
import { getBazarExpenses } from "@/app/actions/boarding";
import { getFunds } from "@/app/actions/zakat";
import { getMadrasaInfo } from "@/lib/getMadrasaInfo";
import { DEFAULT_FUNDS } from "@/lib/fund-utils";
import ExpensesClient from "./ExpensesClient";

export default async function ExpensesPage(props: {
  searchParams?: Promise<{ month?: string; year?: string; fundId?: string }>;
}) {
  const resolvedParams = props.searchParams ? (await props.searchParams) || {} : {};
  
  const [expenses, bazarExpenses, loadedFunds, madrasaInfo] = await Promise.all([
    getExpenses({ month: resolvedParams?.month, year: resolvedParams?.year, fundId: resolvedParams?.fundId }),
    getBazarExpenses().catch(() => []),
    getFunds().catch(() => DEFAULT_FUNDS),
    getMadrasaInfo().catch(() => undefined),
  ]);

  const funds = loadedFunds && loadedFunds.length > 0 ? loadedFunds : DEFAULT_FUNDS;

  return (
    <ExpensesClient
      initialExpenses={expenses}
      initialBazarExpenses={bazarExpenses}
      funds={funds}
      madrasaInfo={madrasaInfo}
    />
  );
}
