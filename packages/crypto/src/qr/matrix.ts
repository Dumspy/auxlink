import * as QRCode from "qrcode";

/**
 * Generate QR code matrix (2D boolean array)
 * 
 * @param data - String data to encode in QR code
 * @returns Promise<boolean[][]> - 2D array where true = black, false = white
 */
export const generateQRMatrix = async (data: string): Promise<boolean[][]> => {
  try {
    if (!data) {
      throw new Error("Data cannot be empty");
    }

    // Generate QR code with error correction level M (Medium)
    const qrData = await QRCode.create(data, {
      errorCorrectionLevel: "M",
    });

    const modules = qrData.modules;
    const size = modules.size;
    const matrix: boolean[][] = [];

    // Convert QR code modules to 2D boolean array
    for (let y = 0; y < size; y++) {
      const row: boolean[] = [];
      for (let x = 0; x < size; x++) {
        row.push(modules.get(x, y) === 1);
      }
      matrix.push(row);
    }

    return matrix;
  } catch (error) {
    throw new Error(`Failed to generate QR matrix: ${error instanceof Error ? error.message : String(error)}`);
  }
};
