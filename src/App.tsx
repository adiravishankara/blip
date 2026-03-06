import { AuthProvider, useAuth } from './context/AuthContext';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { ScrapingWorker } from './components/ScrapingWorker';
import { ScrapingProvider } from './context/ScrapingContext';

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <>
      {user ? <Dashboard /> : <Auth />}
      {user && <ScrapingWorker />}
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <ScrapingProvider>
        <AppContent />
      </ScrapingProvider>
    </AuthProvider>
  );
}

export default App;
