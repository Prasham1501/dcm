// Root app — hash-based routing.
const App = () => {
  const [dark, setDark] = React.useState(true);
  const [route, setRoute] = React.useState(() => window.location.hash || '#/');

  // Lightweight perf pass: decorate every <img> with lazy-load + async decode (idempotent).
  React.useEffect(() => {
    const tag = () => {
      document.querySelectorAll('img:not([data-perf])').forEach(img => {
        if (!img.hasAttribute('loading')) img.setAttribute('loading', 'lazy');
        if (!img.hasAttribute('decoding')) img.setAttribute('decoding', 'async');
        img.setAttribute('data-perf', '1');
      });
    };
    tag();
    const obs = new MutationObserver(tag);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  React.useEffect(() => {
    const onHash = () => {
      setRoute(window.location.hash || '#/');
      window.scrollTo({ top: 0, behavior: 'instant' });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const Page = (() => {
    switch (route) {
      case '#/features': return <FeaturesPage/>;
      case '#/ai':       return <AIPage/>;
      case '#/bridge':   return typeof BridgePage !== 'undefined' ? <BridgePage/> : <HomePage/>;
      case '#/pricing':  return <PricingPage/>;
      case '#/download': return <DownloadPage/>;
      case '#/contact':  return <ContactPage/>;
      default:           return <HomePage/>;
    }
  })();

  return (
    <div className="relative min-h-screen">
      <Nav dark={dark} setDark={setDark} route={route} />
      <main key={route}>{Page}</main>
      <Footer />
      <FloatingBadge />
      <Tweaks />
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
