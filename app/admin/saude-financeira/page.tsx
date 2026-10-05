import { redirect } from "next/navigation";

// A saúde financeira agora vive no topo de /admin/gastos.
export default function FinancialHealthRedirect() {
  redirect("/admin/gastos");
}
