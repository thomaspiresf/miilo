/** Analisa um valor de vídeo (arquivo hospedado ou link YouTube/Vimeo). */
export type ParsedVideo =
  | { kind: "file"; src: string }
  | { kind: "youtube"; src: string; id: string }
  | { kind: "vimeo"; src: string; id: string };

export function parseVideo(url: string | null | undefined): ParsedVideo | null {
  if (!url) return null;
  const u = url.trim();
  if (!u) return null;

  const yt = u.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/,
  );
  if (yt) {
    return {
      kind: "youtube",
      id: yt[1],
      src: `https://www.youtube.com/embed/${yt[1]}?rel=0`,
    };
  }

  const vm = u.match(/vimeo\.com\/(?:video\/|manage\/videos\/)?(\d+)/);
  if (vm) {
    return { kind: "vimeo", id: vm[1], src: `https://player.vimeo.com/video/${vm[1]}` };
  }

  // qualquer outra coisa: tratamos como arquivo de vídeo (URL pública)
  return { kind: "file", src: u };
}

/** true se a string parece um link de YouTube/Vimeo (não um arquivo). */
export function isVideoLink(url: string) {
  const p = parseVideo(url);
  return p?.kind === "youtube" || p?.kind === "vimeo";
}
