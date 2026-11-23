import {expensePeriod} from "@/lib/finance/period";
import { getExpenses } from "@/app/actions/accounting";
import { getBazarExpenses } from "@/app/actions/boarding";
import { getFundChoices } from "@/app/actions/zakat";
import { getMadrasaInfo, toPublicMadrasaInfo } from "@/lib/getMadrasaInfo";
import ExpensesClient from "./ExpensesClient";

export default async function ExpensesPage(props: {
  searchParams?: Promise<{ month?: string; year?: string; fundId?: string }>;
}) {
  const resolvedParams = props.searchParams ? (await props.searchParams) || {} : {};
  
  const {start,end}=expensePeriod(resolvedParams);
  const [expenses, bazarExpenses, loadedFunds, madrasaInfo] = await Promise.all([
    getExpenses({ month: resolvedParams?.month, year: resolvedParams?.year, fundId: resolvedParams?.fundId }),
    getBazarExpenses(start,end),
    getFundChoices(true),
    getMadrasaInfo().catch(() => undefined),
  ]);

  const funds = loadedFunds;

  return (
    <ExpensesClient
      initialExpenses={expenses}
      initialBazarExpenses={resolvedParams.fundId && resolvedParams.fundId!=="all" ? bazarExpenses.filter(b=>b.fund_id===resolvedParams.fundId):bazarExpenses}
      funds={funds}
      madrasaInfo={toPublicMadrasaInfo(madrasaInfo)}
    />
  );
}
