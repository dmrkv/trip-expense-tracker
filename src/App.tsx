import { Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell';
import GroupsListPage from './pages/GroupsListPage';
import GroupPage from './pages/GroupPage';
import SettingsPage from './pages/SettingsPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<GroupsListPage />} />
        <Route path="/group/:id" element={<GroupPage />} />
        <Route path="/group/:id/:tab" element={<GroupPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
