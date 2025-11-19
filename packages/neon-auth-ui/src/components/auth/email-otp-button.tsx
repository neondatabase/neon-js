import { LockIcon, MailIcon } from "lucide-react"
import { useContext } from "react"

import { AuthUIContext } from "../../lib/auth-ui-provider"
import { cn } from "../../lib/utils"
import type { AuthViewPath } from "../../lib/view-paths"
import type { AuthLocalization } from "../../localization/auth-localization"
import { Button } from "../ui/button"
import type { AuthViewClassNames } from "./auth-view"

interface EmailOTPButtonProps {
    classNames?: AuthViewClassNames
    isSubmitting?: boolean
    localization: Partial<AuthLocalization>
    view: AuthViewPath
}

export function EmailOTPButton({
    classNames,
    isSubmitting,
    localization,
    view
}: EmailOTPButtonProps) {
    const { viewPaths, navigate, basePath } = useContext(AuthUIContext)

    return (
        <Button
            className={cn(
                "w-full",
                classNames?.form?.button,
                classNames?.form?.secondaryButton
            )}
            disabled={isSubmitting}
            type="button"
            variant="secondary"
            onClick={() =>
                navigate(
                    `${basePath}/${view === "EMAIL_OTP" ? viewPaths.SIGN_IN : viewPaths.EMAIL_OTP}${globalThis.location.search}`
                )
            }
        >
            {view === "EMAIL_OTP" ? (
                <LockIcon className={classNames?.form?.icon} />
            ) : (
                <MailIcon className={classNames?.form?.icon} />
            )}
            {localization.SIGN_IN_WITH}{" "}
            {view === "EMAIL_OTP"
                ? localization.PASSWORD
                : localization.EMAIL_OTP}
        </Button>
    )
}
