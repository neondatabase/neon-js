import type { ComponentType } from "react"

export type Image = ComponentType<{
    src: string
    alt: string
    className?: string
}>
