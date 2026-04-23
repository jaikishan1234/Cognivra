import { useDispatch } from "react-redux";
import { register, login, getMe, logout } from "../service/auth.api";
import { setUser, setLoading, setError } from "../auth.slice";
import { toast } from "sonner";

export function useAuth() {
    const dispatch = useDispatch();

    async function handleRegister({ email, username, password }) {
        try {
            dispatch(setLoading(true))
            const data = await register({ email, username, password })
            toast.success("Registered successfully! Please verify your email.")
        } catch (error) {
            const message = error.response?.data?.message || "Registration failed"
            dispatch(setError(message))
            toast.error(message)
        } finally {
            dispatch(setLoading(false))
        }
    }

    async function handleLogin({ email, password }) {
        try {
            dispatch(setLoading(true))
            const data = await login({ email, password })
            dispatch(setUser(data.user))
            toast.success("Welcome back!")
        } catch (err) {
            const message = err.response?.data?.message || "Login failed"
            dispatch(setError(message))
            toast.error(message)
        } finally {
            dispatch(setLoading(false))
        }
    }

    async function handleGetMe() {
        try {
            dispatch(setLoading(true))
            const data = await getMe()
            dispatch(setUser(data.user))
        } catch (err) {
            // Silent — user is just not logged in
            dispatch(setError(err.response?.data?.message || "Failed to fetch user data"))
        } finally {
            dispatch(setLoading(false))
        }
    }

    async function handleLogout() {
        try {
            await logout();
            dispatch(setUser(null))
            toast.success("Logged out successfully")
        } catch (err) {
            const message = err.response?.data?.message || "Logout failed"
            dispatch(setError(message))
            toast.error(message)
        }
    }

    return {
        handleRegister,
        handleLogin,
        handleGetMe,
        handleLogout,
    }
}