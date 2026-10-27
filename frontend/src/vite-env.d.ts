/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" activa la API simulada con MSW (ver .env.development). */
  readonly VITE_API_SIMULADA?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
