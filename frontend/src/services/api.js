import axios from "axios";
import { supabase } from "./supabase";

const API_URL =
    import.meta.env.VITE_API_URL ||
    "https://africore-erp-pro.onrender.com/api";

const api = axios.create({
    baseURL: API_URL,
    timeout: 30000,
    headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
    },
});

api.interceptors.request.use(
    async (config) => {
        try {
            const { data, error } =
                await supabase.auth.getSession();

            if (error) {
                console.warn(
                    "Unable to read Supabase session:",
                    error.message
                );
            }

            const accessToken =
                data?.session?.access_token;

            if (accessToken) {
                config.headers =
                    config.headers || {};

                config.headers.Authorization =
                    `Bearer ${accessToken}`;
            }
        } catch (error) {
            console.error(
                "API authentication error:",
                error
            );
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        const status =
            error?.response?.status;

        if (status === 401) {
            console.warn(
                "API authentication failed:",
                error?.config?.url
            );
        }

        if (status === 403) {
            console.warn(
                "API permission denied:",
                error?.config?.url
            );
        }

        return Promise.reject(error);
    }
);

export default api;
