export function generateDeviceName(
  userAgent: string,
  deviceType: "mobile" | "tui"
): string {
  if (deviceType === "tui") {
    // Extract OS from system
    const os = process.platform;
    const osMap: Record<string, string> = {
      darwin: "macOS",
      linux: "Linux",
      win32: "Windows",
    };
    return `${osMap[os] || "Unknown"} Desktop`;
  }

  // Parse mobile user agent
  // Example: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X)"
  if (userAgent.includes("iPhone")) {
    const match = userAgent.match(/iPhone OS ([\d_]+)/);
    const version = match?.[1]?.replace(/_/g, ".") || "";
    return `iPhone (iOS ${version})`;
  }

  if (userAgent.includes("iPad")) {
    const match = userAgent.match(/CPU OS ([\d_]+)/);
    const version = match?.[1]?.replace(/_/g, ".") || "";
    return `iPad (iPadOS ${version})`;
  }

  if (userAgent.includes("Android")) {
    const match = userAgent.match(/Android ([\d.]+)/);
    const version = match?.[1] || "";
    return `Android (${version})`;
  }

  return `${deviceType === "mobile" ? "Mobile" : "Desktop"} Device`;
}
