"use client";

// Sem a otimização automática de imagem do Next (ver next.config.ts —
// desligada pra não estourar a cota de "Image Transformations" da Vercel),
// a imagem vai pro ar do jeito que o admin enviar. Card da vitrine nunca
// mostra mais que isso, então redimensionar aqui no navegador antes do
// upload evita subir foto de celular com 4000px pra aparecer num quadrado
// de 260px.
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;
const WEBP_QUALITY = 0.85;

const HEIC_TYPE = /^image\/hei[cf]/i;
const HEIC_NAME = /\.hei[cf]$/i;

/**
 * Foto de iPhone vem em HEIC e só o Safari sabe abrir. Converte pra JPEG no
 * navegador (biblioteca carregada só quando preciso, é pesada). Se falhar,
 * devolve o arquivo original e o upload mostra o erro de formato.
 */
async function convertHeicToJpeg(file: File): Promise<File> {
  // Chrome/Windows costuma mandar HEIC com type vazio — olha a extensão também
  if (!HEIC_TYPE.test(file.type) && !HEIC_NAME.test(file.name)) return file;
  try {
    const { heicTo } = await import("heic-to/next");
    const blob = await heicTo({ blob: file, type: "image/jpeg", quality: JPEG_QUALITY });
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

/**
 * Redimensiona/recomprime a imagem no navegador antes do upload, só quando
 * ela passa de MAX_DIMENSION px no lado maior. PNG mantém transparência
 * (recomprime sem perda); JPEG/WebP usam qualidade 85%. Se algo falhar no
 * meio do caminho (formato não suportado, canvas indisponível), devolve o
 * arquivo original — nunca bloqueia o upload por causa disso.
 */
export async function resizeImageForUpload(
  input: File,
  opts: { maxDimension?: number } = {},
): Promise<File> {
  const maxDimension = opts.maxDimension ?? MAX_DIMENSION;
  const file = await convertHeicToJpeg(input);
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  const { width, height } = bitmap;
  if (Math.max(width, height) <= maxDimension) {
    bitmap.close();
    return file;
  }

  const scale = maxDimension / Math.max(width, height);
  const targetW = Math.round(width * scale);
  const targetH = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close();

  const quality =
    file.type === "image/webp" ? WEBP_QUALITY : file.type === "image/jpeg" ? JPEG_QUALITY : undefined;
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, file.type, quality));
  if (!blob) return file;

  // canvas.toBlob cai pra PNG silenciosamente se o navegador não souber
  // recodificar pro formato pedido (WebP em Safari mais antigo, por ex.) —
  // usa o tipo real do blob resultante pra nome/type não ficarem mentindo.
  const outType = blob.type || file.type;
  const sameType = outType === file.type;
  const outExt = outType.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
  const outName = sameType ? file.name : file.name.replace(/\.[^.]+$/, `.${outExt}`);

  return new File([blob], outName, { type: outType, lastModified: Date.now() });
}
