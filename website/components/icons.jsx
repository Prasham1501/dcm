// Lightweight icon set (lucide-style) — pure SVG to avoid CDN dependency.
const Icon = ({ d, size = 18, stroke = 1.8, className = "", children }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size} height={size}
    viewBox="0 0 24 24"
    fill="none" stroke="currentColor"
    strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
    className={className}
  >
    {d ? <path d={d} /> : children}
  </svg>
);

const I = {
  ArrowRight: (p) => <Icon {...p}><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></Icon>,
  Check:      (p) => <Icon {...p}><path d="M20 6 9 17l-5-5"/></Icon>,
  CreditCard: (p) => <Icon {...p}><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M6 15h4"/></Icon>,
  ToggleRight:(p) => <Icon {...p}><rect x="2" y="6" width="20" height="12" rx="6"/><circle cx="16" cy="12" r="3" fill="currentColor"/></Icon>,
  Trash:      (p) => <Icon {...p}><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/></Icon>,
  Download:   (p) => <Icon {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></Icon>,
  Windows:    (p) => <Icon {...p}><path d="M3 5.5 10 4.5v7H3z"/><path d="M11 4.4 21 3v8.5H11z"/><path d="M3 12.5h7v7L3 18.5z"/><path d="M11 12.5h10V21l-10-1.4z"/></Icon>,
  Key:        (p) => <Icon {...p}><circle cx="7.5" cy="15.5" r="3.5"/><path d="m10 13 10-10"/><path d="m17 6 3 3"/><path d="m14 9 3 3"/></Icon>,
  Sun:        (p) => <Icon {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m4.93 19.07 1.41-1.41"/><path d="m17.66 6.34 1.41-1.41"/></Icon>,
  Moon:       (p) => <Icon {...p}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></Icon>,
  Menu:       (p) => <Icon {...p}><path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/></Icon>,
  X:          (p) => <Icon {...p}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></Icon>,
  Sparkles:   (p) => <Icon {...p}><path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 17v4"/><path d="M17 19h4"/></Icon>,
  Brain:      (p) => <Icon {...p}><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2z"/></Icon>,
  Layers:     (p) => <Icon {...p}><path d="m12 2 9 5-9 5-9-5 9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/></Icon>,
  Cube:       (p) => <Icon {...p}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.27 6.96 8.73 5.05 8.73-5.05"/><path d="M12 22V12"/></Icon>,
  Wallet:     (p) => <Icon {...p}><path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1"/><path d="M16 12h5v4h-5a2 2 0 0 1 0-4z"/></Icon>,
  Printer:    (p) => <Icon {...p}><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/></Icon>,
  Server:     (p) => <Icon {...p}><rect x="2" y="3" width="20" height="8" rx="2"/><rect x="2" y="13" width="20" height="8" rx="2"/><path d="M6 7h.01"/><path d="M6 17h.01"/></Icon>,
  Shield:     (p) => <Icon {...p}><path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6z"/></Icon>,
  Lock:       (p) => <Icon {...p}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></Icon>,
  Eye:        (p) => <Icon {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></Icon>,
  Activity:   (p) => <Icon {...p}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></Icon>,
  Plus:       (p) => <Icon {...p}><path d="M12 5v14"/><path d="M5 12h14"/></Icon>,
  Minus:      (p) => <Icon {...p}><path d="M5 12h14"/></Icon>,
  Quote:      (p) => <Icon {...p}><path d="M3 21c0-6 3-9 7-9V8L3 14V8a5 5 0 0 1 5-5"/><path d="M14 21c0-6 3-9 7-9V8l-7 6V8a5 5 0 0 1 5-5"/></Icon>,
  Mail:       (p) => <Icon {...p}><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></Icon>,
  Phone:      (p) => <Icon {...p}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.33 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></Icon>,
  ChevronDown:(p) => <Icon {...p}><path d="m6 9 6 6 6-6"/></Icon>,
  ChevronRight:(p)=> <Icon {...p}><path d="m9 6 6 6-6 6"/></Icon>,
  Star:       (p) => <Icon {...p}><path d="m12 2 3 7 7 .8-5.4 4.6 1.6 7L12 17.8 5.8 21.4l1.6-7L2 9.8 9 9z"/></Icon>,
  Cpu:        (p) => <Icon {...p}><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3"/><path d="M15 1v3"/><path d="M9 20v3"/><path d="M15 20v3"/><path d="M20 9h3"/><path d="M20 14h3"/><path d="M1 9h3"/><path d="M1 14h3"/></Icon>,
  HardDrive:  (p) => <Icon {...p}><path d="M22 12H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><path d="M6 16h.01"/><path d="M10 16h.01"/></Icon>,
  Wifi:       (p) => <Icon {...p}><path d="M5 12.55a11 11 0 0 1 14 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><path d="M12 20h.01"/></Icon>,
  Folder:     (p) => <Icon {...p}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></Icon>,
  Cloud:      (p) => <Icon {...p}><path d="M17.5 19a4.5 4.5 0 1 0-1.41-8.78A6 6 0 1 0 7 17"/><path d="M17.5 19H7"/></Icon>,
  Heart:      (p) => <Icon {...p}><path d="M19 14c1.5-1.5 3-3.5 3-5.5A5.5 5.5 0 0 0 16.5 3 5.5 5.5 0 0 0 12 5.5 5.5 5.5 0 0 0 7.5 3 5.5 5.5 0 0 0 2 8.5c0 2 1.5 4 3 5.5l7 7z"/></Icon>,
  Baby:       (p) => <Icon {...p}><path d="M9 12h.01"/><path d="M15 12h.01"/><path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1"/></Icon>,
  FileText:   (p) => <Icon {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></Icon>,
  Zap:        (p) => <Icon {...p}><path d="M13 2 3 14h7l-1 8 10-12h-7z"/></Icon>,
  Building:   (p) => <Icon {...p}><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></Icon>,
  Stethoscope:(p) => <Icon {...p}><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6 6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></Icon>,
  Cross:      (p) => <Icon {...p}><path d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2c0 1.1.9 2 2 2h5v5c0 1.1.9 2 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2h-2z"/></Icon>,
  Search:     (p) => <Icon {...p}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></Icon>,
  Maximize:   (p) => <Icon {...p}><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></Icon>,
  Ruler:      (p) => <Icon {...p}><path d="M21.3 15.3 8.7 2.7a1 1 0 0 0-1.4 0L2.7 7.3a1 1 0 0 0 0 1.4l12.6 12.6a1 1 0 0 0 1.4 0l4.6-4.6a1 1 0 0 0 0-1.4z"/><path d="m7.5 10.5 2 2"/><path d="m10.5 7.5 2 2"/><path d="m13.5 4.5 2 2"/><path d="m4.5 13.5 2 2"/></Icon>,
  Triangle:   (p) => <Icon {...p}><path d="m12 3 10 17H2z"/></Icon>,
  Circle:     (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/></Icon>,
  Square:     (p) => <Icon {...p}><rect x="3" y="3" width="18" height="18" rx="2"/></Icon>,
  Pen:        (p) => <Icon {...p}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></Icon>,
  Type:       (p) => <Icon {...p}><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></Icon>,
  Globe:      (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/></Icon>,
  RefreshCw:  (p) => <Icon {...p}><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></Icon>,
  Box:        (p) => <Icon {...p}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></Icon>,
  Users:      (p) => <Icon {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></Icon>,
  Network:    (p) => <Icon {...p}><rect x="9" y="2" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="16" y="16" width="6" height="6" rx="1"/><path d="M5 16v-2a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2"/><path d="M12 8v4"/></Icon>,
  PlayCircle: (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z" fill="currentColor"/></Icon>,
  Receipt:    (p) => <Icon {...p}><path d="M4 2h16v20l-3-2-3 2-2-2-3 2-3-2-2 2z"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/></Icon>,
  Compass:    (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6z"/></Icon>,
  Bone:       (p) => <Icon {...p}><path d="M17 10c.7-.7 1.7-1 2.7-.7a3 3 0 0 1-1.4 5.7c0 1 .3 2-.7 3a3 3 0 0 1-5-3l-3-3a3 3 0 0 1-3-5c1-1 2-.7 3-.7a3 3 0 0 1 5.7-1.4c.3 1 0 2-.7 2.7L19 8z"/></Icon>,
  Filter:     (p) => <Icon {...p}><path d="M3 6h18"/><path d="M7 12h10"/><path d="M10 18h4"/></Icon>,
  Settings:   (p) => <Icon {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></Icon>,
  Send:       (p) => <Icon {...p}><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></Icon>,
  FolderOpen: (p) => <Icon {...p}><path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2"/></Icon>,
  Banknote:   (p) => <Icon {...p}><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01"/><path d="M18 12h.01"/></Icon>,
  User:       (p) => <Icon {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></Icon>,
  ArrowDown:  (p) => <Icon {...p}><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></Icon>,
  Calendar:   (p) => <Icon {...p}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/></Icon>,
  MessageCircle: (p) => <Icon {...p}><path d="M21 12a9 9 0 1 1-3.5-7.1L21 3v6h-6"/></Icon>,
  MapPin:     (p) => <Icon {...p}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></Icon>,
  Bell:       (p) => <Icon {...p}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9z"/><path d="M10 21a2 2 0 0 0 4 0"/></Icon>,
  Bug:        (p) => <Icon {...p}><path d="M8 2 5 5"/><path d="m16 2 3 3"/><rect x="6" y="7" width="12" height="13" rx="6"/><path d="M12 7v13"/><path d="M3 13h3"/><path d="M18 13h3"/><path d="m4 8 2 2"/><path d="m20 8-2 2"/><path d="m4 18 2-2"/><path d="m20 18-2-2"/></Icon>,
  Gift:       (p) => <Icon {...p}><path d="M3 8h18v4H3z"/><path d="M12 8v14"/><path d="M5 12v10h14V12"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/></Icon>,
  BarChart:   (p) => <Icon {...p}><path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="7"/><rect x="12" y="7" width="3" height="11"/><rect x="17" y="14" width="3" height="4"/></Icon>,
  Home:       (p) => <Icon {...p}><path d="m3 11 9-8 9 8v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z"/></Icon>,
  Monitor:    (p) => <Icon {...p}><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></Icon>,
  LogOut:     (p) => <Icon {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></Icon>,
};

window.I = I;
window.Icon = Icon;
