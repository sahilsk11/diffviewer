import { Navigate, Route, Routes, useLocation } from 'react-router';

import { RootLayout } from '@/components/layout/RootLayout';
import { normalizeGitHubPullRequestUrl, parseGitHubPullRequestUrl } from '@/lib/github-pr';
import { HomePage } from '@/pages/Home/HomePage';
import { LandingPage } from '@/pages/Landing/LandingPage';

function hasLoadablePullRequestUrl(search: string): boolean {
  const prParam = new URLSearchParams(search).get('pr');
  if (prParam === null) return false;
  const normalizedUrl = normalizeGitHubPullRequestUrl(prParam);
  return parseGitHubPullRequestUrl(normalizedUrl) !== null;
}

function DiffRoute(): React.ReactNode {
  const location = useLocation();

  if (!hasLoadablePullRequestUrl(location.search)) {
    return <Navigate to="/" replace />;
  }

  return <HomePage />;
}

// Route table. Add new pages here, not in main.tsx.
function App() {
  return (
    <Routes>
      <Route index element={<LandingPage />} />
      <Route element={<RootLayout />}>
        <Route path="diff" element={<DiffRoute />} />
      </Route>
    </Routes>
  );
}

export default App;
