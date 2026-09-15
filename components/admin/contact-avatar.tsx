// A Cloud API do WhatsApp não expõe foto de perfil de terceiros (só o nome
// de exibição, via contacts[0].profile.name no webhook) — o mesmo limite
// que o WhatsApp Web respeita mostrando um avatar de iniciais pra quem não
// tem foto salva. Fazemos o mesmo aqui: iniciais sobre uma cor fixa por
// telefone, nunca uma foto de verdade que não temos como obter.
const PALETTE = ["#0EA5A4", "#6366F1", "#F59E0B", "#EC4899", "#10B981", "#8B5CF6", "#F97316", "#0EA5E9"];

function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

// Nomes de exibição do WhatsApp às vezes vêm com emoji ou pontuação
// ("😊 João", "Ana (loja)") — pega só as palavras que começam com letra/número
// pra não acabar com um emoji ou "(" como inicial.
function initialsFor(label: string): string {
  const parts = label
    .trim()
    .split(/\s+/)
    .filter((p) => /^[\p{L}\p{N}]/u.test(p));
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function ContactAvatar({
  name,
  phone,
  size = 40,
}: {
  name: string | null;
  phone: string;
  size?: number;
}) {
  // Sem nome salvo ainda, cai pro telefone — mas todo número BR começa com
  // "55" (código do país), então as 2 primeiras iniciais ficam iguais pra
  // todo mundo. Usa os 2 últimos dígitos nesse caso, que de fato variam.
  const initials = name?.trim() ? initialsFor(name) : phone.slice(-2);
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: colorFor(phone), fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  );
}
