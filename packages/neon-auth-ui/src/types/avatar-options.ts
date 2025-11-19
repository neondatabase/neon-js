import type { Image } from "./image"

export type AvatarOptions = {
    /**
     * Upload an avatar image and return the URL string
     * @remarks `(file: File) => Promise<string>`
     */
    upload?: (file: File) => Promise<string | undefined | null>
    /**
     * Delete a previously uploaded avatar image from your storage/CDN
     * @remarks `(url: string) => Promise<void>`
     */
    delete?: (url: string) => Promise<void>
    /**
     * Avatar size for resizing
     * @default 128 (or 256 if upload is provided)
     */
    size: number
    /**
     * File extension for avatar uploads
     * @default "png"
     */
    extension: string
    /**
     * Custom Image component for rendering avatar images
     * @default AvatarImage from Radix UI
     */
    Image?: Image
}
