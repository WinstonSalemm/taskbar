import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import { ThemeProvider } from "./context/ThemeContext";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import DirectorDashboard from "./pages/DirectorDashboard";
import FirmDashboard from "./pages/FirmDashboard";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import Employees from "./pages/Employees";
import Files from "./pages/Files";
import FinancialDashboard from "./pages/FinancialDashboard";
import Layout from "./layouts/Layout";
import TaskList from "./components/TaskList";
import "./App.css";
import "./index.css";

function App() {
  const { user } = useAuthStore();

  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={!user ? <Login /> : <Navigate to="/" />}
          />

          <Route
            path="/"
            element={user ? <Layout /> : <Navigate to="/login" />}
          >
            <Route
              index
              element={
                user?.role === "admin" ? (
                  <AdminDashboard />
                ) : user?.role === "director" ? (
                  <DirectorDashboard />
                ) : user?.role === "firm" ? (
                  <FirmDashboard />
                ) : (
                  <EmployeeDashboard />
                )
              }
            />
            <Route path="tasks" element={<TaskList />} />
            <Route path="files" element={<Files />} />
            <Route path="employees" element={<Employees />} />
            <Route path="financial" element={<FinancialDashboard />} />
          </Route>

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
