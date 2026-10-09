import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { RequireAuth } from '@/components/RequireAuth'
import { AreaOfficesPage } from '@/pages/AreaOfficesPage'
import { BanksPage } from '@/pages/BanksPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { LoginPage } from '@/pages/LoginPage'
import { ReportPreparedByPage } from '@/pages/ReportPreparedByPage'
import { SearchPage } from '@/pages/SearchPage'
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
          path="/dashboard/banks"
          element={
            <RequireAuth>
              <BanksPage />
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
        <Route
          path="/dashboard/report-prepared-by"
          element={
            <RequireAuth>
              <ReportPreparedByPage />
            </RequireAuth>
          }
        />
        <Route
          path="/dashboard/search"
          element={
            <RequireAuth>
              <SearchPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
