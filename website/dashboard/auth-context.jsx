// Auth context — single source of truth for the logged-in user.
// Wrap any component tree that needs auth in <AuthProvider>.

const AuthCtx = React.createContext(null);

const AuthProvider = ({ children }) => {
  const [user, setUser] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('mv:user') || 'null'); } catch { return null; }
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const handleAuth = async (fn) => {
    setLoading(true); setError(null);
    try {
      const { user: u } = await fn();
      setUser(u);
      return u;
    } catch (e) {
      setError(e.message || 'Something went wrong');
      throw e;
    } finally { setLoading(false); }
  };

  const value = {
    user, loading, error, setError,
    isAuthed: !!user,
    login:  (data) => handleAuth(() => mvApi.login(data)),
    signup: (data) => handleAuth(() => mvApi.signup(data)),
    google: (data) => handleAuth(() => mvApi.google(data)),
    logout: async () => { await mvApi.logout(); setUser(null); window.location.hash = '#/dashboard/login'; },
    refresh: async () => { try { const { user: u } = await mvApi.me(); setUser(u); } catch { setUser(null); } },
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
};

const useAuth = () => React.useContext(AuthCtx);

window.AuthProvider = AuthProvider;
window.useAuth = useAuth;
