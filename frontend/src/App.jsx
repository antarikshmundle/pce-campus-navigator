import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AdminLogin from './pages/AdminLogin.jsx'
import { hasValidSession } from './admin/adminApi.js'
import { CampusDataProvider } from './features/locations/CampusDataProvider.jsx'
import { SavedPlacesProvider } from './features/saved/SavedPlacesProvider.jsx'
import { AppShell } from './layout/AppShell.jsx'
import MapLayout from './layout/MapLayout.jsx'
import ExploreScreen from './screens/ExploreScreen.jsx'
import LocationDetailScreen from './screens/LocationDetailScreen.jsx'
import RoutePreviewScreen from './screens/RoutePreviewScreen.jsx'
import NavigationScreen from './screens/NavigationScreen.jsx'
import ProfileScreen from './screens/ProfileScreen.jsx'
import SavedScreen from './screens/SavedScreen.jsx'

// Nearby (and its bundled local-place data) loads on first visit.
const NearbyScreen = lazy(() => import('./screens/NearbyScreen.jsx'))
const NearbyPlaceScreen = lazy(() => import('./screens/NearbyPlaceScreen.jsx'))
// Admin control centre: its own chunk, never downloaded by students.
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'))

function RequireAuth({ children }) {
  // Missing or expired token → sign in (the API re-checks every request).
  if (!hasValidSession()) return <Navigate to="/admin/login" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* New user experience */}
        <Route
          element={
            <CampusDataProvider>
              <SavedPlacesProvider>
                <AppShell />
              </SavedPlacesProvider>
            </CampusDataProvider>
          }
        >
          {/* Map screens share one persistent map instance */}
          <Route element={<MapLayout />}>
            <Route index element={<ExploreScreen />} />
            <Route path="place/:placeId" element={<LocationDetailScreen />} />
            <Route path="route" element={<RoutePreviewScreen />} />
            <Route path="navigate" element={<NavigationScreen />} />
            <Route path="nearby" element={<Suspense fallback={null}><NearbyScreen /></Suspense>} />
            <Route path="nearby/place/:placeKey" element={<Suspense fallback={null}><NearbyPlaceScreen /></Suspense>} />
          </Route>
          <Route path="saved" element={<SavedScreen />} />
          <Route path="profile" element={<ProfileScreen />} />
        </Route>

        {/* Admin (separate from student navigation) */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin/*"
          element={
            <RequireAuth>
              <Suspense fallback={null}>
                <AdminApp />
              </Suspense>
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
