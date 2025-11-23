export type OrganizationLogoOptions = {
    /**
     * Upload a logo image and return the URL string
     * @remarks `(file: File) => Promise<string>`
     */
    upload?: (file: File) => Promise<string | undefined | null>
    /**
     * Delete a previously uploaded logo image from your storage/CDN
     * @remarks `(url: string) => Promise<void>`
     */
    delete?: (url: string) => Promise<void>
    /**
     * Logo size for resizing
     * @default 256 if upload is provided, 128 otherwise
     */
    size: number
    /**
     * File extension for logo uploads
     * @default "png"
     */
    extension: string
}

import type { OrganizationViewPaths } from "../lib/view-paths"

export type OrganizationOptions = {
    /**
     * Logo configuration
     * @default undefined
     */
    logo?: boolean | Partial<OrganizationLogoOptions>
    /**
     * Custom roles to add to the built-in roles (owner, admin, member)
     * @default []
     */
    customRoles?: Array<{ role: string; label: string }>
    /**
     * Enable or disable API key support for organizations
     * @default false
     */
    apiKey?: boolean
    /**
     * Base path for organization-scoped views (supports slugged or static base)
     * When using slug paths, set this to the common prefix (e.g. "/organization")
     */
    basePath?: string
    /**
     * Organization path mode
     * - "default": use active-organization based routes
     * - "slug": use slug-based URLs where slug becomes the first path segment
     *   e.g. "/[slug]/members" (or `${basePath}/[slug]/members` if basePath provided)
     * @default "default"
     */
    pathMode?: "default" | "slug"
    /**
     * The current organization slug
     */
    slug?: string
    /**
     * The path to redirect to when Personal Account is selected
     */
    personalPath?: string
    /**
     * Customize organization view paths
     */
    viewPaths?: Partial<OrganizationViewPaths>
}

export type OrganizationOptionsContext = {
    /**
     * Logo configuration
     * @default undefined
     */
    logo?: OrganizationLogoOptions
    /**
     * Custom roles to add to the built-in roles (owner, admin, member)
     * @default []
     */
    customRoles: Array<{ role: string; label: string }>
    /**
     * Enable or disable API key support for organizations
     * @default false
     */
    apiKey?: boolean
    /**
     * Base path for organization-scoped views
     */
    basePath: string
    /**
     * Organization path mode
     * @default "default"
     */
    pathMode?: "default" | "slug"
    /**
     * The current organization slug
     */
    slug?: string
    /**
     * The path to redirect to when Personal Account is selected
     */
    personalPath?: string
    /**
     * Customize organization view paths
     */
    viewPaths: OrganizationViewPaths
}
