// Font files bundled as Data modules (wrangler.toml [[rules]]): an ArrayBuffer.
declare module "*.ttf" {
  const data: ArrayBuffer;
  export default data;
}
