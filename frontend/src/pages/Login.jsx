import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { Store, Mail, Lock, ArrowRight } from "lucide-react";
import Footer from "../components/Footer";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await login(email, password);
      toast.success(`Welcome back, ${u.name}`);
      nav(u.role === "admin" ? "/admin/pos" : (loc.state?.from || "/shop"));
    } catch (err) {
      toast.error(err.response?.data?.detail || "Login failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md glass-strong p-8">
          <div className="text-center mb-6">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/40 mb-3">
              <Store className="w-6 h-6" />
            </div>
            <div className="label-cap">R I Billing Pro</div>
            <h1 className="text-2xl font-extrabold mt-1">Sign in to CashierPro</h1>
            <p className="text-sm text-slate-500 mt-1">Owners, cashiers, and customers all sign in here.</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className="label-cap">Email</span>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  data-testid="login-email"
                  placeholder="you@example.com"
                  className="field pl-10"
                />
              </div>
            </label>
            <label className="block">
              <span className="label-cap">Password</span>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  required type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  data-testid="login-password"
                  placeholder="••••••••"
                  className="field pl-10"
                />
              </div>
            </label>
            <button
              type="submit" disabled={busy}
              data-testid="login-submit"
              className="btn-primary w-full h-12 rounded-xl flex items-center justify-center gap-2"
            >
              {busy ? "Signing in…" : "Sign in"} <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-200 text-center text-sm text-slate-500">
            No account?{" "}
            <Link to="/register" data-testid="go-register" className="font-semibold text-indigo-600 hover:underline">
              Create one
            </Link>
          </div>
          <div className="mt-4 text-[11px] text-center text-slate-400">
            Admin demo: smallbiz743@gmail.com / Admin@123
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
