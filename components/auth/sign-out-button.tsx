"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        await createClient().auth.signOut();
        router.push("/");
        router.refresh();
      }}
    >
      {loading ? <Spinner /> : "Sair"}
    </Button>
  );
}
