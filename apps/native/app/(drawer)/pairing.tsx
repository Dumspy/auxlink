import { CameraView, Camera, BarcodeScanningResult } from "expo-camera";
import { router } from "expo-router";
import { Button } from "heroui-native";
import { useState, useEffect, useRef } from "react";
import { Text, View, Alert } from "react-native";

import { Container } from "@/components/container";
import { getDeviceId } from "@/lib/device-storage";
import { completePairing, parseQRPayload } from "@/lib/pairing";
import { useAppTheme } from "@/contexts/app-theme-context";

export default function PairingScanner() {
  const { isLight, isDark } = useAppTheme();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const isScanningRef = useRef(false);

  useEffect(() => {
    const getCameraPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    };

    getCameraPermissions();
  }, []);

  const handleBarCodeScanned = async ({ data }: BarcodeScanningResult) => {
    if (scanned || isProcessing || isScanningRef.current) {
      return;
    }

    isScanningRef.current = true;
    setScanned(true);
    setIsProcessing(true);

    try {
      // Parse QR code data
      const qrData = parseQRPayload(data);

      if (!qrData) {
        Alert.alert(
          "Invalid QR Code",
          "This QR code is not valid for pairing. Please scan the QR code from your AuxLink desktop app.",
          [
            {
              text: "Try Again",
              onPress: () => {
                isScanningRef.current = false;
                setScanned(false);
                setIsProcessing(false);
              },
            },
            {
              text: "Cancel",
              style: "cancel",
              onPress: () => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace("/(drawer)" as any);
                }
              },
            },
          ],
        );
        return;
      }

      // Get device ID
      const deviceId = await getDeviceId();
      if (!deviceId) {
        Alert.alert("Error", "Device not registered. Please restart the app.", [
          {
            text: "OK",
            onPress: () => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/(drawer)" as any);
              }
            },
          },
        ]);
        return;
      }

      // Complete pairing
      const result = await completePairing(qrData.sessionId, deviceId);

      // Show success message
      Alert.alert(
        "Pairing Successful!",
        `Connected to ${result.tuiDeviceName}. You can now send messages between devices.`,
        [
          {
            text: "OK",
            onPress: () => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/(drawer)" as any);
              }
            },
          },
        ],
      );
    } catch (error: any) {
      console.error("[pairing] Error:", error);

      let errorMessage = "Failed to complete pairing. Please try again.";

      if (error.message?.includes("expired")) {
        errorMessage =
          "QR code has expired. Please generate a new one on your desktop app.";
      } else if (error.message?.includes("completed")) {
        errorMessage =
          "This QR code has already been used. Please generate a new one.";
      }

      Alert.alert("Pairing Failed", errorMessage, [
        {
          text: "Try Again",
          onPress: () => {
            isScanningRef.current = false;
            setScanned(false);
            setIsProcessing(false);
          },
        },
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(drawer)" as any);
            }
          },
        },
      ]);
    }
  };

  if (hasPermission === null) {
    return (
      <Container edges={["top", "bottom"]} scrollable={false}>
        <View style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 24,
        }}>
          <Text className="text-base text-foreground">
            Requesting camera permission…
          </Text>
        </View>
      </Container>
    );
  }

  if (hasPermission === false) {
    return (
      <Container edges={["top", "bottom"]} scrollable={false}>
        <View style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 24,
        }}>
          <Text className="text-xl font-bold mb-4 text-foreground">
            Camera Access Required
          </Text>
          <Text className="text-base text-muted text-center mb-6">
            Please allow camera access to scan QR codes for device pairing.
          </Text>
          <Button
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/(drawer)" as any);
              }
            }}
            style={{ backgroundColor: "#7C3AED" }}
            accessibilityLabel="Go Back, return to previous screen"
            accessibilityRole="button"
          >
            <Button.Label style={{ color: "#FFFFFF" }}>Go Back</Button.Label>
          </Button>
        </View>
      </Container>
    );
  }

  return (
    <Container edges={["top", "bottom"]} scrollable={false}>
      <View style={{
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 20,
      }}>
        <View style={{
          alignItems: "center",
          marginBottom: 24,
        }}>
          <Text className="text-2xl font-bold mb-2 text-foreground">
            Pair Device
          </Text>
          <Text className="text-base text-muted text-center">
            Scan the QR code from your desktop app
          </Text>
        </View>

        <View style={{
          flex: 1,
          borderRadius: 16,
          overflow: "hidden",
          marginBottom: 24,
        }}>
          <CameraView
            style={{ flex: 1 }}
            barcodeScannerSettings={{
              barcodeTypes: ["qr"],
            }}
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          >
            <View style={{
              flex: 1,
              backgroundColor: isLight ? "rgba(0, 0, 0, 0.3)" : "rgba(0, 0, 0, 0.6)",
              justifyContent: "center",
              alignItems: "center",
            }}>
              <View style={{
                width: 250,
                height: 250,
                borderWidth: 2,
                borderColor: isLight ? "#7C3AED" : "#A78BFA",
                borderRadius: 16,
                backgroundColor: "transparent",
              }} />
            </View>
          </CameraView>
        </View>

        {isProcessing && (
          <View style={{
            alignItems: "center",
            paddingVertical: 20,
          }}>
            <Text className="text-base text-foreground">
              Processing pairing…
            </Text>
          </View>
        )}

        {!isProcessing && (
          <View style={{ alignItems: "center" }}>
            <Text className="text-sm text-muted text-center mb-4">
              Position the QR code within the frame
            </Text>
            <Button
              variant="secondary"
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace("/(drawer)" as any);
                }
              }}
              accessibilityLabel="Cancel, return to previous screen"
              accessibilityRole="button"
            >
              <Button.Label>Cancel</Button.Label>
            </Button>
          </View>
        )}
      </View>
    </Container>
  );
}


