/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Local dev toggle. Only honored when `import.meta.env.DEV` is true. */
  readonly VITE_DEV_SAMPLE?: string;
  /** Path (served from /public) to the synthetic sample opened on boot. */
  readonly VITE_DEV_SAMPLE_PATH?: string;
}

declare module "mammoth/mammoth.browser" {
  import mammoth = require("mammoth");
  export = mammoth;
}
