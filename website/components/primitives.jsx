// Reusable primitives — buttons, badges, motion helpers, magnetic hover, parallax, scroll utilities.
const motion = window.Motion || window.FramerMotion;
const M = motion ? motion.motion : null;
const useScroll = motion ? motion.useScroll : null;
const useTransform = motion ? motion.useTransform : null;
const useMotionValue = motion ? motion.useMotionValue : null;
const useSpring = motion ? motion.useSpring : null;
const AnimatePresence = motion ? motion.AnimatePresence : ({ children }) => children;

// Fade-up wrapper
const FadeUp = ({ children, delay = 0, y = 28, duration = 0.8, className = "", as = "div" }) => {
  if (!M) return <div className={className}>{children}</div>;
  const Tag = M[as] || M.div;
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration, delay, ease: [0.2, 0.7, 0.2, 1] }}
    >
      {children}
    </Tag>
  );
};

// Mask reveal (text) — uses initial+animate so above-the-fold copy reveals immediately
const MaskText = ({ children, delay = 0, className = "" }) => {
  if (!M) return <span className={className}>{children}</span>;
  return (
    <span className={`inline-block overflow-hidden align-bottom leading-[1.1] pb-[0.08em] ${className}`}>
      <M.span
        className="inline-block"
        initial={{ y: '110%' }}
        animate={{ y: 0 }}
        transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </M.span>
    </span>
  );
};

const Stagger = ({ children, className = "", stagger = 0.08 }) => {
  if (!M) return <div className={className}>{children}</div>;
  return (
    <M.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.15 }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger } } }}
    >
      {children}
    </M.div>
  );
};

const Item = ({ children, className = "", y = 22 }) => {
  if (!M) return <div className={className}>{children}</div>;
  return (
    <M.div
      className={className}
      variants={{
        hidden: { opacity: 0, y },
        show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.2, 0.7, 0.2, 1] } },
      }}
    >
      {children}
    </M.div>
  );
};

// Parallax scroll wrapper
const Parallax = ({ children, speed = -60, className = "" }) => {
  const ref = React.useRef(null);
  if (!M || !useScroll || !useTransform) return <div ref={ref} className={className}>{children}</div>;
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, speed]);
  return <M.div ref={ref} style={{ y }} className={className}>{children}</M.div>;
};

// Magnetic button — follows cursor slightly
const Magnetic = ({ children, strength = 0.25, className = "" }) => {
  const ref = React.useRef(null);
  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left - r.width / 2) * strength;
    const y = (e.clientY - r.top - r.height / 2) * strength;
    ref.current.style.transform = `translate(${x}px, ${y}px)`;
  };
  const onLeave = () => { ref.current.style.transform = `translate(0,0)`; };
  return (
    <span ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} className={`magnetic inline-block ${className}`}>
      {children}
    </span>
  );
};

// Spotlight on hover
const Spotlight = ({ children, className = "" }) => {
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  return <div onMouseMove={onMove} className={`spotlight ${className}`}>{children}</div>;
};

