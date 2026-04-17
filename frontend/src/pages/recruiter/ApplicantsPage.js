import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../../services/api";
import StatusBadge from "../../components/StatusBadge";
import { Check, X, User, Target, BarChart3, Sparkles } from "lucide-react";

function getMatchColor(pct) {
  if (pct >= 70) return "text-emerald-600 bg-emerald-50";
  if (pct >= 50) return "text-amber-600 bg-amber-50";
  return "text-red-600 bg-red-50";
}

export default function ApplicantsPage() {
  const { jobId } = useParams();
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rfLoading, setRfLoading] = useState(false);
  const [expandId, setExpandId] = useState(null);

  const fetchApps = () => {
    api
      .get(`/api/applications/top/${jobId}`)
      .then((res) => setApps(res.data))
      .catch(() => alert("Failed to fetch applicant rankings"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    fetchApps();
  }, [jobId]);

  const setStatus = async (appId, status) => {
    try {
      await api.put(`/api/applications/status/${appId}`, { status });
      setApps((prev) => prev.map((a) => (a._id === appId ? { ...a, status } : a)));
    } catch (err) {
      alert("Failed to update status");
    }
  };

  const runShortlistRF = async () => {
    setRfLoading(true);
    try {
      const res = await api.post(`/api/applications/shortlist-rf/${jobId}`);
      setApps(res.data.applications || []);
    } catch (err) {
      alert(err.response?.data?.msg || "Shortlist failed");
    } finally {
      setRfLoading(false);
    }
  };

  if (loading)
    return (
      <div className="loader-box flex items-center justify-center py-12 text-slate-600">
        Analyzing AI Rankings...
      </div>
    );

  return (
    <div className="applicants-view-container max-w-5xl mx-auto">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <h2 className="text-2xl font-extrabold bg-gradient-to-r from-indigo-600 to-indigo-800 bg-clip-text text-transparent">AI-Ranked Candidates</h2>
        <button
          type="button"
          onClick={runShortlistRF}
          disabled={rfLoading || apps.length === 0}
          className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
        >
          <Sparkles size={16} /> {rfLoading ? "Running..." : "Run RF Shortlist"}
        </button>
      </div>

      <div className="applicants-grid-full space-y-4">
        {apps.length === 0 ? (
          <p className="no-data text-slate-600 p-6 rounded-2xl card-premium">No applications received for this role yet.</p>
        ) : (
          apps.map((app) => (
            <div
              key={app._id}
              className="applicant-profile-card p-6 rounded-2xl card-premium"
            >
              <div className="applicant-header flex flex-wrap justify-between items-start gap-4">
                <div className="flex items-center gap-3">
                  <div className="user-avatar-placeholder w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                    <User size={24} className="text-slate-600" />
                  </div>
                  <div className="user-details">
                    <h4 className="font-semibold text-slate-800">{app.applicant?.name}</h4>
                    <p className="text-sm text-slate-500">{app.applicant?.email}</p>
                  </div>
                </div>
                <div
                  className={`ai-score-ring inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${getMatchColor(
                    app.score ?? 0
                  )}`}
                >
                  <Target size={14} />
                  <span className="font-semibold">{app.score ?? 0}% Match</span>
                </div>
              </div>

              {/* Match breakdown */}
              {app.matchBreakdown && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setExpandId(expandId === app._id ? null : app._id)}
                    className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-800"
                  >
                    <BarChart3 size={16} /> Match breakdown
                  </button>
                  {expandId === app._id && (
                    <div className="mt-2 flex flex-wrap gap-4 text-sm">
                      <span className="text-slate-600">
                        SBERT: <strong>{app.matchBreakdown.sbertScore ?? "–"}%</strong>
                      </span>
                      <span className="text-slate-600">
                        TF-IDF: <strong>{app.matchBreakdown.tfidfScore ?? "–"}%</strong>
                      </span>
                      <span className="text-slate-600">
                        Rule: <strong>{app.matchBreakdown.ruleScore ?? "–"}%</strong>
                      </span>
                      {app.yearsExperience != null && (
                        <span className="text-slate-600">
                          Years exp: <strong>{app.yearsExperience}</strong>
                        </span>
                      )}
                      {app.similarityScore != null && (
                        <span className="text-indigo-600 font-medium">
                          Similarity: {app.similarityScore}%
                        </span>
                      )}
                      {app.shortlistRF != null && (
                        <span
                          className={
                            app.shortlistRF
                              ? "text-emerald-600 font-medium"
                              : "text-slate-500"
                          }
                        >
                          RF: {app.shortlistRF ? "Shortlist" : "Reject"}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="applicant-actions mt-4 flex flex-wrap justify-between items-center gap-3">
                <StatusBadge status={app.status} />
                <div className="action-button-group flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStatus(app._id, "selected")}
                    className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
                    title="Shortlist Candidate"
                  >
                    <Check size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus(app._id, "rejected")}
                    className="p-2.5 rounded-xl bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                    title="Reject Candidate"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
