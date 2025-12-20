/// <reference types="vite/client" />

declare module '*.png' {
  const value: string;
  export default value;
}
declare module '*.svg' {
  const value: string;
  export default value;
}
declare module '*.jpeg' {
  const value: string;
  export default value;
}
declare module '*.gif' {
  const value: string;
  export default value;
}
declare module '*.jpg' {
  const value: string;
  export default value;
}
declare module '*.JPG' {
  const value: string;
  export default value;
}

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_PUBLIC_AGENT_USERNAME?: string;
  readonly VITE_PUBLIC_AGENT_PASSWORD?: string;
  // add other VITE_ env vars here...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}