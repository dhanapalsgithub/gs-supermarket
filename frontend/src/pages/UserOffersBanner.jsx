import { useState, useEffect } from "react";
import { Megaphone, Tag } from "lucide-react";

export default function UserOffersBanner() {
  const [offers, setOffers] = useState([]);

  useEffect(() => {
    fetchOffers();
  }, []);

  const fetchOffers = async () => {
    try {
      const res = await fetch("/api/offers/active");
      const data = await res.json();
      if (res.ok) {
        setOffers(data);
      }
    } catch (err) {
      console.error("Failed to load offers", err);
    }
  };

  if (offers.length === 0) return null;

  return (
    <div className="my-4 space-y-3">
      {offers.map((offer) => (
        <div 
          key={offer.id} 
          className="bg-yellow-100 border border-yellow-300 p-4 rounded-2xl shadow-md flex items-start gap-3"
        >
          {/* ஐகான்கள் பச்சை நிறத்தில் (Green) */}
          <div className="bg-green-100 p-2 rounded-xl mt-0.5">
            <Megaphone className="w-5 h-5 text-green-600 animate-pulse" />
          </div>
          
          <div className="flex-1">
            {/* எழுத்துக்கள் மற்றும் தலைப்பு சிவப்பு நிறத்தில் (Red) */}
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-red-600 mb-1">
              <Tag className="w-3.5 h-3.5 text-green-600" /> சிறப்பு சலுகை (Special Offer)
            </div>
            <p className="text-sm font-semibold leading-relaxed text-red-700">
              {offer.message}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}