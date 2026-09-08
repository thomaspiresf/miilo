import type { Metadata } from "next";
import { getUser } from "@/lib/auth";
import { getDefaultAddress } from "@/lib/data/addresses";
import { paymentsMocked } from "@/lib/env";
import { CheckoutClient } from "@/components/checkout/checkout-client";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const user = await getUser();
  const savedAddress = user ? await getDefaultAddress(user.id) : null;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-black">Finalizar compra</h1>
      <CheckoutClient
        initialEmail={user?.email ?? ""}
        savedAddress={savedAddress}
        paymentsMocked={paymentsMocked()}
      />
    </div>
  );
}
