"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { addressSchema } from "@/lib/checkout-schema";
import { getUser } from "@/lib/auth";
import { onlyDigits } from "@/lib/utils";

const formSchema = addressSchema.extend({
  id: z.string().optional(),
  is_default: z.union([z.literal("on"), z.literal("")]).optional(),
});

export async function saveAddress(_prev: unknown, formData: FormData) {
  const user = await getUser();
  if (!user) return { error: "Faça login para salvar endereços." };

  const parsed = formSchema.safeParse({
    id: formData.get("id") || undefined,
    recipient: formData.get("recipient"),
    cep: onlyDigits(String(formData.get("cep") ?? "")),
    street: formData.get("street"),
    number: formData.get("number"),
    complement: formData.get("complement") || null,
    district: formData.get("district"),
    city: formData.get("city"),
    state: String(formData.get("state") ?? "").toUpperCase(),
    is_default: (formData.get("is_default") as "on" | "") || "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const supabase = await createClient();
  const { id, is_default, ...address } = parsed.data;
  const makeDefault = is_default === "on";

  if (makeDefault) {
    await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id);
  }

  if (id) {
    const { error } = await supabase
      .from("addresses")
      .update({ ...address, is_default: makeDefault })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("addresses")
      .insert({ ...address, is_default: makeDefault, user_id: user.id });
    if (error) return { error: error.message };
  }

  revalidatePath("/conta/enderecos");
  return { ok: true };
}

export async function deleteAddress(formData: FormData) {
  const user = await getUser();
  if (!user) return;
  const id = String(formData.get("id"));
  const supabase = await createClient();
  await supabase.from("addresses").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/conta/enderecos");
}

export async function setDefaultAddress(formData: FormData) {
  const user = await getUser();
  if (!user) return;
  const id = String(formData.get("id"));
  const supabase = await createClient();
  await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id);
  await supabase
    .from("addresses")
    .update({ is_default: true })
    .eq("id", id)
    .eq("user_id", user.id);
  revalidatePath("/conta/enderecos");
}
