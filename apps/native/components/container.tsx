import { cn } from "heroui-native";
import { type PropsWithChildren } from "react";
import { ScrollView, View, type ViewProps } from "react-native";
import Animated, { type AnimatedProps } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const AnimatedView = Animated.createAnimatedComponent(View);

type Props = AnimatedProps<ViewProps> & {
  className?: string;
  scrollable?: boolean;
};

export function Container({ children, className, scrollable = true, ...props }: PropsWithChildren<Props>) {
  const insets = useSafeAreaInsets();

  const content = scrollable ? (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>{children}</ScrollView>
  ) : (
    children
  );

  return (
    <AnimatedView
      className={cn("flex-1 bg-background", className)}
      style={{
        paddingBottom: insets.bottom,
      }}
      {...props}
    >
      {content}
    </AnimatedView>
  );
}

