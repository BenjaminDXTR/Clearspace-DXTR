interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_DEBUG?: string;
  readonly VITE_MAX_HISTORY_LENGTH?: string;
  readonly VITE_ICON_URL_DRONE_LIVE?: string;
  readonly VITE_ICON_URL_DRONE_START?: string;
  readonly VITE_ICON_SIZE_DEFAULT?: string;
  readonly VITE_ICON_SIZE_HISTORY?: string;
  readonly MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
