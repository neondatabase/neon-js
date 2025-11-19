type ToastVariant = "default" | "success" | "error" | "info" | "warning"

export type RenderToast = ({
    variant,
    message
}: {
    variant?: ToastVariant
    message?: string
}) => void
