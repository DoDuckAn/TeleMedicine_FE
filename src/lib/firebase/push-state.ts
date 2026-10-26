export class PushSuppressedError extends Error {
  constructor() {
    super("Push is disabled on this browser.");
    this.name = "PushSuppressedError";
  }
}

export function pushRestoreFailure(error: unknown) {
  return error instanceof PushSuppressedError
    ? { status: "idle" as const, message: null }
    : {
        status: "error" as const,
        message: "Chưa bật được thông báo trên trình duyệt này.",
      };
}

export function pushDisableFailure(localCleanupComplete: boolean) {
  return {
    status: "error" as const,
    message: localCleanupComplete
      ? "Thông báo trên trình duyệt đã tắt, nhưng chưa đồng bộ được cài đặt."
      : "Chưa thể xác nhận đã tắt thông báo. Vui lòng thử lại.",
  };
}
