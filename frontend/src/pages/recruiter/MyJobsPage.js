import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { Users, Power, Briefcase, Eye } from "lucide-react";

export default function MyJobsPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/api/jobs")
      .then(res => setJobs(res.data))
      .catch(err => console.error("Load Jobs Error:", err))
      .finally(() => setLoading(false));
  }, []);

  const closeJob = async (id) => {
    if(window.confirm("Closing this job will hide it from seekers. Continue?")) {
      try {
        await api.put(`/api/jobs/close/${id}`);
        setJobs(jobs.map(j => j._id === id ? { ...j, status: "closed" } : j));
      } catch (err) {
        alert("Failed to close job");
      }
    }
  };

  if (loading) return <div className="loader-box">Syncing your active postings...</div>;

  return (
    <div className="management-container max-w-5xl mx-auto">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
        <h1 className="text-2xl font-extrabold bg-gradient-to-r from-indigo-600 to-indigo-800 bg-clip-text text-transparent">Management Dashboard</h1>
        <button onClick={() => navigate("/recruiter/post")} className="btn-primary">+ Create New Post</button>
      </div>

      <div className="job-management-list space-y-4">
        {jobs.length === 0 ? (
          <div className="empty-state-card p-8 rounded-2xl card-premium text-center text-slate-600">No jobs posted yet. Start by creating one!</div>
        ) : (
          jobs.map(job => (
            <div key={job._id} className="management-card-wide p-6 rounded-2xl card-premium">
              <div className="job-primary-info">
                <div className="icon-circle"><Briefcase size={20}/></div>
                <div>
                  <h4>{job.title}</h4>
                  <span className={`status-pill ${job.status}`}>{job.status}</span>
                </div>
              </div>
              
              <div className="management-actions-row flex flex-wrap gap-2">
                <button onClick={() => navigate(`/recruiter/applicants/${job._id}`)} className="btn-primary inline-flex items-center gap-2">
                  <Eye size={16}/> View Applicants
                </button>
                {job.status === "active" && (
                  <button onClick={() => closeJob(job._id)} className="btn-secondary inline-flex items-center gap-2">
                    <Power size={16}/> Close Job
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}