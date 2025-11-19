"use client"

import { CheckIcon, CopyIcon } from "lucide-react"
import { type ComponentProps, useContext, useState } from "react"

import { AuthUIContext } from "../../../lib/auth-ui-provider"
import { cn } from "../../../lib/utils"
import type { AuthLocalization } from "../../../localization/auth-localization"
import { Button } from "../../ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "../../ui/dialog"
import type { SettingsCardClassNames } from "../shared/settings-card"

interface ApiKeyDisplayDialogProps extends ComponentProps<typeof Dialog> {
    classNames?: SettingsCardClassNames
    localization?: AuthLocalization
    apiKey: string
}

export function ApiKeyDisplayDialog({
    classNames,
    apiKey,
    localization,
    onOpenChange,
    ...props
}: ApiKeyDisplayDialogProps) {
    const { localization: contextLocalization } = useContext(AuthUIContext)
    localization = { ...contextLocalization, ...localization }

    const [copied, setCopied] = useState(false)

    const handleCopy = () => {
        navigator.clipboard.writeText(apiKey)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <Dialog onOpenChange={onOpenChange} {...props}>
            <DialogContent
                onOpenAutoFocus={(e) => e.preventDefault()}
                className={classNames?.dialog?.content}
            >
                <DialogHeader className={classNames?.dialog?.header}>
                    <DialogTitle
                        className={cn("text-lg md:text-xl", classNames?.title)}
                    >
                        {localization.API_KEY_CREATED}
                    </DialogTitle>

                    <DialogDescription
                        className={cn(
                            "text-xs md:text-sm",
                            classNames?.description
                        )}
                    >
                        {localization.CREATE_API_KEY_SUCCESS}
                    </DialogDescription>
                </DialogHeader>

                <div className="break-all rounded-md bg-muted p-4 font-mono text-sm">
                    {apiKey}
                </div>

                <DialogFooter className={classNames?.dialog?.footer}>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleCopy}
                        disabled={copied}
                        className={cn(
                            classNames?.button,
                            classNames?.outlineButton
                        )}
                    >
                        {copied ? (
                            <>
                                <CheckIcon className={classNames?.icon} />
                                {localization.COPIED_TO_CLIPBOARD}
                            </>
                        ) : (
                            <>
                                <CopyIcon className={classNames?.icon} />
                                {localization.COPY_TO_CLIPBOARD}
                            </>
                        )}
                    </Button>

                    <Button
                        type="button"
                        variant="default"
                        onClick={() => onOpenChange?.(false)}
                        className={cn(
                            classNames?.button,
                            classNames?.primaryButton
                        )}
                    >
                        {localization.DONE}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
