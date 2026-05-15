import { createContext, useContext, useState, useEffect } from "react";
import { fetchMe } from "../api/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [ready, setReady] = useState(false);

    // Restore session from localStorage on first mount
    useEffect(() => {
        const stored = localStorage.getItem("access_token");
        if (!stored) { setReady(true); return; }

        setToken(stored);
        fetchMe(stored)
            .then(u => setUser(u))
            .catch(() => localStorage.removeItem("access_token"))
            .finally(() => setReady(true));
    }, []);

    function login(user, access, refresh) {
        localStorage.setItem("access_token", access);
        if (refresh) localStorage.setItem("refresh_token", refresh);
        setToken(access);
        setUser(user);
    }

    function logout() {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        setToken(null);
        setUser(null);
    }

    return (
        <AuthContext.Provider value={{ user, setUser, token, login, logout, ready }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}