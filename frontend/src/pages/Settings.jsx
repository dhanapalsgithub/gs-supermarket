import { useEffect, useState } from "react";
import { fetchSettings, updateSettings } from "../lib/api";
import { toast } from "sonner";
import { Settings as SettingsIcon, MessageSquare, CreditCard, CheckCircle2, XCircle, Info } from "lucide-react";

export default function Settings() {
  const [s, setS] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => fetchSettings().then(setS).catch(() => toast.error("Failed to load settings"));
  useEffect(() => { load(); }, []);

  const save = async (patch) => {
    setBusy(true);
    try {
      const updated = await updateSettings(patch);
      setS(updated);
      toast.success("Settings saved");
    } catch { toast.error("Failed to save"); }
    finally { setBusy(false); }
  };

  if (!s) return <div className="p-8 text-slate-500">Loading settings…</div>;

  const integ = s.integrations || {};

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <header className="mb-6">
        <div className="label-cap">Configuration</div>
        <h1 className="text-3xl font-extrabold flex items-center gap-2">
          <SettingsIcon className="w-7 h-7 text-indigo-500" /> Settings
        </h1>
      </header>

      {/* Payment Gateway */}
      <section className="glass p-6 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-4 h-4 text-indigo-500" />
          <div className="font-bold">Online Payment Gateway</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <GatewayCard
            id="SIMULATED"
            title="Simulated QR"
            desc="Demo QR + COD. No real money moves."
            active={s.payment_gateway === "SIMULATED"}
            ready={true}
            onSelect={() => save({ payment_gateway: "SIMULATED" })}
            tid="gw-simulated"
          />
          <GatewayCard
            id="STRIPE"
            title="Stripe"
            desc="Live card payments (test key in env)."
            active={s.payment_gateway === "STRIPE"}
            ready={!!integ.stripe}
            onSelect={() => save({ payment_gateway: "STRIPE" })}
            tid="gw-stripe"
          />
          <GatewayCard
            id="RAZORPAY"
            title="Razorpay"
            desc="UPI/cards/netbanking. Needs RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET."
            active={s.payment_gateway === "RAZORPAY"}
            ready={!!integ.razorpay}
            onSelect={() => save({ payment_gateway: "RAZORPAY" })}
            tid="gw-razorpay"
          />
        </div>
        <div className="mt-3 text-[11px] text-slate-500 flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            Add keys via <span className="font-semibold">Re-publish → Secrets</span>. When a gateway is selected and its keys are present, checkout switches from the simulated QR to a real payment flow.
          </span>
        </div>
      </section>

      {/* SMS */}
      <section className="glass p-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-4 h-4 text-indigo-500" />
          <div className="font-bold">SMS Notifications (Twilio)</div>
        </div>
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-slate-600">
            Text customers automatically when orders are <span className="font-semibold">shipped</span> or <span className="font-semibold">delivered</span>.
          </div>
          <button
            data-testid="sms-toggle"
            disabled={busy}
            onClick={() => save({ sms_enabled: !s.sms_enabled })}
            className={`w-14 h-8 rounded-full transition-colors relative ${s.sms_enabled ? "bg-indigo-500" : "bg-slate-200"}`}
          >
            <span
              className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all ${s.sms_enabled ? "left-7" : "left-1"}`}
            />
          </button>
        </div>
        <div className={`rounded-xl p-3 text-xs flex items-center gap-2 ${integ.twilio ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
          {integ.twilio ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {integ.twilio
            ? "Twilio keys detected — SMS is live."
            : "Twilio keys missing. Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER in Secrets to activate."}
        </div>
      </section>
    </div>
  );
}

function GatewayCard({ title, desc, active, ready, onSelect, tid }) {
  return (
    <button
      data-testid={tid}
      onClick={onSelect}
      className={`text-left p-4 rounded-2xl border transition-all ${
        active ? "bg-gradient-to-br from-indigo-50 to-violet-50 border-indigo-300 shadow-sm" : "bg-white border-slate-200 hover:border-indigo-300"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="font-bold text-sm">{title}</div>
        {ready ? (
          <span className="pill pill-paid flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Ready</span>
        ) : (
          <span className="pill pill-unpaid flex items-center gap-1"><XCircle className="w-3 h-3" /> Keys needed</span>
        )}
      </div>
      <div className="text-xs text-slate-500 mt-1">{desc}</div>
      {active && <div className="mt-2 text-[11px] font-bold text-indigo-600">ACTIVE</div>}
    </button>
  );
}
