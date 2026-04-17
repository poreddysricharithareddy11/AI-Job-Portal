import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../../services/api";

export default function Register() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "jobseeker"
  });
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/api/auth/register", form);
      alert("Registration successful! Please login.");
      navigate("/");
    } catch (err) {
      alert(err.response?.data?.msg || "Registration failed");
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Join SmartPortal</h2>
        <form onSubmit={handleSubmit} className="auth-form">
          <input name="name" onChange={e => setForm({...form, name: e.target.value})} placeholder="Full Name" required />
          <input name="email" type="email" onChange={e => setForm({...form, email: e.target.value})} placeholder="Email" required />
          <input name="password" type="password" onChange={e => setForm({...form, password: e.target.value})} placeholder="Password" required />
          <select name="role" onChange={e => setForm({...form, role: e.target.value})}>
            <option value="jobseeker">Job Seeker</option>
            <option value="recruiter">Recruiter</option>
          </select>
          <button type="submit" className="btn-auth">Register</button>
        </form>
        <p>Already have an account? <Link to="/">Login</Link></p>
      </div>
    </div>
  );
}