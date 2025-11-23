import type { CaptchaProvider } from "./captcha-provider"

export type CaptchaOptions = {
    /**
     * Captcha site key
     */
    siteKey: string
    /**
     * Captcha provider type
     */
    provider: CaptchaProvider
    /**
     * Hide the captcha badge
     * @default false
     */
    hideBadge?: boolean
    /**
     * Use recaptcha.net domain instead of google.com
     * @default false
     */
    recaptchaNet?: boolean
    /**
     * Enable enterprise mode for Google reCAPTCHA
     * @default false
     */
    enterprise?: boolean
    /**
     * Overrides the default array of paths where captcha validation is enforced
     * @default ["/sign-up/email", "/sign-in/email", "/forget-password"]
     */
    endpoints?: string[]
}
