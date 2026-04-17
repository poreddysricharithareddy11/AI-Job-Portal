const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");

const AI_ENGINE_BASE = process.env.AI_ENGINE_BASE_URL || "http://127.0.0.1:8000";
const TIMEOUT = Number(process.env.AI_ENGINE_TIMEOUT_MS || 180000);

const KNOWN_SKILLS = [
  "python", "java", "javascript", "typescript", "react", "node", "node.js", "sql",
  "mongodb", "mysql", "postgresql", "aws", "azure", "gcp", "docker", "kubernetes",
  "git", "linux", "html", "css", "express", "django", "flask", "fastapi", "spring boot",
  "tensorflow", "pytorch", "scikit-learn", "pandas", "numpy", "power bi", "tableau",
  "machine learning", "deep learning", "nlp", "rest api", "graphql", "redis", "jenkins"
];

const normalizeSkill = (s) => String(s || "").trim().toLowerCase();

const dedupe = (items) => {
  const out = [];
  const seen = new Set();
  for (const item of items || []) {
    const k = normalizeSkill(item);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
};

const canonicalSkill = (s) => {
  const t = normalizeSkill(s);
  if (!t) return "";
  if (t === "data analysis" || t === "data analytics" || t === "data analyst") return "data science";
  if (t === "data science") return "data science";
  return t;
};

const extractJDSkills = (jobDescription = "") => {
  const text = String(jobDescription || "").toLowerCase();
  const found = [];
  for (const skill of KNOWN_SKILLS) {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`\\b${escaped}\\b`, "i");
    if (pattern.test(text)) found.push(skill);
  }
  return dedupe(found);
};

const buildRuleFallback = (extracted = {}, jobDescription = "") => {
  const resumeSkills = dedupe(extracted.skills || []);
  const jdSkills = extractJDSkills(jobDescription);
  const resumeSet = new Set(resumeSkills.map(canonicalSkill));
  const matched = jdSkills.filter((s) => resumeSet.has(canonicalSkill(s)));
  const missing = jdSkills.filter((s) => !resumeSet.has(canonicalSkill(s)));

  const skillRatio = jdSkills.length ? matched.length / jdSkills.length : 0.5;
  const yearsResume = Number(extracted.years_of_experience || 0);
  const yearsNeeded = (() => {
    const m = String(jobDescription || "").match(/(\d+)\+?\s*years?/i);
    return m ? Number(m[1]) : 0;
  })();
  const yearsScore = yearsNeeded > 0 ? Math.min(1, yearsResume / yearsNeeded) : 1;
  const eduBonus = (extracted.education || []).length > 0 ? 0.1 : 0;
  const certBonus = (extracted.certifications || []).length > 0 ? 0.1 : 0;
  const ruleNorm = Math.max(0, Math.min(1, 0.5 * skillRatio + 0.3 * yearsScore + eduBonus + certBonus));
  const finalPct = Math.round(ruleNorm * 10000) / 100;

  return {
    match_percentage: finalPct,
    missing_keywords: missing.slice(0, 15),
    experience_level: yearsResume >= 3 ? "Senior" : "Junior",
    match_breakdown: {
      sbert_score: 0,
      tfidf_score: 0,
      rule_score: finalPct,
      final_percentage: finalPct,
    },
    extracted: {
      skills: resumeSkills.map(canonicalSkill).filter(Boolean),
      years_of_experience: yearsResume,
      education: extracted.education || [],
      certifications: extracted.certifications || [],
    },
    top_roles: finalPct >= 70 ? ["Potential Match"] : ["Needs Improvement"],
  };
};

const parseResumeOnly = async (filePath) => {
  const parseForm = new FormData();
  parseForm.append("resume", fs.createReadStream(filePath));
  const parseResponse = await axios.post(`${AI_ENGINE_BASE}/parse`, parseForm, {
    headers: { ...parseForm.getHeaders() },
    timeout: TIMEOUT,
  });
  return parseResponse.data?.extracted || {
    skills: [],
    years_of_experience: 0,
    education: [],
    certifications: [],
  };
};

/**
 * Analyze resume against job description. Returns match_percentage, match_breakdown, extracted, etc.
 */
