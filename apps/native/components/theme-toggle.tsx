import React from "react";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Platform, Pressable, PressableStateCallbackType } from "react-native";
import Animated, { FadeOut, ZoomIn, useReducedMotion } from "react-native-reanimated";
import { withUniwind } from "uniwind";

import { useAppTheme } from "@/contexts/app-theme-context";

const StyledIonicons = withUniwind(Ionicons);

export function ThemeToggle() {
  const { toggleTheme, isLight } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const [focused, setFocused] = React.useState(false);

  const focusStyle = ({ pressed }: PressableStateCallbackType) => ({
    opacity: pressed ? 0.7 : focused ? 0.8 : 1,
    backgroundColor: focused ? (isLight ? "#00000020" : "#FFFFFF20") : "transparent",
    borderRadius: 8,
  });

  return (
    <Pressable
      onPress={() => {
        if (Platform.OS === "ios") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        toggleTheme();
      }}
      className="px-2.5"
      style={focusStyle}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
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
