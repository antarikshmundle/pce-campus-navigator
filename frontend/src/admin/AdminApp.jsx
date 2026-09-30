import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminDataProvider } from './AdminDataProvider.jsx'
import AdminLayout from './AdminLayout.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import LocationsPage from './pages/LocationsPage.jsx'
import CategoriesPage from './pages/CategoriesPage.jsx'
import DataHealthPage from './pages/DataHealthPage.jsx'
import SearchAnalyticsPage from './pages/SearchAnalyticsPage.jsx'
import AIAnalyticsPage from './pages/AIAnalyticsPage.jsx'
import PlaceUsagePage from './pages/PlaceUsagePage.jsx'
import LocalDiscoveryPage from './pages/LocalDiscoveryPage.jsx'
import SystemStatusPage from './pages/SystemStatusPage.jsx'

/** Admin control centre (Stage 11). Mounted at /admin/*, behind RequireAuth. */
export default function AdminApp() {
  return (
    <AdminDataProvider>
      <Routes>
        <Route element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="locations" element={<LocationsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="health" element={<DataHealthPage />} />
          <Route path="insights/search" element={<SearchAnalyticsPage />} />
          <Route path="insights/ai" element={<AIAnalyticsPage />} />
          <Route path="insights/places" element={<PlaceUsagePage />} />
          <Route path="discovery/nearby" element={<LocalDiscoveryPage layer="around" />} />
          <Route path="discovery/nagpur" element={<LocalDiscoveryPage layer="nagpur" />} />
          <Route path="system" element={<SystemStatusPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Routes>
    </AdminDataProvider>
  )
}
