import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { updateProfile } from "../lib/api";
import { toast } from "sonner";
import { User, Mail, Phone, MapPin, Save } from "lucide-react";

export default function Account() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ name: user?.name || "", phone: user?.phone || "", address: user?.address || "" });
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await updateProfile(form);
      setUser(u);
      toast.success("Profile updated");
    } catch { toast.error("Failed to update"); }
    finally { setBusy(false); }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8">
      <header className="mb-6">
        <div className="label-cap">Profile</div>
        <h1 className="text-3xl font-extrabold">My Account</h1>
      </header>

      <div className="glass-strong p-6 flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-xl font-bold">
          {(user?.name || "?").slice(0, 1).toUpperCase()}
        </div>
        <div>
          <div className="text-lg font-bold">{user?.name}</div>
          <div className="text-sm text-slate-500 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {user?.email}</div>
          <div className="text-xs text-slate-400 mt-1">Role: {user?.role}</div>
        </div>
      </div>

      <form onSubmit={save} className="glass p-6 space-y-4">
        <label className="block">
          <span className="label-cap flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Name</span>
          <input data-testid="acc-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="field mt-1" />
        </label>
        <label className="block">
          <span className="label-cap flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Phone</span>
          <input data-testid="acc-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="field mt-1 font-mono-num" />
        </label>
        <label className="block">
          <span className="label-cap flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Delivery address</span>
          <textarea data-testid="acc-address" rows={3} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="field mt-1 pt-2" style={{ height: "auto" }} />
        </label>
        <button data-testid="acc-save" type="submit" disabled={busy} className="btn-primary w-full h-11 rounded-xl flex items-center justify-center gap-2">
          <Save className="w-4 h-4" /> {busy ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}
