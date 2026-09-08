import { onlyDigits } from "@/lib/utils";

export type ViaCepResult = {
  cep: string;
  street: string;
  district: string;
  city: string;
  state: string;
};

/** Consulta o ViaCEP. Retorna null se o CEP não existir. */
export async function lookupCep(cepInput: string): Promise<ViaCepResult | null> {
  const cep = onlyDigits(cepInput);
  if (cep.length !== 8) return null;

  const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
    next: { revalidate: 60 * 60 * 24 * 7 },
  });
  if (!res.ok) return null;

  const data = await res.json();
  if (data?.erro) return null;

  return {
    cep,
    street: data.logradouro ?? "",
    district: data.bairro ?? "",
    city: data.localidade ?? "",
    state: data.uf ?? "",
  };
}