// Hover-tilt — image/card responds to mouse position with 3D rotate
const HoverTilt = ({ children, className = "", max = 10, scale = 1.02 }) => {
  const ref = React.useRef(null);
  const onMove = (e) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(1400px) rotateY(${px * max}deg) rotateX(${-py * max}deg) scale(${scale})`;
    el.style.setProperty('--gx', `${(px + 0.5) * 100}%`);
    el.style.setProperty('--gy', `${(py + 0.5) * 100}%`);
  };
  const onLeave = () => {
    const el = ref.current; if (!el) return;
    el.style.transform = 'perspective(1400px) rotateY(0deg) rotateX(0deg) scale(1)';
  };
  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave}
      className={`hover-tilt ${className}`}
      style={{ transition: 'transform 0.4s cubic-bezier(0.22,1,0.36,1)', transformStyle: 'preserve-3d' }}>
      {children}
    </div>
  );
};

const Counter = ({ to, suffix = "", duration = 1.6, className = "" }) => {
  const [val, setVal] = React.useState(0);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) {
          const start = performance.now();
          const tick = (t) => {
            const p = Math.min(1, (t - start) / (duration * 1000));
            const eased = 1 - Math.pow(1 - p, 3);
            setVal(to * eased);
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          obs.disconnect();
        }
      });
    }, { threshold: 0.4 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [to, duration]);
  return <span ref={ref} className={`tabnums ${className}`}>{Math.round(val).toLocaleString('en-IN')}{suffix}</span>;
};

const Btn = ({ as = "a", href = "#", variant = "primary", size = "md", icon, iconRight, children, className = "", magnetic = false, ...rest }) => {
  const sizes = { sm: "h-9 px-4 text-sm", md: "h-11 px-5 text-[15px]", lg: "h-[52px] px-7 text-base" };
  const variants = {
    primary: "bg-rose text-white hover:bg-rose-dark shadow-[0_15px_40px_-10px_rgba(225,29,72,0.55)]",
    ghost:   "bg-transparent text-ink dark:text-paper border border-ink/15 dark:border-white/15 hover:border-rose hover:text-rose",
    teal:    "bg-teal text-white hover:bg-teal/90 shadow-[0_15px_40px_-10px_rgba(14,124,123,0.5)]",
    dark:    "bg-ink text-paper hover:bg-ink2",
    light:   "bg-white text-ink hover:bg-paper2 border border-line",
  };
  const Tag = as;
  const content = (
    <Tag
      href={href}
      className={`shine inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors ${sizes[size]} ${variants[variant]} ${className}`}
      {...rest}
    >
      {icon}
      <span>{children}</span>
      {iconRight}
    </Tag>
  );
  return magnetic ? <Magnetic strength={0.18}>{content}</Magnetic> : content;
};

const Eyebrow = ({ children, tone = "rose", className = "" }) => {
  const tones = {
    rose: "bg-rose-soft text-rose-dark border-rose/20 dark:bg-rose/10 dark:text-rose dark:border-rose/30",
    teal: "bg-teal-soft text-teal border-teal/20 dark:bg-teal/10 dark:border-teal/25",
    slate:"bg-paper2 text-ink border-line dark:bg-white/5 dark:text-paper dark:border-white/10",
    gold: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-400/30",
  };
  const dot = { rose: 'bg-rose', teal: 'bg-teal', slate: 'bg-ink', gold: 'bg-gold' };
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] ${tones[tone]} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot[tone]}`} />
      {children}
    </span>
  );
};

