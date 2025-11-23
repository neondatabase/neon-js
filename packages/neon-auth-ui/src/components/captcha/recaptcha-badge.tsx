import { useContext } from "react"
import { useIsHydrated } from "../../hooks/use-hydrated"
import { AuthUIContext } from "../../lib/auth-ui-provider"
import { cn } from "../../lib/utils"
import type { AuthLocalization } from "../../localization/auth-localization"

export interface RecaptchaBadgeProps {
    className?: string
    localization?: Partial<AuthLocalization>
}

export function RecaptchaBadge({
    className,
    localization: propLocalization
}: RecaptchaBadgeProps) {
    const isHydrated = useIsHydrated()
    const { captcha, localization: contextLocalization } =
        useContext(AuthUIContext)
    const localization = { ...contextLocalization, ...propLocalization }

    if (!captcha) return null

    if (!captcha.hideBadge) {
        return isHydrated ? (
            <style>{`
                .grecaptcha-badge { visibility: visible !important; }
            `}</style>
        ) : null
    }

    return (
        <>
            <style>{`
                .grecaptcha-badge { visibility: hidden; }
            `}</style>

            <p className={cn("text-muted-foreground text-xs", className)}>
                {localization.PROTECTED_BY_RECAPTCHA}{" "}
                {localization.BY_CONTINUING_YOU_AGREE} Google{" "}
                <a
                    className="text-foreground hover:underline"
                    href="https://policies.google.com/privacy"
                    target="_blank"
                    rel="noreferrer"
                >
                    {localization.PRIVACY_POLICY}
                </a>{" "}
                &{" "}
                <a
                    className="text-foreground hover:underline"
                    href="https://policies.google.com/terms"
                    target="_blank"
                    rel="noreferrer"
                >
                    {localization.TERMS_OF_SERVICE}
                </a>
                .
            </p>
        </>
    )
}
