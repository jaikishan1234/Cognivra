import { RouterProvider } from "react-router"
import { router } from "./app.routes"
import { useAuth } from "../features/auth/hook/useAuth"
import { useEffect } from "react"
import { Toaster } from "sonner"
import { ThemeProvider, useTheme } from "./ThemeContext"

function ToasterWithTheme() {
    const { theme } = useTheme()
    return (
        <Toaster
            position="top-right"
            theme={theme}
            richColors
        />
    )
}

function App() {
    const auth = useAuth()

    useEffect(() => {
        auth.handleGetMe()
    }, [])

    return (
        <ThemeProvider>
            <ToasterWithTheme />
            <RouterProvider router={router} />
        </ThemeProvider>
    )
}

export default App