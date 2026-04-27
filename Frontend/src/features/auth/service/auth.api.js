import axios from 'axios'

const api = axios.create({
    baseURL: "http://localhost:3000",
    withCredentials: true,
})

// ADD the interceptor here — right after api is created
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            try {
                await api.post("/api/auth/refresh");
                return api(originalRequest);
            } catch (refreshError) {
                return Promise.reject(refreshError);
            }
        }
        return Promise.reject(error);
    }
);

export async function register({ email, username, password }) {
    const response = await api.post("/api/auth/register", { email, username, password })
    return response.data
}

export async function login({ email, password }) {
    const response = await api.post("/api/auth/login", { email, password })
    return response.data
}

export async function getMe() {
    const response = await api.get("/api/auth/get-me")
    return response.data
}

export async function logout() {
    const response = await api.post("/api/auth/logout")
    return response.data
}

export async function refreshToken() {
    const response = await api.post("/api/auth/refresh")
    return response.data
}

/* Update the logged-in user's username */
export async function updateUsername({ newUsername }) {
    const response = await api.post("/api/user/update-username", { newUsername })
    return response.data
}

/* Update the logged-in user's password */
export async function updatePassword({ oldPassword, newPassword }) {
    const response = await api.post("/api/user/update-password", { oldPassword, newPassword })
    return response.data
}