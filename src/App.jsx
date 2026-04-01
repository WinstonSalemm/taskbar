import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import FirmDashboard from "./pages/FirmDashboard";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import Employees from "./pages/Employees";
import Layout from "./layouts/Layout";
import TaskList from "./components/TaskList";
import "./App.css";
import "./index.css";

function App() {
  const { user } = useAuthStore();

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={!user ? <Login /> : <Navigate to="/" />}
        />

        <Route path="/" element={user ? <Layout /> : <Navigate to="/login" />}>
          <Route
            index
            element={
              user?.role === "admin" ? (
                <AdminDashboard />
              ) : user?.role === "firm" ? (
                <FirmDashboard />
              ) : (
                <EmployeeDashboard />
              )
            }
          />
          <Route path="tasks" element={<TaskList />} />
          <Route path="files" element={<div className="content">Файлы</div>} />
          <Route path="employees" element={<Employees />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
