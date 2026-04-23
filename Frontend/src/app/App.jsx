import { RouterProvider } from "react-router"
import { router } from "./app.routes"
import { useAuth } from "../features/auth/hook/useAuth"
import { useEffect } from "react"
import { Toaster } from "sonner"


function App() {

  const auth = useAuth()

  useEffect(() => {
    auth.handleGetMe()
  }, [])

  return (
    <>
      <Toaster
        position="top-right"
        theme="dark"
        richColors
      />
      <RouterProvider router={router} />
    </>
  )
}

export default App