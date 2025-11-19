import { useEffect, useState } from "react"

export function useTheme() {
    const [theme, setTheme] = useState<"light" | "dark">("light")

    useEffect(() => {
        const checkTheme = () => {
            const isDark =
                document.documentElement.classList.contains("dark") ||
                document.documentElement
                    .getAttribute("style")
                    ?.includes("color-scheme: dark")
            setTheme(isDark ? "dark" : "light")
        }

        // Initial check
        checkTheme()

        // Listen for changes to html tag
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (
                    mutation.attributeName === "style" ||
                    mutation.attributeName === "class"
                ) {
                    checkTheme()
                }
            }
        })

        observer.observe(document.documentElement, { attributes: true })

        return () => {
            observer.disconnect()
        }
    }, [])

    return { theme }
}
