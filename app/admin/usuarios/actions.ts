"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMasterAdmin } from "@/lib/auth";
import { adminCreateUser, adminDeleteUser } from "@/lib/data/users";

const createSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "A senha precisa ter no mínimo 6 caracteres"),
  name: z.string().trim().max(120).optional().nullable(),
});

export async function createUserAction(_prev: unknown, formData: FormData) {
  await requireMasterAdmin();
  const parsed = createSchema.safeParse({
    email: formData.get("email") ?? "",
    password: formData.get("password") ?? "",
    name: String(formData.get("name") ?? "").trim() || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  try {
    await adminCreateUser({
      email: parsed.data.email,
      password: parsed.data.password,
      name: parsed.data.name ?? null,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Falha ao criar a conta" };
  }
  revalidatePath("/admin/usuarios");
  return { ok: true };
}

export async function deleteUserAction(formData: FormData) {
  const me = await requireMasterAdmin();
  const id = String(formData.get("id"));
  if (me && me.id === id) {
    // não deixa apagar a própria conta
    return;
  }
  try {
    await adminDeleteUser(id);
  } catch (err) {
    console.error("deleteUser:", (err as Error).message);
  }
  revalidatePath("/admin/usuarios");
}
