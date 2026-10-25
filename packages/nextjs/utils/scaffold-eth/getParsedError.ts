import { BaseError as BaseViemError, ContractFunctionRevertedError, decodeErrorResult } from "viem";

const getRevertReason = (value: unknown, visited = new Set<unknown>()): string | undefined => {
  if (!value || typeof value !== "object" || visited.has(value)) return;
  visited.add(value);
  const entry = value as Record<string, unknown>;
  if (typeof entry.data === "string" && /^0x(?:08c379a0|4e487b71)/i.test(entry.data)) {
    try {
      const decoded = decodeErrorResult({ abi: [], data: entry.data as `0x${string}` });
      return decoded.errorName === "Error" ? String(decoded.args?.[0]) : `Panic(${String(decoded.args?.[0])})`;
    } catch {
      // Invalid revert data must not hide the original RPC error.
    }
  }
  if (value instanceof ContractFunctionRevertedError && value.reason) return value.reason;
  for (const key of ["cause", "data", "error", "originalError"]) {
    const reason = getRevertReason(entry[key], visited);
    if (reason) return reason;
  }
};

/**
 * Parses an viem/wagmi error to get a displayable string
 * @param e - error object
 * @returns parsed error string
 */
export const getParsedError = (error: any): string => {
  const reason = getRevertReason(error);
  if (reason) return `Contract function execution reverted: ${reason}`;
  const parsedError = error?.walk ? error.walk() : error;

  if (parsedError instanceof BaseViemError) {
    if (parsedError.details) {
      return parsedError.details;
    }

    if (parsedError.shortMessage) {
      if (
        parsedError instanceof ContractFunctionRevertedError &&
        parsedError.data &&
        parsedError.data.errorName !== "Error"
      ) {
        const customErrorArgs = parsedError.data.args?.toString() ?? "";
        return `${parsedError.shortMessage.replace(/reverted\.$/, "reverted with the following reason:")}\n${
          parsedError.data.errorName
        }(${customErrorArgs})`;
      }

      return parsedError.shortMessage;
    }

    return parsedError.message ?? parsedError.name ?? "An unknown error occurred";
  }

  return parsedError?.message ?? "An unknown error occurred";
};
