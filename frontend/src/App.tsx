import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminRoute } from './components/AdminRoute';
import { AuthProvider } from './lib/auth';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { SocietyRegister } from './pages/SocietyRegister';
import { Dashboard } from './pages/Dashboard';
import { Manage } from './pages/Manage';
import { MembersList } from './pages/manage/MembersList';
import { Committee } from './pages/manage/Committee';
import { Invoices } from './pages/manage/Invoices';
import { Notices } from './pages/manage/Notices';
import { Analytics } from './pages/Analytics';
import { VentOverview } from './pages/vent/VentOverview';
import { VentIssues } from './pages/vent/VentIssues';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Public — standalone society registration page, no top nav */}
          <Route path="/register/society" element={<SocietyRegister />} />

          {/* Protected — everything else */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route element={<AdminRoute />}>
                <Route path="/manage" element={<Manage />} />
                <Route path="/manage/members" element={<MembersList />} />
                <Route path="/manage/committee" element={<Committee />} />
                <Route path="/manage/invoices" element={<Invoices />} />
                <Route path="/manage/notices" element={<Notices />} />
                <Route path="/analytics" element={<Analytics />} />
              </Route>
              {/* VENT — simple flat layout (no inner ribbon). Feed at /vent. */}
              <Route path="/vent" element={<VentOverview />} />
              <Route path="/vent/post" element={<VentIssues />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
