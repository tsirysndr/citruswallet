import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { vars } from "nativewind";

export const palettes = {
  light: {
    canvas: "#f7f3f0",
    surface: "#ffffff",
    ink: "#191916",
    muted: "#696b63",
    edge: "#e4d9d2",
    accent: "#ffb995",
    lilac: "#e3d1fc",
    peach: "#ffd7ab",
    balance: "#191916",
  },
  dark: {
    canvas: "#000000",
    surface: "#171717",
    ink: "#fafafa",
    muted: "#b3b3b3",
    edge: "#363636",
    accent: "#72452f",
    lilac: "#443552",
    peach: "#563b25",
    balance: "#171717",
  },
};
export type Appearance = keyof typeof palettes;
const key = "peachlet-appearance";
const ThemeContext = createContext({
  appearance: "light" as Appearance,
  colors: palettes.light,
  setAppearance: (_value: Appearance): Promise<void> => Promise.resolve(),
});
export const useTheme = () => useContext(ThemeContext);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [appearance, update] = useState<Appearance>("light");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(key)
      .then((value) => {
        if (active && (value === "light" || value === "dark")) update(value);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);
  const setAppearance = async (value: Appearance) => {
    await AsyncStorage.setItem(key, value);
    update(value);
  };
  const colors = palettes[appearance];
  const variables = Object.fromEntries(
    Object.entries(colors).map(([name, hex]) => [
      `--${name}`,
      [1, 3, 5]
        .map((offset) => parseInt(hex.slice(offset, offset + 2), 16))
        .join(" "),
    ]),
  );
  if (!loaded) return null;
  return (
    <ThemeContext.Provider value={{ appearance, colors, setAppearance }}>
      <View
        style={[{ flex: 1, backgroundColor: colors.canvas }, vars(variables)]}
      >
        {children}
      </View>
    </ThemeContext.Provider>
  );
}
