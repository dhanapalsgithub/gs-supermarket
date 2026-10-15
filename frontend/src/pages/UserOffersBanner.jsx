// Updated UserOffersBanner with Merged Background & Grocery Shopping Family Image
function UserOffersBanner() {
  const [offers, setOffers] = useState([]);

  useEffect(() => {
    fetch("/api/offers/active")
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setOffers(data); })
      .catch(() => {});
  }, []);

  if (offers.length === 0) return null;

  return (
    <div className="mb-6 space-y-3">
      {offers.map((offer) => (
        <div 
          key={offer.id || offer.created_at} 
          className="relative overflow-hidden bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 border-2 border-amber-300/80 p-3 rounded-2xl shadow-xl flex items-center gap-3.5"
        >
          {/* Left Side: Merged Family with Grocery Image (No circle border, smooth blend) */}
          <div className="relative flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden shadow-inner">
            <img 
              src="https://static.vecteezy.com/system/resources/previews/076/667/526/non_2x/indian-woman-in-traditional-saree-shopping-with-full-grocery-cart-isolated-on-transparent-background-free-png.png" 
              alt="Happy Family Grocery Shopping" 
              className="w-full h-full object-cover mix-blend-multiply opacity-95"
            />
            {/* Smooth Overlay Gradient to Merge seamlessly into Amber BG */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-amber-400/80 pointer-events-none" />
            <Sparkles className="w-4 h-4 text-amber-100 absolute -top-1 -right-1 animate-spin z-10" />
          </div>

          <div className="flex-1 overflow-hidden">
            {/* Title Tag */}
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-red-950 mb-1">
              <Tag className="w-3.5 h-3.5 text-emerald-800" />
              <span>குடும்ப சிறப்பு சலுகை (FAMILY SPECIAL OFFER)</span>
            </div>

            {/* Running / Marquee Text Effect */}
            <div className="relative w-full overflow-hidden whitespace-nowrap">
              <div className="inline-block animate-marquee font-extrabold text-sm text-red-950">
                <span className="inline-flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-emerald-800 inline" />
                  {offer.message}
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Marquee Keyframes */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          animation: marquee 12s linear infinite;
        }
      `}</style>
    </div>
  );
}