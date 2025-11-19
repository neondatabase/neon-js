import type { AccountViewPaths } from "../lib/view-paths"

export type AccountOptions = {
    /**
     * Base path for account-scoped views
     * @default "/account"
     */
    basePath?: string
    /**
     * Array of fields to show in Account Settings
     * @default ["image", "name"]
     */
    fields: string[]
    /**
     * Customize account view paths
     */
    viewPaths?: Partial<AccountViewPaths>
}

export type AccountOptionsContext = {
    /**
     * Base path for account-scoped views
     * @default "/account"
     */
    basePath: string
    /**
     * Array of fields to show in Account Settings
     * @default ["image", "name"]
     */
    fields: string[]
    /**
     * Customize account view paths
     */
    viewPaths: AccountViewPaths
}
