import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore.js';
import LoginScreen from './LoginScreen.jsx';
import PendingApprovalScreen from './PendingApprovalScreen.jsx';

// Wraps the app shell. Routes by authStatus:
//   unknown — splash while /api/auth/me resolves
//   guest   — LoginScreen
//   pending — PendingApprovalScreen (signed in but not yet approved)
//   authed  — app shell renders
export default function AuthGate({ children }) {
  const authStatus = useAppStore((s) => s.authStatus);
  const loadAuth = useAppStore((s) => s.loadAuth);

  useEffect(() => {
    if (authStatus === 'unknown') loadAuth();
  }, [authStatus, loadAuth]);

  if (authStatus === 'unknown') {
    return (
      <div className="min-h-screen grid place-items-center text-ink-400 text-sm">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-peach-500 animate-ping" />
          <span>Loading…</span>
        </div>
      </div>
    );
  }

  if (authStatus === 'guest') return <LoginScreen />;
  if (authStatus === 'pending') return <PendingApprovalScreen />;
  return children;
}
