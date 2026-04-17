import { useEffect, useState } from "react";
import api from "../../services/api";
import { UploadCloud, FileText, X, Download } from "lucide-react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from "recharts";

export default function AvailableJobsPage() {
  const [jobs, setJobs] = useState([]);
  const [loadingId, setLoadingId] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [lastJobId, setLastJobId] = useState(null);
  const [skillGapOpen, setSkillGapOpen] = useState(false);
  const [skillGapLoading, setSkillGapLoading] = useState(false);
  const [skillGapData, setSkillGapData] = useState(null);
  const [skillGapJob, setSkillGapJob] = useState(null);

  useEffect(() => {
    api.get("/api/jobs")
      .then((res) => setJobs(res.data))
      .catch((err) => console.error("Fetch failed", err));
  }, []);

  const handleFile = (file) => {
    if (!file || !/\.(pdf|docx)$/i.test(file.name)) return;
    setSelectedFile(file);
    if (file.type === "application/pdf") {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const f = e.dataTransfer.files[0];
    handleFile(f);
  };

  const handleApply = async (jobId, file) => {
    const f = file || selectedFile;
    if (!f) return;
    const formData = new FormData();
    formData.append("jobId", jobId);
    formData.append("resume", f);

    setLoadingId(jobId);
    setLastJobId(jobId);
    setLastResult(null);
    try {
      const res = await api.post("/api/applications/apply-ai", formData);
      setLastResult(res.data.aiAnalysis || res.data);
      setLastJobId(jobId);
    } catch (err) {
      alert(err.response?.data?.msg || "Application failed");
    } finally {
      setLoadingId(null);
    }
  };

  const getMatchColor = (pct) => {
    if (pct >= 70) return "text-emerald-600 bg-emerald-50 border-emerald-200";
    if (pct >= 50) return "text-amber-600 bg-amber-50 border-amber-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  const openSkillGap = (job) => {
    setSkillGapJob(job);
    setSkillGapData(null);
    setSkillGapOpen(true);
  };

  const runSkillGap = async () => {
    if (!skillGapJob || !selectedFile) {
      alert("Upload a resume first, then select a job and run Skill Gap.");
      return;
    }
    setSkillGapLoading(true);
    const formData = new FormData();
    formData.append("resume", selectedFile);
    formData.append("jobId", skillGapJob._id);
    try {
      const res = await api.post("/api/applications/skill-gap", formData);
      setSkillGapData(res.data);
    } catch (err) {
      alert(err.response?.data?.msg || "Skill gap analysis failed");
    } finally {
      setSkillGapLoading(false);
    }
  };

  const downloadReport = () => {
    if (!skillGapData?.report_text) return;
    const blob = new Blob([skillGapData.report_text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "skill-gap-report.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const radarData = skillGapData
    ? (() => {
        const matched = (skillGapData.matched_skills || []).length;
        const missing = (skillGapData.missing_skills || []).length;
        const total = matched + missing || 1;
        const skillOverlap = Math.round((matched / total) * 100);
        const yrsRes = skillGapData.years_resume ?? 0;
        const yrsJd = skillGapData.years_jd ?? 1;
        const expFit = yrsJd > 0 ? Math.min(100, Math.round((yrsRes / yrsJd) * 100)) : 80;
        return [
          { subject: "Skills match", score: skillOverlap, fullMark: 100 },
          { subject: "Experience fit", score: expFit, fullMark: 100 },
          { subject: "Keyword coverage", score: Math.max(0, skillOverlap - 10), fullMark: 100 },
          { subject: "Suggested terms", score: Math.min(100, (skillGapData.suggested_keywords || []).length * 5), fullMark: 100 },
          { subject: "Overall readiness", score: Math.round((skillOverlap + expFit) / 2), fullMark: 100 },
        ];
      })()
    : [];

  return (
    <div className="page-wrapper max-w-6xl mx-auto">
      <header className="page-header mb-8">
        <h1 className="text-3xl font-extrabold bg-gradient-to-r from-indigo-600 to-indigo-800 bg-clip-text text-transparent">Available Jobs</h1>
        <p className="text-slate-600 mt-2 text-base">Find roles optimized for your skill set via AI matching.</p>
      </header>

      {/* Resume upload: drag & drop + preview */}
      <div className="mb-8 p-6 rounded-2xl card-premium">
        <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <FileText size={18} /> Resume
        </h3>
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
            dragActive ? "border-indigo-500 bg-indigo-50" : "border-slate-300 bg-slate-50 hover:border-slate-400"
          }`}
        >
          <input
            type="file"
            accept=".pdf,.docx"
            className="hidden"
            id="resume-upload"
            onChange={(e) => handleFile(e.target.files[0])}
          />
          <label htmlFor="resume-upload" className="cursor-pointer block">
            <UploadCloud className="mx-auto text-slate-400 mb-2" size={32} />
            <p className="text-slate-600 text-sm">
              {selectedFile ? selectedFile.name : "Drag & drop your resume (PDF/DOCX) or click to browse"}
            </p>
          </label>
        </div>
        {previewUrl && (
          <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
            <span>Preview:</span>
            <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-medium hover:underline">
              Open PDF
            </a>
          </div>
        )}
      </div>

      {/* Last AI result: breakdown + extracted skills */}
      {lastResult && (
        <div className="mb-8 p-6 rounded-2xl card-premium">
          <h3 className="text-base font-semibold text-slate-800 mb-4">Last match result</h3>
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border ${getMatchColor(
                lastResult.match_percentage || 0
              )}`}
            >
              <span className="font-bold">{lastResult.match_percentage ?? 0}%</span> match
            </div>
            {lastResult.match_breakdown && (
              <div className="flex gap-3 text-xs text-slate-600">
                <span>
                  SBERT:{" "}
                  {(() => {
                    const v = Number(lastResult.match_breakdown.sbert_score);
                    return Number.isFinite(v) ? v : 0;
                  })()}
                  %
                </span>
                <span>
                  TF-IDF:{" "}
                  {(() => {
                    const v = Number(lastResult.match_breakdown.tfidf_score);
                    return Number.isFinite(v) ? v : 0;
                  })()}
                  %
                </span>
                <span>
                  Rule:{" "}
                  {(() => {
                    const v = Number(lastResult.match_breakdown.rule_score);
                    return Number.isFinite(v) ? v : 0;
                  })()}
                  %
                </span>
              </div>
            )}
          </div>
          {lastResult.extracted?.skills?.length > 0 && (
            <div className="mb-2">
              <p className="text-xs font-medium text-slate-500 mb-1">Extracted skills</p>
              <div className="flex flex-wrap gap-2">
                {lastResult.extracted.skills.slice(0, 15).map((s, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
          {lastResult.missing_keywords?.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">Missing keywords</p>
              <div className="flex flex-wrap gap-2">
                {lastResult.missing_keywords.slice(0, 10).map((k, i) => (
                  <span key={i} className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs">
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Job list */}
      <div className="grid gap-4">
        {jobs.map((job) => (
          <div
            key={job._id}
            className="job-card-premium p-6 rounded-2xl card-premium"
          >
            <div className="flex flex-wrap justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-800">{job.title}</h3>
                <p className="desc text-sm text-slate-600 mt-1 line-clamp-2">{job.description}</p>
              </div>
              <div className="action-row flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  id={`f-${job._id}`}
                  accept=".pdf,.docx"
                  className="hidden"
                  onChange={(e) => {
                    handleFile(e.target.files[0]);
                    handleApply(job._id, e.target.files[0]);
                  }}
                />
                <label
                  htmlFor={`f-${job._id}`}
                  className="btn-primary inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loadingId === job._id ? (
                    "AI Analyzing..."
                  ) : (
                    <>
                      <UploadCloud size={16} /> Apply with AI
                    </>
                  )}
                </label>
                <button
                  type="button"
                  onClick={() => openSkillGap(job)}
                  className="btn-secondary inline-flex items-center gap-2"
                >
                  Skill Gap
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Skill Gap modal */}
      {skillGapOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
              <h3 className="font-bold text-slate-800 text-lg">
                Skill Gap & Resume Improvement {skillGapJob && `– ${skillGapJob.title}`}
              </h3>
              <button
                type="button"
                onClick={() => setSkillGapOpen(false)}
                className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X size={22} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              {!skillGapData ? (
                <div className="text-center py-8">
                  <p className="text-slate-600 mb-4">
                    {selectedFile
                      ? "Run analysis to see matched/missing skills and suggestions."
                      : "Upload a resume above, then open Skill Gap for a job."}
                  </p>
                  <button
                    type="button"
                    onClick={runSkillGap}
                    disabled={!selectedFile || skillGapLoading}
                    className="btn-primary disabled:opacity-50"
                  >
                    {skillGapLoading ? "Analyzing..." : "Run Skill Gap Analysis"}
                  </button>
                </div>
              ) : (
                <>
                  {radarData.length > 0 && (
                    <div className="mb-6 h-64">
                      <p className="text-sm font-semibold text-slate-700 mb-2">Skill gap radar</p>
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={radarData}>
                          <PolarGrid stroke="#e2e8f0" />
                          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                          <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                          <Radar name="Score" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.5} strokeWidth={2} />
                          <Tooltip />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">Matched skills</p>
                      <div className="flex flex-wrap gap-1">
                        {(skillGapData.matched_skills || []).slice(0, 12).map((s, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-xs">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-1">Missing skills</p>
                      <div className="flex flex-wrap gap-1">
                        {(skillGapData.missing_skills || []).slice(0, 12).map((s, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  {(skillGapData.suggested_keywords || []).length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-medium text-slate-500 mb-1">Suggested keywords to add</p>
                      <div className="flex flex-wrap gap-2">
                        {skillGapData.suggested_keywords.slice(0, 15).map((k, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs">
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {(skillGapData.phrasing_suggestions || []).length > 0 && (
                    <ul className="list-disc list-inside text-sm text-slate-700 mb-4 space-y-1">
                      {skillGapData.phrasing_suggestions.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    onClick={downloadReport}
                    className="btn-secondary inline-flex items-center gap-2"
                  >
                    <Download size={16} /> Download report
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
