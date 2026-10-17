export type AudioFormat = "wav" | "mp3" | "webm" | "m4a" | "ogg" | "aac" | "flac";

function requireContent(value: string) {
  if (!value.trim()) throw new Error("Media content is empty");
  return value;
}

export function responseImage(urlOrDataURL: string) {
  return { type: "input_image", image_url: requireContent(urlOrDataURL) } as const;
}

export function responsePDF(filename: string, base64: string) {
  return { type: "input_file", filename, file_data: `data:application/pdf;base64,${requireContent(base64)}` } as const;
}

export function sdkImage(urlOrDataURL: string) {
  return { type: "image", image: new URL(requireContent(urlOrDataURL)) } as const;
}

export function sdkPDF(filename: string, base64: string) {
  return { type: "file", filename, data: requireContent(base64), mediaType: "application/pdf" } as const;
}

export function chatImage(urlOrDataURL: string) {
  return { type: "image_url", image_url: { url: requireContent(urlOrDataURL) } } as const;
}

export function chatVideo(urlOrDataURL: string) {
  return { type: "video_url", video_url: { url: requireContent(urlOrDataURL) } } as const;
}

export function chatAudio(base64: string, format: AudioFormat) {
  return { type: "input_audio", input_audio: { data: requireContent(base64), format } } as const;
}

export function chatPDF(filename: string, base64: string) {
  return {
    type: "file",
    file: { filename, file_data: `data:application/pdf;base64,${requireContent(base64)}` },
  } as const;
}

export function embeddingImage(text: string, urlOrDataURL: string) {
  return { content: [{ type: "text", text }, chatImage(urlOrDataURL)] };
}
