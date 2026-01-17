import { cn, useThemeColor } from "heroui-native";
import { type PropsWithChildren } from "react";
import { ScrollView, View, type ViewProps } from "react-native";
import Animated, { type AnimatedProps } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const AnimatedView = Animated.createAnimatedComponent(View);

type Props = AnimatedProps<ViewProps> & {
  className?: string;
  scrollable?: boolean;
  edges?: ("top" | "bottom" | "left" | "right")[];
};

export function Container({
  children,
  className,
  scrollable = true,
  edges = ["bottom"],
  ...props
}: PropsWithChildren<Props>) {
  const insets = useSafeAreaInsets();
  const themeColorBackground = useThemeColor("background");

  const content = scrollable ? (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>{children}</ScrollView>
  ) : (
    children
  );

  return (
    <AnimatedView
      className={cn("flex-1", className)}
      style={[
        {
          paddingTop: edges.includes("top") ? insets.top : 0,
          paddingBottom: edges.includes("bottom") ? insets.bottom : 0,
          paddingLeft: edges.includes("left") ? insets.left : 0,
          paddingRight: edges.includes("right") ? insets.right : 0,
          backgroundColor: themeColorBackground,
        },
        props.style,
      ]}
      {...props}
    >
      {content}
    </AnimatedView>
  );
}

