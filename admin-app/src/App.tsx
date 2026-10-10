import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AreaOfficesPage } from '@/pages/AreaOfficesPage'
import { BanksPage } from '@/pages/BanksPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ReportPreparedByPage } from '@/pages/ReportPreparedByPage'
import { SearchPage } from '@/pages/SearchPage'
import { VisitPersonsPage } from '@/pages/VisitPersonsPage'

export default function App() {
  return (
    <BrowserRouter basename="/admin">
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/dashboard/banks" element={<BanksPage />} />
        <Route path="/dashboard/area-offices" element={<AreaOfficesPage />} />
        <Route path="/dashboard/visit-persons" element={<VisitPersonsPage />} />
        <Route
          path="/dashboard/report-prepared-by"
          element={<ReportPreparedByPage />}
        />
        <Route path="/dashboard/search" element={<SearchPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
