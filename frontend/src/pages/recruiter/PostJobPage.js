import { useState } from "react";
import api from "../../services/api";
import { Send, Briefcase, IndianRupee, AlignLeft, Users } from "lucide-react";

export default function PostJobPage() {
  const [job, setJob] = useState({
    title: "",
    description: "",
    salary: "",
    openings: ""
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setJob({ ...job, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/api/jobs", job);
      alert("Job vacancy posted successfully!");
      setJob({ title: "", description: "", salary: "", openings: "" });
    } catch (err) {
      alert(err.response?.data?.msg || "Failed to post job");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container-centered max-w-2xl mx-auto">
      <div className="glass-card-wide p-8 rounded-2xl card-premium">
        <div className="card-header-main mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-600">
              <Briefcase size={28} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Create New Job Posting</h2>
          </div>
          <p className="text-slate-600">Fill in the details to find the best AI-matched talent.</p>
        </div>

        <form onSubmit={handleSubmit} className="professional-form space-y-4">
          <div className="form-row">
            <div className="input-field">
              <label><Briefcase size={14}/> Job Title</label>
              <input name="title" placeholder="e.g. Senior Data Analyst" value={job.title} onChange={handleChange} required />
            </div>
            <div className="input-field">
              <label><IndianRupee size={14}/> Salary Package</label>
              <input name="salary" placeholder="e.g. 12-15 LPA" value={job.salary} onChange={handleChange} required />
            </div>
          </div>

          <div className="input-field">
            <label><AlignLeft size={14}/> Job Description & Requirements</label>
            <textarea name="description" rows="5" placeholder="Detail the skills, tools, and responsibilities..." value={job.description} onChange={handleChange} required />
          </div>

          <div className="input-field narrow">
            <label><Users size={14}/> Number of Openings</label>
            <input type="number" name="openings" placeholder="1" value={job.openings} onChange={handleChange} required />
          </div>

          <button type="submit" className="btn-primary w-full inline-flex items-center justify-center gap-2 py-3" disabled={loading}>
            {loading ? "Posting..." : <><Send size={18}/> Publish Job Posting</>}
          </button>
        </form>
      </div>
    </div>
  );
}