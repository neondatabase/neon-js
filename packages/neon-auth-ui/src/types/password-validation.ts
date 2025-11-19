export type PasswordValidation = {
    /**
     * Maximum password length
     */
    maxLength?: number

    /**
     * Minimum password length
     */
    minLength?: number

    /**
     * Password validation regex
     */
    regex?: RegExp
}
