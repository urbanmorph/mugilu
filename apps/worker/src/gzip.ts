/** Gzip a text body for an R2 archive (stored with contentEncoding: "gzip"). */
export const gzip = (text: string): Promise<ArrayBuffer> =>
  new Response(new Response(text).body!.pipeThrough(new CompressionStream("gzip"))).arrayBuffer();
