import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Image, Linking, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../Typography";
const apps = [
  { name: "Bluesky", source: require("../../../assets/atmosphere-icons/atmo-bluesky.jpg") },
  { name: "Tangled", source: require("../../../assets/atmosphere-icons/atmo-tangled.jpg") },
  { name: "Anisota", source: require("../../../assets/atmosphere-icons/atmo-anisota.jpg") },
  { name: "Beacon Bits", source: require("../../../assets/atmosphere-icons/atmo-beacon-bits.jpg") },
  { name: "Eurosky", source: require("../../../assets/atmosphere-icons/atmo-eurosky.jpg") },
  { name: "Flashes", source: require("../../../assets/atmosphere-icons/atmo-flashes.jpg") },
  { name: "Gander", source: require("../../../assets/atmosphere-icons/atmo-gander.jpg") },
  { name: "Germ", source: require("../../../assets/atmosphere-icons/atmo-germ.jpg") },
  { name: "Leaflet", source: require("../../../assets/atmosphere-icons/atmo-leaflet.jpg") },
  { name: "Northsky", source: require("../../../assets/atmosphere-icons/atmo-northsky.jpg") },
  { name: "Offprint", source: require("../../../assets/atmosphere-icons/atmo-offprint.jpg") },
  { name: "Pckt", source: require("../../../assets/atmosphere-icons/atmo-pckt.jpg") },
  { name: "Plyr", source: require("../../../assets/atmosphere-icons/atmo-plyr.jpg") },
  { name: "Popfeed", source: require("../../../assets/atmosphere-icons/atmo-popfeed.jpg") },
  { name: "Blento", source: require("../../../assets/atmosphere-icons/atmo-blento.jpg") },
  { name: "Semble", source: require("../../../assets/atmosphere-icons/atmo-semble.jpg") },
  { name: "Skylight", source: require("../../../assets/atmosphere-icons/atmo-skylight.jpg") },
  { name: "Blacksky", source: require("../../../assets/atmosphere-icons/atmo-blacksky.jpg") },
  { name: "Spark", source: require("../../../assets/atmosphere-icons/atmo-spark.png") },
  { name: "Streamplace", source: require("../../../assets/atmosphere-icons/atmo-stream-place.jpg") },
];
const width = apps.length * 52;
export function AtmosphereApps() {
  const offset = useRef(new Animated.Value(0)).current;
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); });
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { mounted = false; listener.remove(); };
  }, []);
  useEffect(() => {
    if (paused || reduceMotion) return;
    const animation = Animated.loop(Animated.timing(offset, {
      toValue: -width, duration: 42000, easing: Easing.linear, useNativeDriver: true, isInteraction: false,
    }));
    animation.start();
    return () => { animation.stop(); offset.setValue(0); };
  }, [paused, reduceMotion, offset]);
  return <View className="gap-3">
    <View accessible accessibilityRole="image" accessibilityLabel={`Apps in the Atmosphere: ${apps.map(app => app.name).join(", ")}`}
      style={{ overflow: "hidden", height: 40 }}>
      <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
        style={{ flexDirection: "row", width: width * 2, transform: [{ translateX: offset }] }}>
        {[0, 1].map(copy => apps.map(app => <Image key={`${copy}-${app.name}`} source={app.source}
          style={{ width: 40, height: 40, borderRadius: 10, marginRight: 12 }} />))}
      </Animated.View>
    </View>
    <View className="flex-row items-center gap-2">
      <Text accessibilityRole="link" onPress={() => void Linking.openURL("https://atmosphereaccount.com")}
        className="flex-1 text-sm text-muted underline">What is an atmosphere account?</Text>
      {!reduceMotion && <Pressable accessibilityRole="button" accessibilityLabel={paused ? "Play app animation" : "Pause app animation"}
        onPress={() => setPaused(!paused)} hitSlop={8} style={{ padding: 8 }}>
        <Ionicons name={paused ? "play-outline" : "pause-outline"} size={18} color="#696b63" />
      </Pressable>}
    </View>
  </View>;
}
