/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { TableSkeletonLoader } from './components/common/StateViews';
import { GlobalModals } from './components/layout/GlobalModals';
import { Sidebar } from './components/layout/Sidebar';
import { TopHeader } from './components/layout/TopHeader';
import { VersionDbProvider, useVersionDb } from './context/VersionDbContext';
import { AdminApprovalsScreen } from './screens/AdminApprovalsScreen';
import { AuditLogsScreen } from './screens/AuditLogsScreen';
import {
  ForgotPasswordScreen,
  LoginScreen,
  ResetPasswordScreen,
} from './screens/AuthScreens';
import { BranchesScreen } from './screens/BranchesScreen';
import { ChangesDiffScreen } from './screens/ChangesDiffScreen';
import { CommitsHistoryScreen } from './screens/CommitsHistoryScreen';
import { ConflictResolutionScreen } from './screens/ConflictResolutionScreen';
import { DataLineageScreen } from './screens/DataLineageScreen';
import {
  NotificationsScreen,
  OnboardingScreen,
  ProfileAccountScreen,
  WorkspacesScreen,
} from './screens/EssentialPages';
import { MembersPermissionsScreen } from './screens/MembersPermissionsScreen';
import { MergeRequestsScreen } from './screens/MergeRequestsScreen';
import { OverviewScreen } from './screens/OverviewScreen';
import { RepositoriesScreen } from './screens/RepositoriesScreen';
import { SchemaExplorerScreen } from './screens/SchemaExplorerScreen';
import { SchemaVersionsScreen } from './screens/SchemaVersionsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SqlWorkspaceScreen } from './screens/SqlWorkspaceScreen';
import {
  AccessDenied403Screen,
  NotFound404Screen,
  ServerError500Screen,
} from './screens/StatusScreens';
import { TableDataScreen } from './screens/TableDataScreen';
import { TimeMachineScreen } from './screens/TimeMachineScreen';

const VersionDbShell: React.FC = () => {
  const { activeScreen, authState } = useVersionDb();

  if (authState.isInitialLoading) {
    return (
      <div className="min-h-screen bg-background text-on-surface flex flex-col justify-center items-center p-8">
        <div className="w-full max-w-4xl space-y-4">
          <div className="flex items-center gap-2 font-code-sm text-code-sm text-secondary">
            <span className="material-symbols-outlined text-primary text-base animate-spin">
              sync
            </span>
            <span>Checking VersionDB backend session...</span>
          </div>
          <TableSkeletonLoader rows={5} columns={5} />
        </div>
      </div>
    );
  }

  // Full-screen Authentication routes
  if (activeScreen === 'login') {
    return (
      <>
        <LoginScreen />
        <GlobalModals />
      </>
    );
  }
  if (activeScreen === 'forgot-password') {
    return (
      <>
        <ForgotPasswordScreen />
        <GlobalModals />
      </>
    );
  }
  if (activeScreen === 'reset-password') {
    return (
      <>
        <ResetPasswordScreen />
        <GlobalModals />
      </>
    );
  }

  const renderScreen = () => {
    switch (activeScreen) {
      case 'overview':
        return <OverviewScreen />;
      case 'workspaces':
        return <WorkspacesScreen />;
      case 'onboarding':
        return <OnboardingScreen />;
      case 'repositories':
        return <RepositoriesScreen />;
      case 'sql-workspace':
        return <SqlWorkspaceScreen />;
      case 'schema-explorer':
        return <SchemaExplorerScreen />;
      case 'table-data':
        return <TableDataScreen />;
      case 'branches':
        return <BranchesScreen />;
      case 'commits-and-history':
        return <CommitsHistoryScreen />;
      case 'changes-and-diff':
        return <ChangesDiffScreen />;
      case 'merge-requests':
        return <MergeRequestsScreen />;
      case 'conflict-resolution':
        return <ConflictResolutionScreen />;
      case 'time-machine':
        return <TimeMachineScreen />;
      case 'data-lineage':
        return <DataLineageScreen />;
      case 'schema-versions':
        return <SchemaVersionsScreen />;
      case 'audit-logs':
        return <AuditLogsScreen />;
      case 'members-and-permissions':
        return <MembersPermissionsScreen />;
      case 'admin-approvals':
        return <AdminApprovalsScreen />;
      case 'notifications':
        return <NotificationsScreen />;
      case 'profile':
        return <ProfileAccountScreen />;
      case 'settings':
        return <SettingsScreen />;
      case '403':
        return <AccessDenied403Screen />;
      case '404':
        return <NotFound404Screen />;
      case '500':
        return <ServerError500Screen is503={false} />;
      case '503':
        return <ServerError500Screen is503={true} />;
      default:
        return <NotFound404Screen />;
    }
  };

  return (
    <div className="min-h-screen bg-background font-body-md text-on-surface antialiased">
      <TopHeader />
      <Sidebar />
      <div className="pl-64">
        <main className="w-full pt-14 px-gutter-desktop min-h-screen bg-background">
          {renderScreen()}
        </main>
      </div>
      <GlobalModals />
    </div>
  );
};

export default function App() {
  return (
    <VersionDbProvider>
      <VersionDbShell />
    </VersionDbProvider>
  );
}