exports.analyzeResumeWithAI = async (filePath, jobDescription, jobTitle, jobId = null) => {
  const form = new FormData();
  form.append("resume", fs.createReadStream(filePath));
  form.append("job_description", jobDescription || "No description provided");
  form.append("job_title", jobTitle || "General Role");
  if (jobId) form.append("job_id", jobId);

  try {
    const response = await axios.post(`${AI_ENGINE_BASE}/analyze`, form, {
      headers: { ...form.getHeaders() },
      timeout: TIMEOUT,
    });
    const data = response.data || {};

    // If analyze returned an empty extraction payload, repair it using parse endpoint.
    const extractedSkills = data?.extracted?.skills || [];
    if (!Array.isArray(extractedSkills) || extractedSkills.length === 0) {
      try {
        const extracted = await parseResumeOnly(filePath);
        const repaired = {
          ...data,
          extracted,
        };
        if (typeof repaired.match_percentage !== "number") {
          return buildRuleFallback(extracted, jobDescription);
        }
        return repaired;
      } catch (_) {
        return data;
      }
    }

    return data;
  } catch (error) {
    console.error("AI Engine analyze error:", error.message);
    // Recovery path: parse-only + local deterministic score so dashboard never gets empty payload.
    try {
      const extracted = await parseResumeOnly(filePath);
      return buildRuleFallback(extracted, jobDescription);
    } catch (parseError) {
      console.error("AI Engine parse fallback error:", parseError.message);
      return {
        match_percentage: 0,
        missing_keywords: [],
        experience_level: "Unknown",
        match_breakdown: {
          sbert_score: 0,
          tfidf_score: 0,
          rule_score: 0,
          final_percentage: 0,
        },
        extracted: {
          skills: [],
          years_of_experience: 0,
          education: [],
          certifications: [],
        },
        top_roles: [],
        service_error: "AI engine unreachable or failed to parse resume.",
      };
    }
  }
};

/**
 * Parse resume only; return extracted fields (skills, years, education, certifications).
 */
exports.parseResume = async (filePath) => {
  const form = new FormData();
  form.append("resume", fs.createReadStream(filePath));

  try {
    const response = await axios.post(`${AI_ENGINE_BASE}/parse`, form, {
      headers: { ...form.getHeaders() },
      timeout: TIMEOUT,
    });
    return response.data;
  } catch (error) {
    console.error("❌ AI Engine Parse Error:", error.message);
    return { extracted: { skills: [], years_of_experience: 0, education: [], certifications: [] } };
  }
};

/**
 * Skill gap report: resume vs job description. Returns matched/missing skills, suggestions, report_text.
 */
exports.skillGapReport = async (filePath, jobDescription, jobTitle) => {
  const form = new FormData();
  form.append("resume", fs.createReadStream(filePath));
  form.append("job_description", jobDescription || "");
  form.append("job_title", jobTitle || "");

  try {
    const response = await axios.post(`${AI_ENGINE_BASE}/skill-gap`, form, {
      headers: { ...form.getHeaders() },
      timeout: TIMEOUT,
    });
    return response.data;
  } catch (error) {
    console.error("❌ AI Engine Skill Gap Error:", error.message);
    return {
      matched_skills: [],
      missing_skills: [],
      missing_tools_frameworks: [],
      suggested_keywords: [],
      phrasing_suggestions: [],
      report_text: "Skill gap analysis failed.",
    };
  }
};

/**
 * Sort candidates by SBERT similarity (job vs profile text). Returns ordered list with scores.
 */
exports.shortlistBySimilarity = async (jobTitle, jobDescription, candidates) => {
  if (!candidates || !candidates.length) return { order: [] };
  try {
    const response = await axios.post(
      `${AI_ENGINE_BASE}/shortlist-by-similarity`,
      { job_title: jobTitle, job_description: jobDescription, candidates },
      { timeout: 60000 }
    );
    return response.data;
  } catch (error) {
    console.error("❌ AI Engine Shortlist By Similarity Error:", error.message);
    return { order: [] };
  }
};

/**
 * Random Forest shortlist: pass candidates with breakdown + extracted; returns array of 0/1.
 */
exports.shortlistRF = async (candidates) => {
  if (!candidates || !candidates.length) return { shortlist: [] };
  try {
    const response = await axios.post(
      `${AI_ENGINE_BASE}/shortlist-rf`,
      { candidates },
      { timeout: 30000 }
    );
    return response.data;
  } catch (error) {
    console.error("❌ AI Engine Shortlist RF Error:", error.message);
    return { shortlist: candidates.map(() => 0) };
  }
};
