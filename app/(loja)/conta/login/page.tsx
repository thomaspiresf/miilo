import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser, isDemoMode } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage(props: PageProps<"/conta/login">) {
  const sp = await props.searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/conta";

  const user = await getUser();
  // já logado → segue direto (mesmo que não seja admin: cai no /conta, sem aviso)
  if (user) redirect(next === "/admin" ? "/conta" : next);
  const demo = await isDemoMode();

  return (
    <div className="mx-auto max-w-sm py-8">
      <h1 className="text-2xl font-black">Entrar na {`miilo`}</h1>
      <p className="mt-1 text-sm text-muted">
        Acompanhe seus pedidos e agilize o checkout.
      </p>
      <div className="mt-6">
        <LoginForm next={next} demo={demo} />
      </div>
      <p className="mt-6 text-center text-xs text-muted">
        Ao continuar você concorda com nossos{" "}
        <Link href="/" className="underline">
          termos
        </Link>
        .
      </p>
    </div>
  );
}
