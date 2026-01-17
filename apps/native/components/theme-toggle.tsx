import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Platform, Pressable } from "react-native";
import Animated, { FadeOut, ZoomIn, useReducedMotion } from "react-native-reanimated";
import { withUniwind } from "uniwind";

import { useAppTheme } from "@/contexts/app-theme-context";

const StyledIonicons = withUniwind(Ionicons);

export function ThemeToggle() {
  const { toggleTheme, isLight } = useAppTheme();
  const reduceMotion = useReducedMotion();

  return (
    <Pressable
      onPress={() => {
        if (Platform.OS === "ios") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        toggleTheme();
      }}
      className="px-2.5"
      accessibilityLabel={isLight ? "Switch to dark theme" : "Switch to light theme"}
      accessibilityRole="button"
    >
      {isLight ? (
        <Animated.View 
          key="moon" 
          entering={reduceMotion ? undefined : ZoomIn} 
          exiting={reduceMotion ? undefined : FadeOut}
        >
          <StyledIonicons name="moon" size={20} className="text-foreground" />
        </Animated.View>
      ) : (
        <Animated.View 
          key="sun" 
          entering={reduceMotion ? undefined : ZoomIn} 
          exiting={reduceMotion ? undefined : FadeOut}
        >
          <StyledIonicons name="sunny" size={20} className="text-foreground" />
        </Animated.View>
      )}
    </Pressable>
  );
}
