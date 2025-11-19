"use client"

import { KeyRoundIcon } from "lucide-react"
import { useContext, useState } from "react"

import { useLang } from "../../../hooks/use-lang"
import { AuthUIContext } from "../../../lib/auth-ui-provider"
import { cn } from "../../../lib/utils"
import type { AuthLocalization } from "../../../localization/auth-localization"
import type { ApiKey } from "../../../types/api-key"
import type { Refetch } from "../../../types/refetch"
import { Button } from "../../ui/button"
import { Card } from "../../ui/card"
import type { SettingsCardClassNames } from "../shared/settings-card"
import { ApiKeyDeleteDialog } from "./api-key-delete-dialog"

export interface ApiKeyCellProps {
    className?: string
    classNames?: SettingsCardClassNames
    apiKey: ApiKey
    localization?: Partial<AuthLocalization>
    refetch?: Refetch
}

export function ApiKeyCell({
    className,
    classNames,
    apiKey,
    localization,
    refetch
}: ApiKeyCellProps) {
    const { localization: contextLocalization } = useContext(AuthUIContext)
    localization = { ...contextLocalization, ...localization }

    const { lang } = useLang()

    const [showDeleteDialog, setShowDeleteDialog] = useState(false)

    // Format expiration date or show "Never expires"
    const formatExpiration = () => {
        if (!apiKey.expiresAt) return localization.NEVER_EXPIRES

        const expiresDate = new Date(apiKey.expiresAt)
        return `${localization.EXPIRES} ${expiresDate.toLocaleDateString(
            lang ?? "en",
            {
                month: "short",
                day: "numeric",
                year: "numeric"
            }
        )}`
    }

    return (
        <>
            <Card
                className={cn(
                    "flex-row items-center gap-3 truncate px-4 py-3",
                    className,
                    classNames?.cell
                )}
            >
                <KeyRoundIcon
                    className={cn("size-4 flex-shrink-0", classNames?.icon)}
                />

                <div className="flex flex-col truncate">
                    <div className="flex items-center gap-2">
                        <span className="truncate font-semibold text-sm">
                            {apiKey.name}
                        </span>

                        <span className="flex-1 truncate text-muted-foreground text-sm">
                            {apiKey.start}
                            {"******"}
                        </span>
                    </div>

                    <div className="truncate text-muted-foreground text-xs">
                        {formatExpiration()}
                    </div>
                </div>

                <Button
                    className={cn(
                        "relative ms-auto",
                        classNames?.button,
                        classNames?.outlineButton
                    )}
                    size="sm"
                    variant="outline"
                    onClick={() => setShowDeleteDialog(true)}
                >
                    {localization.DELETE}
                </Button>
            </Card>

            <ApiKeyDeleteDialog
                classNames={classNames}
                apiKey={apiKey}
                localization={localization}
                open={showDeleteDialog}
                onOpenChange={setShowDeleteDialog}
                refetch={refetch}
            />
        </>
    )
}
