import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { RequireAuth } from '@/components/RequireAuth'
import { AreaOfficesPage } from '@/pages/AreaOfficesPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { LoginPage } from '@/pages/LoginPage'
import { VisitPersonsPage } from '@/pages/VisitPersonsPage'

export default function App() {
  return (
    <BrowserRouter basename="/admin">
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/dashboard/area-offices"
          element={
            <RequireAuth>
              <AreaOfficesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/dashboard/visit-persons"
          element={
            <RequireAuth>
              <VisitPersonsPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
