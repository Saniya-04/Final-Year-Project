import { useState } from "react";
import axios from "axios";

const Login = ({ onLogin }) => {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    role: "local",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await axios.post(
        "http://localhost:5000/api/login",
        formData
      );
      const { token, role } = response.data;
      localStorage.setItem("token", token);
      localStorage.setItem("role", role);
      onLogin(role);
    } catch (error) {
      setError(error.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0f172a", // solid dark background instead of gradient
      }}
    >
      <div
        style={{
          maxWidth: "420px",
          width: "100%",
          padding: "40px",
          borderRadius: "18px",
          background: "linear-gradient(160deg, #1f2937, #111827)",
          boxShadow: "0 12px 30px rgba(0,0,0,0.7)",
          color: "#e5e7eb",
          textAlign: "center",
        }}
      >
        <h2
          style={{
            fontSize: "30px",
            fontWeight: "700",
            marginBottom: "10px",
            background: "linear-gradient(90deg, #9ca3af, #f3f4f6)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          RAM Dashboard
        </h2>
        <p style={{ marginBottom: "20px", color: "#9ca3af" }}>
          Select your role and enter credentials
        </p>

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "15px",
            width: "100%",
          }}
        >
          <select
            name="role"
            value={formData.role}
            onChange={handleChange}
            style={{
              width: "350px",
              padding: "14px",
              borderRadius: "10px",
              background: "#1e293b",
              border: "1px solid #374151",
              outline: "none",
              fontSize: "14px",
              color: "#f9fafb",
            }}
          >
            <option value="local">Local User</option>
            <option value="admin">Admin User</option>
          </select>

          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleChange}
            placeholder="Username"
            required
            style={{
              width: "320px",
              padding: "14px",
              borderRadius: "10px",
              background: "#1e293b",
              border: "1px solid #374151",
              outline: "none",
              fontSize: "14px",
              color: "#f9fafb",
            }}
          />

          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Password"
            required
            style={{
              width: "320px",
              padding: "14px",
              borderRadius: "10px",
              background: "#1e293b",
              border: "1px solid #374151",
              outline: "none",
              fontSize: "14px",
              color: "#f9fafb",
            }}
          />

          {error && (
            <div style={{ color: "#f87171", fontSize: "14px" }}>{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "350px",
              padding: "14px",
              borderRadius: "10px",
              background: loading
                ? "rgba(75,85,99,0.6)"
                : "linear-gradient(90deg, #6b7280, #9ca3af)",
              color: "#111827",
              fontWeight: "600",
              fontSize: "15px",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: "0 4px 14px rgba(255,255,255,0.15)",
              transition: "all 0.3s ease",
            }}
            onMouseOver={(e) => {
              if (!loading)
                e.target.style.background =
                  "linear-gradient(90deg, #9ca3af, #d1d5db)";
            }}
            onMouseOut={(e) => {
              if (!loading)
                e.target.style.background =
                  "linear-gradient(90deg, #6b7280, #9ca3af)";
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div style={{ marginTop: "20px", fontSize: "13px", color: "#9ca3af" }}>
          <p>Demo Credentials:</p>
          <p>Local: username: "local", password: "local"</p>
          <p>Admin: username: "admin", password: "admin"</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
