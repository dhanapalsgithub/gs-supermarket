export default function Footer({ variant = "light" }) {
  return (
    <div
      className={`text-center text-[11px] py-3 tracking-wide ${
        variant === "dark" ? "text-slate-400" : "text-slate-500"
      }`}
      data-testid="app-footer"
    >
      Built by <span className="font-semibold text-indigo-500">R I Billing Pro</span>
      <span className="mx-2 opacity-40">•</span>
      Milestone Y50 · 58mm Bluetooth · © {new Date().getFullYear()}
    </div>
  );
}
