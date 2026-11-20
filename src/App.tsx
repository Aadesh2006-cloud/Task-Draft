/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { RouterProvider, useRouter, Link } from './lib/router';
import { AuthProvider } from './lib/authContext';
import { AppShell } from './components/Layout';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { OnboardingProfilePage } from './pages/OnboardingProfilePage';
import { MarketplacePage } from './pages/MarketplacePage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { PostProjectWizardPage } from './pages/PostProjectWizardPage';
import { SubmitProposalPage } from './pages/SubmitProposalPage';
import { ApplicationsPage } from './pages/ApplicationsPage';
import { ContractAgreementPage } from './pages/ContractAgreementPage';
import { DashboardPage } from './pages/DashboardPage';
import { WorkspacesListPage } from './pages/WorkspacesListPage';
import { WorkspacePage } from './pages/WorkspacePage';
import { TalentsPage, SellerProfilePage } from './pages/SellerProfilePage';
import { InboxNotificationsPage } from './pages/InboxNotificationsPage';
import { ReviewsHistoryPage } from './pages/ReviewsHistoryPage';
import { TrustHelpPage } from './pages/TrustHelpPage';
import { AdminPage } from './pages/AdminPage';

function RouteSwitch() {
  const { path } = useRouter();
  const normalized = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;

  if (normalized === '/') return <LandingPage />;
  if (normalized === '/auth') return <AuthPage />;
  if (normalized === '/onboarding') return <OnboardingProfilePage />;
  if (normalized === '/marketplace') return <MarketplacePage />;
  if (normalized === '/post-project') return <PostProjectWizardPage />;
  if (normalized === '/talents') return <TalentsPage />;
  if (normalized === '/dashboard') return <DashboardPage />;
  if (normalized === '/workspaces') return <WorkspacesListPage />;
  if (normalized === '/inbox') return <InboxNotificationsPage />;
  if (normalized === '/reviews') return <ReviewsHistoryPage />;
  if (normalized === '/trust') return <TrustHelpPage />;
  if (normalized === '/admin') return <AdminPage />;

  const sellerMatch = normalized.match(/^\/sellers\/(\d+)$/);
  if (sellerMatch) return <SellerProfilePage sellerId={Number(sellerMatch[1])} />;

  const applyMatch = normalized.match(/^\/projects\/(\d+)\/apply$/);
  if (applyMatch) return <SubmitProposalPage projectId={Number(applyMatch[1])} />;

  const appsMatch = normalized.match(/^\/projects\/(\d+)\/applications$/);
  if (appsMatch) return <ApplicationsPage projectId={Number(appsMatch[1])} />;

  const projectMatch = normalized.match(/^\/projects\/(\d+)$/);
  if (projectMatch) return <ProjectDetailPage projectId={Number(projectMatch[1])} />;

  const contractMatch = normalized.match(/^\/contracts\/(\d+)$/);
  if (contractMatch) return <ContractAgreementPage contractId={Number(contractMatch[1])} />;

  const workspaceMatch = normalized.match(/^\/workspace\/(\d+)$/);
  if (workspaceMatch) return <WorkspacePage workspaceId={Number(workspaceMatch[1])} />;

  return (
    <div className="max-w-lg mx-auto px-4 py-20 text-center">
      <p className="font-mono text-xs uppercase tracking-wider text-[#667085]">404</p>
      <h1 className="mt-2 font-display text-2xl font-bold text-[#101828]">Page not found</h1>
      <p className="mt-2 text-sm text-[#475467]">
        The route <span className="font-mono">{normalized}</span> does not match an active Briefline page.
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <Link
          to="/"
          className="px-4 py-2 text-sm font-semibold text-white bg-[#1E40AF] hover:bg-[#1E3A8A] rounded-lg"
        >
          Go Home
        </Link>
        <Link
          to="/marketplace"
          className="px-4 py-2 text-sm font-medium text-[#344054] bg-white border border-[#D0D5DD] rounded-lg"
        >
          Browse Projects
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <RouterProvider>
      <AuthProvider>
        <AppShell>
          <RouteSwitch />
        </AppShell>
      </AuthProvider>
    </RouterProvider>
  );
}
