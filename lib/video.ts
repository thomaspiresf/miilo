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

/**
 * src do iframe para YouTube/Vimeo conforme o modo de áudio:
 *  - "on"       → embed padrão (play manual, com som)
 *  - "optional" → autoplay mudo em loop, com controles (cliente pode ativar o som)
 *  - "muted"    → autoplay mudo em loop, sem controles
 */
export function embedSrc(
  video: ParsedVideo,
  audio: "muted" | "optional" | "on",
): string {
  if (video.kind === "file" || audio === "on") return video.src;
  const locked = audio === "muted";
  if (video.kind === "youtube") {
    const params = [
      "rel=0",
      "autoplay=1",
      "mute=1",
      "loop=1",
      `playlist=${video.id}`,
      `controls=${locked ? 0 : 1}`,
      ...(locked ? ["disablekb=1", "modestbranding=1"] : []),
    ].join("&");
    return `https://www.youtube.com/embed/${video.id}?${params}`;
  }
  return `https://player.vimeo.com/video/${video.id}?autoplay=1&muted=1&loop=1&controls=${locked ? 0 : 1}`;
}