const SectionHead = ({ eyebrow, eyebrowTone = "rose", title, sub, align = "left", titleClass = "", layout = "wide" }) => {
  // Centered layout: stacked, narrow column.
  if (align === "center") {
    return (
      <div className="max-w-3xl mx-auto text-center">
        {eyebrow && <FadeUp><Eyebrow tone={eyebrowTone}>{eyebrow}</Eyebrow></FadeUp>}
        <FadeUp delay={0.05}>
          <h2 className={`font-display mt-5 text-4xl md:text-[56px] font-bold leading-[1.1] tracking-tight pb-1 ${titleClass}`}>{title}</h2>
        </FadeUp>
        {sub && (
          <FadeUp delay={0.1}>
            <p className="mt-5 text-lg text-[var(--muted)] leading-relaxed">{sub}</p>
          </FadeUp>
        )}
      </div>
    );
  }
  // Stacked-narrow legacy layout (in case someone passes layout="stack").
  if (layout === "stack") {
    return (
      <div className="max-w-3xl">
        {eyebrow && <FadeUp><Eyebrow tone={eyebrowTone}>{eyebrow}</Eyebrow></FadeUp>}
        <FadeUp delay={0.05}>
          <h2 className={`font-display mt-5 text-4xl md:text-[56px] font-bold leading-[1.1] tracking-tight pb-1 ${titleClass}`}>{title}</h2>
        </FadeUp>
        {sub && (
          <FadeUp delay={0.1}>
            <p className="mt-5 text-lg text-[var(--muted)] leading-relaxed">{sub}</p>
          </FadeUp>
        )}
      </div>
    );
  }
  // Default "wide" layout: title + eyebrow on the left, sub on the right — uses full container width.
  return (
    <div className="grid lg:grid-cols-12 gap-x-10 gap-y-6 lg:items-end">
      <div className="lg:col-span-7 xl:col-span-8">
        {eyebrow && <FadeUp><Eyebrow tone={eyebrowTone}>{eyebrow}</Eyebrow></FadeUp>}
        <FadeUp delay={0.05}>
          <h2 className={`font-display mt-5 text-4xl md:text-[56px] xl:text-[64px] font-bold leading-[1.05] tracking-tight pb-1 ${titleClass}`}>{title}</h2>
        </FadeUp>
      </div>
      {sub && (
        <FadeUp delay={0.1}>
          <div className="lg:col-span-5 xl:col-span-4 lg:pb-3">
            <p className="text-lg text-[var(--muted)] leading-relaxed lg:border-l lg:border-[var(--line)] lg:pl-6">{sub}</p>
          </div>
        </FadeUp>
      )}
    </div>
  );
};

const Section = ({ id, className = "", children, container = true }) => (
  <section id={id} className={`relative py-24 md:py-32 ${className}`}>
    {container ? <div className="mx-auto max-w-7xl px-6 lg:px-10 relative">{children}</div> : children}
  </section>
);

// Background blobs
const Blobs = ({ tone = "rose" }) => {
  const a = tone === "teal" ? "bg-teal/30" : "bg-rose/25";
  const b = tone === "teal" ? "bg-cyan-300/30" : "bg-amber-300/30";
  return (
    <>
      <div className={`blob ${a} -top-32 -left-20 w-[500px] h-[500px]`} />
      <div className={`blob ${b} top-1/3 -right-32 w-[600px] h-[600px]`} style={{ animationDelay: '-8s' }} />
    </>
  );
};

// Lazy-loading video — only loads + plays when visible, pauses + can unload when offscreen.
// Uses poster while idle so the page never waits on multiple parallel video downloads.
const LazyVideo = ({ src, poster, className = "", aspect, rootMargin = '300px' }) => {
  const ref = React.useRef(null);
  const [active, setActive] = React.useState(false);
  React.useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([en]) => {
      if (en.isIntersecting) {
        setActive(true);
        const v = el.querySelector('video');
        if (v) { try { v.play().catch(() => {}); } catch(e){} }
      } else {
        const v = el.querySelector('video');
        if (v) { try { v.pause(); } catch(e){} }
      }
    }, { rootMargin });
    obs.observe(el);
    return () => obs.disconnect();
  }, [rootMargin]);
  const style = aspect ? { aspectRatio: aspect } : undefined;
  return (
    <div ref={ref} className={className} style={style}>
      {active ? (
        <video src={src} poster={poster} autoPlay loop muted playsInline preload="metadata" className="w-full h-full block object-cover" />
      ) : poster ? (
        <img src={poster} alt="" loading="lazy" decoding="async" className="w-full h-full block object-cover"/>
      ) : (
        <div className="w-full h-full bg-slate-900"/>
      )}
    </div>
  );
};

// Lazy image — adds native lazy loading + async decoding
const LazyImg = ({ src, alt = "", className = "", ...rest }) => (
  <img src={src} alt={alt} loading="lazy" decoding="async" className={className} {...rest} />
);

Object.assign(window, { FadeUp, MaskText, Stagger, Item, Parallax, Magnetic, Spotlight, HoverTilt, Counter, Btn, Eyebrow, SectionHead, Section, Blobs, M, AnimatePresence, LazyVideo, LazyImg });
