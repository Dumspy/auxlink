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
    padding?: number; // Padding modules (default: 1)
    inverted?: boolean; // Invert colors (default: false)
    border?: boolean; // Add border (default: false)
  },
): string => {
  if (!matrix || matrix.length === 0) {
    throw new Error("QR matrix cannot be empty");
  }

  const compact = options?.compact ?? false;
  const padding = options?.padding ?? 1;
  const inverted = options?.inverted ?? false;
  const border = options?.border ?? false;
  const size = matrix.length;
  const lines: string[] = [];

  if (compact) {
    // Compact mode: use upper/lower half blocks to render 2 rows per line
    // This reduces vertical space by 50%

    // Add top padding (skip if inverted with border to move border closer)
    const topPadding = inverted && border ? 0 : padding;
    for (let i = 0; i < topPadding; i++) {
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
          line += inverted ? " " : "█"; // Full block (inverted: space)
        } else if (topModule && !bottomModule) {
          line += inverted ? "▄" : "▀"; // Upper half block (inverted: lower half block)
        } else if (!topModule && bottomModule) {
          line += inverted ? "▀" : "▄"; // Lower half block (inverted: upper half block)
        } else {
          line += inverted ? "█" : " "; // Space (inverted: full block)
        }
      }

      line += " ".repeat(padding); // Right padding
      lines.push(line);
    }

    // Add bottom padding (skip if inverted with border to move border closer)
    const bottomPadding = inverted && border ? 0 : padding;
    for (let i = 0; i < bottomPadding; i++) {
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
        // Use full block for black modules, space for white (inverted if enabled)
        line += matrix[y][x]
          ? inverted
            ? "  "
            : "██"
          : inverted
            ? "██"
            : "  ";
      }

      line += "  ".repeat(padding); // Right padding
      lines.push(line);
    }

    // Add bottom padding
    for (let i = 0; i < padding; i++) {
      lines.push("  ".repeat(size + padding * 2));
    }
  }

  // Add border if enabled (only when inverted)
  if (border && inverted) {
    const borderedLines: string[] = [];

    // Process content first to determine bordered width
    const processedLines: string[] = [];
    for (const line of lines) {
      const innerLine = line.slice(1, -1); // Remove original border
      const borderedLine = `█${innerLine}█`;
      processedLines.push(borderedLine);
    }

    // Create top and bottom borders with different blocks
    const innerWidth = processedLines[0]?.length - 2 || 0; // -2 to exclude side borders
    const topBorderLine = `▄${"▄".repeat(innerWidth)}▄`; // Lower half blocks for bottom

    // Assemble final result
    borderedLines.push(topBorderLine);
    borderedLines.push(...processedLines);

    return borderedLines.join("\n");
  }

  return lines.join("\n");
};
