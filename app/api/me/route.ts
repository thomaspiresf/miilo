import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

/**
 * Sessão do usuário para componentes do cliente (ex.: link "admin" no header).
 * Mantido fora da renderização das páginas da loja pra elas continuarem
 * estáticas / ISR — este endpoint é o único ponto que lê o cookie de sessão.
 */
export async function GET() {
  const user = await getUser();
  return NextResponse.json(
    { isAdmin: user?.role === "admin" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
