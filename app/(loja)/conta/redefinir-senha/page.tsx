import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Redefinir senha", robots: { index: false } };

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto max-w-sm py-8">
      <h1 className="text-2xl font-black">Nova senha</h1>
      <p className="mt-1 text-sm text-muted">Escolha uma senha para sua conta.</p>
      <div className="mt-6">
        <ResetPasswordForm />
      </div>
    </div>
  );
}
