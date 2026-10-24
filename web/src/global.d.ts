type Theme = "light" | "dark";

interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<any>;
  isMetaMask?: boolean;
  providers?: Eip1193Provider[];
}

interface Window {
  ethereum?: Eip1193Provider;
  peachletTheme: {
    current(): Theme;
    set(theme: Theme): void;
    subscribe(listener: () => void): () => void;
  };
}
