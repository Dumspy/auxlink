/**
 * Check if an error is a TRPC NOT_FOUND error
 * Used to detect when stored deviceId is invalid and needs re-registration
 */
export const isTRPCNotFoundError = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  
  // Check shape property (TRPCClientError has shape.data.code)
  if ("shape" in error && typeof error.shape === "object" && error.shape !== null) {
    const shape = error.shape as any;
    if (shape.data?.code === "NOT_FOUND") {
      return true;
    }
  }
  
  // Check data.code property (common structure)
  if ("data" in error && typeof error.data === "object" && error.data !== null) {
    const data = error.data as any;
    if (data.code === "NOT_FOUND") {
      return true;
    }
  }
  
  // Check code property directly
  if ("code" in error && error.code === "NOT_FOUND") {
    return true;
  }
  
  // Check message for "Device not found" or "NOT_FOUND"
  if ("message" in error && typeof error.message === "string") {
    return error.message.includes("Device not found") || error.message.includes("NOT_FOUND");
  }
  
  return false;
};
