"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireMasterAdmin } from "@/lib/auth";
import { adminCreateUser, adminDeleteUser, listUsers } from "@/lib/data/users";
import { logAction } from "@/lib/data/audit";

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
    await logAction({
      action: "user.create",
      entity: "user",
      summary: `Criou a conta ${parsed.data.email}`,
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
  const email = (await listUsers()).find((u) => u.id === id)?.email ?? id;
  try {
    await adminDeleteUser(id);
    await logAction({
      action: "user.delete",
      entity: "user",
      entityId: id,
      summary: `Apagou a conta ${email}`,
    });
  } catch (err) {
    console.error("deleteUser:", (err as Error).message);
  }
  revalidatePath("/admin/usuarios");
}
