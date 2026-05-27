import { Route, Routes } from 'react-router';

import { RootLayout } from '@/components/layout/RootLayout';
import { HomePage } from '@/pages/Home/HomePage';

// Route table. Add new pages here, not in main.tsx.
function App() {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route index element={<HomePage />} />
      </Route>
    </Routes>
  );
}

export default App;
