/// <reference types="vite/client" />
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