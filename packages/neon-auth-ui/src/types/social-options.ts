import type { SocialProvider } from "better-auth/social-providers"
import type { AuthClient } from "./auth-client"

export type SocialOptions = {
    /**
     * Array of Social Providers to enable
     * @remarks `SocialProvider[]`
     */
    providers: SocialProvider[]
    /**
     * Custom social sign in function
     */
    signIn?: (
        params: Parameters<AuthClient["signIn"]["social"]>[0]
    ) => Promise<unknown>
}
