import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import GSLogo from "../components/GSLogo";
import Footer from "../components/Footer";

export default function Register() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", password: "" });
  const [busy, setBusy] = useState(false);
  const { register } = useAuth();
  const nav = useNavigate();

  const set = (k, v) => setForm({ ...form, [k]: v });

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await register(form);
      toast.success("Account created");
      nav("/shop");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Registration failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md glass-strong p-8">
          <div className="text-center mb-6">
            <div className="mx-auto mb-3 flex justify-center"><GSLogo size={48} /></div>
            <div className="label-cap">R I Billing Pro</div>
            <h1 className="text-2xl font-extrabold mt-1">Create your GS account</h1>
            <p className="text-sm text-slate-500 mt-1">Shop online, track orders, and save your wishlist.</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            <Field label="Full name">
              <input required value={form.name} onChange={(e) => set("name", e.target.value)} data-testid="reg-name" className="field" />
            </Field>
            <Field label="Email">
              <input required type="email" value={form.email} onChange={(e) => set("email", e.target.value)} data-testid="reg-email" className="field" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone"><input value={form.phone} onChange={(e) => set("phone", e.target.value)} data-testid="reg-phone" className="field font-mono-num" /></Field>
              <Field label="Password"><input required minLength={6} type="password" value={form.password} onChange={(e) => set("password", e.target.value)} data-testid="reg-password" className="field" /></Field>
            </div>
            <Field label="Delivery address">
              <textarea rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} data-testid="reg-address" className="field pt-2" style={{ height: "auto" }} />
            </Field>
            <button
              type="submit" disabled={busy}
              data-testid="reg-submit"
              className="btn-primary w-full h-12 rounded-xl flex items-center justify-center gap-2"
            >
              {busy ? "Creating…" : "Create account"} <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-200 text-center text-sm text-slate-500">
            Have an account?{" "}
            <Link to="/login" data-testid="go-login" className="font-semibold text-indigo-600 hover:underline">Sign in</Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="label-cap">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
