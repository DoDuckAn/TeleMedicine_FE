import { ApiError } from "./client";
import { UserFacingError } from "../user-facing-error";

const firebaseMessages: Record<string, string> = {
  "auth/invalid-phone-number": "Số điện thoại không hợp lệ.",
  "auth/invalid-verification-code": "Mã OTP không đúng. Vui lòng kiểm tra lại.",
  "auth/code-expired": "Mã OTP đã hết hạn. Vui lòng gửi lại mã.",
  "auth/session-expired": "Phiên xác thực đã hết hạn. Vui lòng gửi lại OTP.",
  "auth/too-many-requests":
    "Bạn đã thử quá nhiều lần. Vui lòng chờ rồi thử lại.",
  "auth/network-request-failed":
    "Không kết nối được dịch vụ xác thực. Vui lòng kiểm tra mạng.",
  "auth/captcha-check-failed":
    "Xác minh bảo mật chưa thành công. Vui lòng thử lại.",
  "auth/user-disabled": "Tài khoản đã bị khóa.",
  "auth/quota-exceeded":
    "Dịch vụ gửi OTP đã hết hạn mức. Vui lòng thử lại sau.",
};

const sessionCodes = new Set([
  "INVALID_REFRESH_TOKEN",
  "REFRESH_TOKEN_EXPIRED",
  "TOKEN_REVOKED",
  "UNAUTHORIZED",
]);
const hiddenCodes = new Set([
  "INTERNAL_SERVER_ERROR",
  "HTTP_ERROR",
  "INVALID_RESPONSE",
]);
const publicServiceCodes = new Set([
  "GOOGLE_MEET_CREATE_FAILED",
  "GOOGLE_MEET_CLOSE_FAILED",
  "GOOGLE_MEET_NOT_CONFIGURED",
  "AVATAR_UPLOAD_FAILED",
  "EMAIL_SEND_FAILED",
  "MENU_NOT_INITIALIZED",
  "INVALID_SERVER_RESPONSE",
  "REFRESH_FAILED",
]);

/** Only expose API errors intended for users, never arbitrary runtime error text. */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof UserFacingError) return error.message;
  if (error instanceof ApiError) {
    if (sessionCodes.has(error.code))
      return "Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.";
    if (hiddenCodes.has(error.code)) return fallback;
    if (error.status >= 500 && !publicServiceCodes.has(error.code))
      return fallback;
    if (error.code === "VALIDATION_ERROR" && Array.isArray(error.details)) {
      const labels: Record<string, string> = {
        code: "Mã chuyên khoa",
        name: "Tên",
        email: "Email",
        phone: "Số điện thoại",
        password: "Mật khẩu",
        currentPassword: "Mật khẩu hiện tại",
        newPassword: "Mật khẩu mới",
        fullName: "Họ tên",
        description: "Mô tả",
        bio: "Giới thiệu",
        qualifications: "Bằng cấp",
        startAt: "Thời gian bắt đầu",
        endAt: "Thời gian kết thúc",
        reason: "Lý do",
        visitReason: "Lý do khám",
        otp: "Mã OTP",
        specialtyIds: "Chuyên khoa",
      };
      for (const issue of error.details) {
        if (!issue || typeof issue !== "object" || !Array.isArray(issue.path))
          continue;
        const label = labels[String(issue.path[0])];
        if (!label) continue;
        if (issue.code === "too_small" && typeof issue.minimum === "number")
          return `${label} phải có ít nhất ${issue.minimum} ${issue.origin === "array" ? "mục" : "ký tự"}.`;
        if (issue.code === "too_big" && typeof issue.maximum === "number")
          return `${label} không được vượt quá ${issue.maximum} ${issue.origin === "array" ? "mục" : "ký tự"}.`;
        if (issue.path[0] === "code")
          return "Mã chuyên khoa chỉ gồm chữ A-Z, số, dấu gạch ngang hoặc gạch dưới.";
        return `${label} không hợp lệ. Vui lòng kiểm tra lại.`;
      }
    }
    return error.message.trim() || fallback;
  }
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
  )
    return firebaseMessages[error.code] ?? fallback;
  return fallback;
}
