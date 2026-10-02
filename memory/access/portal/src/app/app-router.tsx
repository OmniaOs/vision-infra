import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AccountSettingsPage } from '@/features/account-settings/pages/account-settings-page'
import { AcceptInvitationPage } from '@/features/authentication/pages/accept-invitation-page'
import { LoginPage } from '@/features/authentication/pages/login-page'
import { InvitationLinkRedirectRoute } from '@/features/authentication/components/invitation-link-redirect-route'
import { RequireAdminRoute } from '@/features/authentication/components/require-admin-route'
import { RequireSessionRoute } from '@/features/authentication/components/require-session-route'
import { ApplicationShell } from '@/features/application-shell/components/application-shell'
import { NotFoundPage } from '@/features/application-shell/pages/not-found-page'
import { MemoryGraphPage } from '@/features/memory-graph/pages/memory-graph-page'
import { NotesPage } from '@/features/notes-explorer/pages/notes-page'
import { SpaceManagementPage } from '@/features/space-management/pages/space-management-page'
import { TokenManagementPage } from '@/features/token-management/pages/token-management-page'
import { UserManagementPage } from '@/features/user-management/pages/user-management-page'
import { HomeRedirect } from './home-redirect'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<InvitationLinkRedirectRoute />}>
          <Route path="/sign-in" element={<LoginPage />} />
          <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
          <Route element={<RequireSessionRoute />}>
            <Route element={<ApplicationShell />}>
              <Route index element={<HomeRedirect />} />
              <Route path="/notes" element={<NotesPage />} />
              <Route path="/memory-graph" element={<MemoryGraphPage />} />
              <Route path="/tokens" element={<TokenManagementPage />} />
              <Route path="/account" element={<AccountSettingsPage />} />
              <Route element={<RequireAdminRoute />}>
                <Route path="/people" element={<UserManagementPage />} />
                <Route path="/spaces" element={<SpaceManagementPage />} />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
