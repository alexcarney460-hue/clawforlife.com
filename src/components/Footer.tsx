export default function Footer() {
  return (
    <footer className="border-t border-white/5 py-12 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <a href="/" className="flex items-center gap-2">
          <img src="/logo.png" alt="OpenClaw Phones" className="h-8 w-auto" />
        </a>
        <p className="text-white/30 text-xs">
          © {new Date().getFullYear()} TerpTech LLC. All rights reserved.
        </p>
        <div className="flex gap-6 text-xs text-white/30">
          <a href="#" className="hover:text-[#00ff88] transition-colors">Terms</a>
          <a href="#" className="hover:text-[#00ff88] transition-colors">Privacy</a>
          <a href="#" className="hover:text-[#00ff88] transition-colors">Contact</a>
        </div>
      </div>
    </footer>
  );
}
