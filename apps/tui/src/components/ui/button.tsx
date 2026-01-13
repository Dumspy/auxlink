import type { ReactNode } from "react";

interface ButtonProps {
  label: string;
  focused?: boolean;
  onSubmit: () => void | Promise<void>;
  variant?: "primary" | "secondary" | "danger";
  icon?: string;
  fullWidth?: boolean;
}

/**
 * Button component for TUI
 * Uses input element for focus handling and enter key submission
 */
export function Button({
  label,
  focused = false,
  onSubmit,
  variant = "primary",
  icon,
  fullWidth = false,
}: ButtonProps) {
  // Color scheme based on variant
  const getBorderColor = () => {
    if (!focused) return "#888888";
    
    switch (variant) {
      case "primary":
        return "#7C3AED"; // Purple (auxlink primary)
      case "secondary":
        return "#2563EB"; // Blue
      case "danger":
        return "#EF4444"; // Red
      default:
        return "#00FF00";
    }
  };

  const displayLabel = icon ? `${icon} ${label}` : label;

  return (
    <box
      title={displayLabel}
      style={{
        border: true,
        borderColor: getBorderColor(),
        padding: 1,
        height: 3,
        flexGrow: fullWidth ? 1 : undefined,
      }}
    >
      <input
        value=""
        placeholder="Press Enter"
        focused={focused}
        onInput={() => {}}
        onSubmit={onSubmit}
      />
    </box>
  );
}

interface IconTextProps {
  icon: string;
  children: ReactNode;
  color?: string;
}

/**
 * Text with icon prefix for TUI
 */
export function IconText({ icon, children, color = "#FFFFFF" }: IconTextProps) {
  return (
    <box style={{ flexDirection: "row", gap: 1 }}>
      <text fg={color}>{icon}</text>
      <text fg={color}>{children}</text>
    </box>
  );
}
