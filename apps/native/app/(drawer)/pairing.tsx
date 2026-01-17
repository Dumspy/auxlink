import { CameraView, Camera, BarcodeScanningResult } from "expo-camera";
import { router } from "expo-router";
import { Button } from "heroui-native";
import { useState, useEffect, useRef } from "react";
import { Text, View, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getDeviceId } from "@/lib/device-storage";
import { completePairing, parseQRPayload } from "@/lib/pairing";

export default function PairingScanner() {
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
        ]
      );
        return;
      }

      // Get device ID
      const deviceId = await getDeviceId();
      if (!deviceId) {
      Alert.alert(
        "Error",
        "Device not registered. Please restart the app.",
        [{ text: "OK", onPress: () => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace("/(drawer)" as any);
          }
        }}]
      );
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
        ]
      );
    } catch (error: any) {
      console.error("[pairing] Error:", error);
      
      let errorMessage = "Failed to complete pairing. Please try again.";
      
      if (error.message?.includes("expired")) {
        errorMessage = "QR code has expired. Please generate a new one on your desktop app.";
      } else if (error.message?.includes("completed")) {
        errorMessage = "This QR code has already been used. Please generate a new one.";
      }

      Alert.alert(
        "Pairing Failed",
        errorMessage,
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
        ]
      );
    }
  };

  if (hasPermission === null) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text className="text-base text-foreground">Requesting camera permission...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (hasPermission === false) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text className="text-xl font-bold mb-4 text-foreground">Camera Access Required</Text>
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
          >
            <Button.Label style={{ color: "#FFFFFF" }}>Go Back</Button.Label>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text className="text-2xl font-bold mb-2 text-foreground">Pair Device</Text>
          <Text className="text-base text-muted text-center">
            Scan the QR code from your desktop app
          </Text>
        </View>

        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            barcodeScannerSettings={{
              barcodeTypes: ["qr"],
            }}
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          >
            <View style={styles.overlay}>
              <View style={styles.scanArea} />
            </View>
          </CameraView>
        </View>

        {isProcessing && (
          <View style={styles.processingContainer}>
            <Text className="text-base text-foreground">Processing pairing...</Text>
          </View>
        )}

        {!isProcessing && (
          <View style={styles.footer}>
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
            >
              <Button.Label>Cancel</Button.Label>
            </Button>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  cameraContainer: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 24,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  scanArea: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: "#7C3AED",
    borderRadius: 16,
    backgroundColor: "transparent",
  },
  processingContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  footer: {
    alignItems: "center",
  },
});
