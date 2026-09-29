import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from './lib/wagmi-config';
import { WalletProvider } from './lib/wallet-context';
import { AuthProvider, useAuth } from './lib/admin-auth-context';
import { I18nProvider } from './lib/i18n';

import Layout from './components/layout/Layout';
import HomePage from './pages/HomePage';
import NFTAPage from './pages/NFTAPage';
import NFTBPage from './pages/NFTBPage';
import OxyTokenPage from './pages/OxyTokenPage';
import StakingPage from './pages/StakingPage';
import MarketplacePage from './pages/MarketplacePage';
import AdminPage from './pages/AdminPage';
import AdminLoginPage from './pages/AdminLoginPage';
import DocumentationPage from './pages/DocumentationPage';
import SmartContractsPage from './pages/SmartContractsPage';
import FAQPage from './pages/FAQPage';
import ResourcesPage from './pages/ResourcesPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsOfServicePage from './pages/TermsOfServicePage';

const queryClient = new QueryClient();

function AdminRoute() {
  const { session, role, isLoading, roleLoading } = useAuth();
  if (isLoading || (session && roleLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-ocean-200 border-t-ocean-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }
  if (!session) return <AdminLoginPage />;
  if (role === 'end_user') return <Navigate to="/" replace />;
  return <AdminPage />;
}

export default function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
        <BrowserRouter>
          <WalletProvider>
            <AuthProvider>
              <Routes>
                <Route element={<Layout />}>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/nft-a" element={<NFTAPage />} />
                  <Route path="/nft-b" element={<NFTBPage />} />
                  <Route path="/oxy" element={<OxyTokenPage />} />
                  <Route path="/staking" element={<StakingPage />} />
                  <Route path="/marketplace" element={<MarketplacePage />} />
                  <Route path="/admin" element={<AdminRoute />} />
                  <Route path="/docs" element={<DocumentationPage />} />
                  <Route path="/smart-contracts" element={<SmartContractsPage />} />
                  <Route path="/faq" element={<FAQPage />} />
                  <Route path="/resources" element={<ResourcesPage />} />
                  <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
                  <Route path="/terms-of-service" element={<TermsOfServicePage />} />
                </Route>
              </Routes>
            </AuthProvider>
          </WalletProvider>
        </BrowserRouter>
        </I18nProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
