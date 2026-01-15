/**
 * Render QR code matrix as string for OpenTUI display
 * Uses Unicode block characters to create a visual QR code
 * 
 * @param matrix - 2D boolean array from generateQRMatrix (true = black, false = white)
 * @param options - Rendering options
 * @returns string - Formatted QR code string for OpenTUI <box> component
 */
export const renderQRForOpenTUI = (
  matrix: boolean[][],
  options?: {
    compact?: boolean; // Use single char blocks (half-height)
    padding?: number;  // Padding modules (default: 1)
  }
): string => {
  if (!matrix || matrix.length === 0) {
    throw new Error("QR matrix cannot be empty");
  }

  const compact = options?.compact ?? false;
  const padding = options?.padding ?? 1;
  const size = matrix.length;
  const lines: string[] = [];

  if (compact) {
    // Compact mode: use upper/lower half blocks to render 2 rows per line
    // This reduces vertical space by 50%
    
    // Add top padding
    for (let i = 0; i < padding; i++) {
      lines.push(" ".repeat(size + padding * 2));
    }

    // Render QR code with vertical compression
    for (let y = 0; y < size; y += 2) {
      let line = " ".repeat(padding); // Left padding
      
      for (let x = 0; x < size; x++) {
        const topModule = matrix[y][x];
        const bottomModule = y + 1 < size ? matrix[y + 1][x] : false;
        
        // Use different block characters based on which modules are filled
        if (topModule && bottomModule) {
          line += "█"; // Full block
        } else if (topModule && !bottomModule) {
          line += "▀"; // Upper half block
        } else if (!topModule && bottomModule) {
          line += "▄"; // Lower half block
        } else {
          line += " "; // Space
        }
      }
      
      line += " ".repeat(padding); // Right padding
      lines.push(line);
    }

    // Add bottom padding
    for (let i = 0; i < padding; i++) {
      lines.push(" ".repeat(size + padding * 2));
    }
  } else {
    // Standard mode: use full blocks (2 chars wide per module)
    
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
  }

  return lines.join("\n");
};
