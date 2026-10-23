import { Text } from "../Typography";
export function Empty({ text }: { text: string }) {
  return <Text className="py-8 text-center text-base text-muted">{text}</Text>;
}
