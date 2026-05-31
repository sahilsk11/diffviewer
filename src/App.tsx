import { Navigate, Route, Routes, useLocation } from 'react-router';

import { RootLayout } from '@/components/layout/RootLayout';
import { normalizeGitHubPullRequestUrl, parseGitHubPullRequestUrl } from '@/lib/github-pr';
import { HomePage } from '@/pages/Home/HomePage';
import { LandingPage } from '@/pages/Landing/LandingPage';

function loadablePullRequestUrl(search: string): string | null {
  const prParam = new URLSearchParams(search).get('pr');
  if (prParam === null) return null;
  const normalizedUrl = normalizeGitHubPullRequestUrl(prParam);
  return parseGitHubPullRequestUrl(normalizedUrl) === null ? null : normalizedUrl;
}

function LandingRoute(): React.ReactNode {
  const location = useLocation();
  const normalizedUrl = loadablePullRequestUrl(location.search);

  if (normalizedUrl !== null) {
    return <Navigate to={`/diff?pr=${encodeURIComponent(normalizedUrl)}`} replace />;
  }

  return <LandingPage />;
}

function DiffRoute(): React.ReactNode {
  const location = useLocation();

  if (loadablePullRequestUrl(location.search) === null) {
    return <Navigate to="/" replace />;
  }

  return <HomePage />;
}

// Route table. Add new pages here, not in main.tsx.
function App() {
  return (
    <Routes>
      <Route index element={<LandingRoute />} />
      <Route element={<RootLayout />}>
        <Route path="diff" element={<DiffRoute />} />
      </Route>
    </Routes>
  );
}

export default App;
