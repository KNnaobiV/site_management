import { useState } from "react";
import { loginUser } from "../api/auth";
import { saveToken } from "../services/tokenService";
import { useNavigate } from "react-router-dom";

const LoginForm = () => {
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        username: "",
        password: "",
    });

    const [error, setError] = useState("");

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        try {
            const data = await loginUser(formData);
            saveToken(data.token);
            navigate("/dashboard");
        } catch (err) {
            setError("Invalid username or password");
        }
    };

    return (
        <form className="login-form" onSubmit={handleSubmit}>
            <h2>Welcome Back</h2>
            <p>By builders for builders</p>

            <input
                type="text"
                name="username"
                placeholder="Username"
                value={formData.username}
                onChange={handleChange}
                required
            />

            <input
                type="password"
                name="password"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
                required
            />

            {error && <p className="error">{error}</p>}

            <button type="submit">Login</button>
        </form>
    );
};

export default LoginForm;   