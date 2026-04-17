import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";

// Page Imports
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import ProfilePage from "./pages/jobseeker/ProfilePage";
import AvailableJobsPage from "./pages/jobseeker/AvailableJobsPage";
import AppliedJobsPage from "./pages/jobseeker/AppliedJobsPage";
import PostJobPage from "./pages/recruiter/PostJobPage";
import MyJobsPage from "./pages/recruiter/MyJobsPage";
import ApplicantsPage from "./pages/recruiter/ApplicantsPage";

export default function App() {
  const { user } = useAuth(); // Access global user state

  return (
    <BrowserRouter>
      {/* Navbar renders only once for logged-in users */}
      {user && <Navbar />}
      
      <div className="dashboard-container">
        <Routes>
          {/* Auth Routes */}
          <Route path="/" element={user ? <Navigate to={`/${user.role}/profile`} /> : <Login />} />
          <Route path="/register" element={<Register />} />

          {/* Job Seeker Routes - Protected by Role */}
          <Route path="/jobseeker" element={<ProtectedRoute role="jobseeker" />}>
            <Route path="profile" element={<ProfilePage />} />
            <Route path="jobs" element={<AvailableJobsPage />} />
            <Route path="applied" element={<AppliedJobsPage />} />
          </Route>

          {/* Recruiter Routes - Protected by Role */}
          <Route path="/recruiter" element={<ProtectedRoute role="recruiter" />}>
            <Route path="profile" element={<ProfilePage />} />
            <Route path="post" element={<PostJobPage />} />
            <Route path="jobs" element={<MyJobsPage />} />
            <Route path="applicants/:jobId" element={<ApplicantsPage />} />
          </Route>
          
          {/* Fallback for undefined routes */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}