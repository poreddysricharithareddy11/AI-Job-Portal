import { useEffect, useState } from "react";
import api from "../../services/api";
import StatusBadge from "../../components/StatusBadge";
import { FileText } from "lucide-react";

function getMatchColor(pct) {
  if (pct >= 70) return "text-emerald-600 bg-emerald-50 border-emerald-200";
  if (pct >= 50) return "text-amber-600 bg-amber-50 border-amber-200";
  return "text-red-600 bg-red-50 border-red-200";
}

export default function AppliedJobsPage() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/api/applications/my-applications")
      .then((res) => setApps(res.data))
      .catch(() => alert("Failed to load applications"))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="loader flex items-center justify-center py-12 text-slate-600">
        Loading history...
      </div>
    );

  return (
    <div className="page-wrapper max-w-4xl mx-auto">
      <h2 className="text-3xl font-extrabold bg-gradient-to-r from-indigo-600 to-indigo-800 bg-clip-text text-transparent mb-6">My Applications</h2>
      <div className="list-stack space-y-4">
        {apps.length === 0 ? (
          <p className="text-slate-600 p-6 rounded-2xl card-premium">No applications yet.</p>
        ) : (
          apps.map((a) => (
            <div
              key={a._id}
              className="app-card-row flex flex-wrap justify-between items-center gap-4 p-5 rounded-2xl card-premium"
            >
              <div>
                <h4 className="font-semibold text-slate-800">{a.job?.title}</h4>
                <p className="date text-sm text-slate-500 mt-0.5">
                  Applied: {new Date(a.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="stats flex flex-wrap items-center gap-3">
                <div
                  className={`score inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${getMatchColor(
                    a.score ?? 0
                  )}`}
                >
                  <strong>{a.score ?? 0}%</strong> match
                </div>
                <StatusBadge status={a.status} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
