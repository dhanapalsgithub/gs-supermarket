import { useState, useEffect } from "react";
import { Send, Megaphone, CheckCircle2, Trash2, Edit3, X } from "lucide-react";
import { toast } from "sonner";
import { api, fetchActiveOffers, broadcastOffer, updateOffer, deleteOffer } from "./api"; // api.js இலிருந்து இறக்குமதி செய்தல்

export default function AdminOffers() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  
  const [offers, setOffers] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editMessage, setEditMessage] = useState("");

  // ஆஃபர்களை உடனுக்குடன் லோட் செய்தல்
  useEffect(() => {
    loadOffers();
  }, []);

  const loadOffers = async () => {
    try {
      const data = await fetchActiveOffers();
      setOffers(data || []);
    } catch (err) {
      console.error("Failed to load offers", err);
      toast.error("ஆஃபர்களை ஏற்றுவதில் தோல்வி ஏற்பட்டது");
    }
  };

  // புதிய ஆஃபர் Broadcast செய்ய
  const handleBroadcast = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    if (!confirm("ஆன்லைன் வாடிக்கையாளர்கள் அனைவருக்கும் இந்த ஆஃபர் அனுப்ப வேண்டுமா?")) return;

    setLoading(true);
    setResult(null);

    try {
      const data = await broadcastOffer({ message });
      setResult(data || { total_targeted: 0, sent: 0 });
      setMessage("");
      loadOffers(); // பட்டியலைப் புதுப்பிக்க
      toast.success("ஆஃபர் வெற்றிகரமாக அனுப்பப்பட்டது");
    } catch (err) {
      console.error("Broadcast error:", err);
      const errorMsg = err.response?.data?.detail || err.message || "ஆஃபர் அனுப்புவதில் தோல்வி ஏற்பட்டது";
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // ஆஃபரை நீக்க (Delete)
  const handleDelete = async (id) => {
    if (!confirm("இந்த ஆஃபரை நீக்க விரும்புகிறீர்களா?")) return;
    try {
      await deleteOffer(id);
      toast.success("ஆஃபர் நீக்கப்பட்டது");
      loadOffers();
    } catch (err) {
      toast.error("நீக்குவதில் தோல்வி ஏற்பட்டது");
    }
  };

  // ஆஃபரைப் புதுப்பிக்க (Update / Edit)
  const handleUpdate = async (id) => {
    if (!editMessage.trim()) return;
    try {
      await updateOffer(id, { message: editMessage });
      toast.success("ஆஃபர் மாற்றப்பட்டது");
      setEditingId(null);
      setEditMessage("");
      loadOffers();
    } catch (err) {
      toast.error("மாற்றுவதில் தோல்வி ஏற்பட்டது");
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8">
      <header className="mb-2">
        <div className="label-cap flex items-center gap-1.5">
          <Megaphone className="w-4 h-4 text-indigo-600" /> சந்தைப்படுத்தல் & விளம்பரங்கள்
        </div>
        <h1 className="text-3xl font-extrabold">வாடிக்கையாளர்களுக்கு ஆஃபர் அனுப்புங்கள்</h1>
      </header>

      {/* புதிய ஆஃபர் உருவாக்கும் பகுதி */}
      <div className="glass-strong p-6 rounded-2xl shadow-sm">
        <form onSubmit={handleBroadcast} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              புதிய விளம்பரச் செய்தி (Offer Message)
            </label>
            <textarea
              rows={4}
              className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white/80"
              placeholder="எ.கா: ஃபிளாஷ் விற்பனை! இன்று அனைத்து மளிகை பொருட்களுக்கும் 20% தள்ளுபடி..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 w-full md:w-auto px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {loading ? "அனுப்பப்படுகிறது..." : "ஆஃபரை broadcast செய்க"}
          </button>
        </form>

        {result && (
          <div className="mt-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-bold text-emerald-900">வெற்றிகரமாக அனுப்பப்பட்டது!</div>
              <p className="text-sm text-emerald-700 mt-0.5">
                மொத்த வாடிக்கையாளர்கள்: <strong>{result.total_targeted}</strong> | அனுப்பப்பட்டது: <strong>{result.sent}</strong>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ஏற்கனவே அனுப்பப்பட்ட ஆஃபர்களை நிர்வகிக்கும் பகுதி (Edit & Delete) */}
      <div className="glass-strong p-6 rounded-2xl shadow-sm space-y-4">
        <h2 className="text-xl font-bold text-slate-800">செயலில் உள்ள ஆஃபர்கள் (Manage Offers)</h2>
        
        {offers.length === 0 ? (
          <p className="text-sm text-slate-500">தற்போது எந்த ஆஃபர்களும் இல்லை.</p>
        ) : (
          <div className="space-y-3">
            {offers.map((offer) => {
              const offerId = offer.id || offer._id;
              const isEditing = editingId === offerId;

              return (
                <div key={offerId} className="p-4 bg-white/90 border border-slate-200 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  {isEditing ? (
                    <div className="flex-1 w-full space-y-2">
                      <textarea
                        rows={2}
                        className="w-full rounded-lg border border-slate-300 p-2 text-sm"
                        value={editMessage}
                        onChange={(e) => setEditMessage(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdate(offerId)}
                          className="px-4 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700"
                        >
                          சேமி (Save)
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-4 py-1.5 bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-300 flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" /> ரத்து (Cancel)
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-700 flex-1">{offer.message}</p>
                  )}

                  {!isEditing && (
                    <div className="flex items-center gap-2 self-end md:self-center">
                      <button
                        onClick={() => {
                          setEditingId(offerId);
                          setEditMessage(offer.message);
                        }}
                        className="p-2 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition"
                        title="Edit Offer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(offerId)}
                        className="p-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition"
                        title="Delete Offer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}