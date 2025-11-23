// These error codes are returned by the API
const EXTERNAL_ERROR_CODES = {
    VERIFICATION_FAILED: "Captcha verification failed",
    MISSING_RESPONSE: "Missing CAPTCHA response",
    UNKNOWN_ERROR: "Something went wrong"
}

// These error codes are only visible in the server logs
const INTERNAL_ERROR_CODES = {
    MISSING_SECRET_KEY: "Missing secret key",
    SERVICE_UNAVAILABLE: "CAPTCHA service unavailable"
}

export const CAPTCHA_ERROR_CODES = {
    ...EXTERNAL_ERROR_CODES,
    ...INTERNAL_ERROR_CODES
}
