import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function BannerSlider({ banners }: { banners: string[] }) {
  const validBanners = banners.filter((banner) => banner.trim().length > 0);
  const bannersKey = validBanners.join("|");
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    setCurrent(0);
    if (validBanners.length < 2) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % validBanners.length);
    }, 10000);
    return () => clearInterval(timer);
  }, [bannersKey, validBanners.length]);

  if (validBanners.length === 0) return null;

  return (
    <div className="relative w-full h-[160px] md:h-[220px] overflow-hidden rounded-2xl mb-4 shadow-lg">
      <img
        src={validBanners[current]}
        alt={`banner ${current}`}
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out"
      />
      {validBanners.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => setCurrent((prev) => (prev - 1 + validBanners.length) % validBanners.length)}
            aria-label="الصورة السابقة"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/35 p-2 text-white hover:bg-black/55"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setCurrent((prev) => (prev + 1) % validBanners.length)}
            aria-label="الصورة التالية"
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/35 p-2 text-white hover:bg-black/55"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        </>
      )}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
        {validBanners.map((_, i) => (
          <button
            type="button"
            key={i}
            onClick={() => setCurrent(i)}
            aria-label={`عرض الصورة ${i + 1}`}
            className={`w-2 h-2 rounded-full transition-all ${i === current ? "bg-white" : "bg-white/50"}`}
          />
        ))}
      </div>
    </div>
  );
}