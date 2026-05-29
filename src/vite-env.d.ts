/// <reference types="vite/client" />

// CSS modules
declare module '*.css' {
  const styles: Record<string, string>;
  export default styles;
}
