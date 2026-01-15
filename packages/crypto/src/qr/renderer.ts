/**
 * Render QR code matrix as string for OpenTUI display
 * Uses Unicode block characters to create a visual QR code
 * 
 * @param matrix - 2D boolean array from generateQRMatrix (true = black, false = white)
 * @returns string - Formatted QR code string for OpenTUI <box> component
 */
export const renderQRForOpenTUI = (matrix: boolean[][]): string => {
  if (!matrix || matrix.length === 0) {
    throw new Error("QR matrix cannot be empty");
  }

  const size = matrix.length;
  const padding = 2; // 2-module padding border
  const lines: string[] = [];

  // Add top padding
  for (let i = 0; i < padding; i++) {
    lines.push("  ".repeat(size + padding * 2));
  }

  // Render QR code with side padding
  for (let y = 0; y < size; y++) {
    let line = "  ".repeat(padding); // Left padding
    
    for (let x = 0; x < size; x++) {
      // Use full block for black modules, space for white
      line += matrix[y][x] ? "██" : "  ";
    }
    
    line += "  ".repeat(padding); // Right padding
    lines.push(line);
  }

  // Add bottom padding
  for (let i = 0; i < padding; i++) {
    lines.push("  ".repeat(size + padding * 2));
  }

  return lines.join("\n");
};
