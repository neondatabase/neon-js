import {
    GoogleReCaptchaProvider,
    useGoogleReCaptcha
} from "@wojtekmaj/react-recaptcha-v3"
import { type ReactNode, useContext, useEffect } from "react"

import { useIsHydrated } from "../../hooks/use-hydrated"
import { useLang } from "../../hooks/use-lang"
import { useTheme } from "../../hooks/use-theme"
import { AuthUIContext } from "../../lib/auth-ui-provider"

export function RecaptchaV3({ children }: { children: ReactNode }) {
    const isHydrated = useIsHydrated()
    const { captcha } = useContext(AuthUIContext)

    if (captcha?.provider !== "google-recaptcha-v3") return children

    return (
        <GoogleReCaptchaProvider
            reCaptchaKey={captcha.siteKey}
            useEnterprise={captcha.enterprise}
            useRecaptchaNet={captcha.recaptchaNet}
        >
            {isHydrated && (
                <style>{`
                    .grecaptcha-badge {
                        visibility: hidden;
                        border-radius: var(--radius) !important;
                        --tw-shadow: 0 1px 2px 0 var(--tw-shadow-color, #0000000d);
                        box-shadow: var(--tw-inset-shadow), var(--tw-inset-ring-shadow), var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow) !important;
                        border-style: var(--tw-border-style) !important;
                        border-width: 1px;
                    }

                    .dark .grecaptcha-badge {
                        border-color: var(--input) !important;
                    }
                `}</style>
            )}

            <RecaptchaV3Style />

            {children}
        </GoogleReCaptchaProvider>
    )
}

function RecaptchaV3Style() {
    const { executeRecaptcha } = useGoogleReCaptcha()
    const { theme } = useTheme()
    const { lang } = useLang()

    useEffect(() => {
        if (!executeRecaptcha) return

        const updateRecaptcha = async () => {
            // find iframe with title "reCAPTCHA"
            const iframe = document.querySelector(
                "iframe[title='reCAPTCHA']"
            ) as HTMLIFrameElement
            if (iframe) {
                const iframeSrcUrl = new URL(iframe.src)
                iframeSrcUrl.searchParams.set("theme", theme)
                if (lang) iframeSrcUrl.searchParams.set("hl", lang)
                iframe.src = iframeSrcUrl.toString()
            }
        }

        updateRecaptcha()
    }, [executeRecaptcha, theme, lang])

    return null
}
