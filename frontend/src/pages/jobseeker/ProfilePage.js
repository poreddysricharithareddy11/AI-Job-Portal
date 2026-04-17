import { useEffect, useState } from "react";
import api from "../../services/api";
import { User, Save } from "lucide-react";

export default function ProfilePage() {
  const [profile, setProfile] = useState({ name: "", email: "" });

  useEffect(() => {
    api.get("/api/auth/profile").then(res => setProfile(res.data));
  }, []);

  const handleUpdate = async () => {
    try {
      await api.put("/api/auth/profile", { name: profile.name });
      alert("Profile updated!");
    } catch { alert("Update failed"); }
  };

  return (
    <div className="profile-card">
      <div className="header">
        <User size={40} />
        <h2>Personal Profile</h2>
      </div>
      <div className="body">
        <label>Name</label>
        <input value={profile.name} onChange={e => setProfile({...profile, name: e.target.value})} />
        <label>Email</label>
        <input value={profile.email} disabled className="disabled" />
        <button onClick={handleUpdate} className="btn-save"><Save size={16}/> Save Changes</button>
      </div>
    </div>
  );
}