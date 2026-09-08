import "server-only";
import { createClient } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/env";
import type { Address } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapAddress(r: any): Address {
  return {
    id: r.id,
    recipient: r.recipient,
    cep: r.cep,
    street: r.street,
    number: r.number,
    complement: r.complement ?? null,
    district: r.district,
    city: r.city,
    state: r.state,
    is_default: r.is_default,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function listAddresses(userId: string): Promise<Address[]> {
  if (!hasSupabase()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("addresses")
    .select("*")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  return (data ?? []).map(mapAddress);
}

export async function getDefaultAddress(userId: string): Promise<Address | null> {
  const all = await listAddresses(userId);
  return all.find((a) => a.is_default) ?? all[0] ?? null;
}
