import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="text-5xl font-black">404</p>
      <p className="mt-2 text-muted">Não encontramos essa página.</p>
      <Link
        href="/"
        className="mt-6 rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground"
      >
        Voltar para a loja
      </Link>
    </div>
  );
}
