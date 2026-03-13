'use client';

export default function TdfFilmLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px] gap-6">
      <div className="flex items-baseline gap-0.5 font-black tracking-tighter text-3xl md:text-4xl text-white">
        <span>TDF</span>
        <span
          className="text-orange-600 drop-shadow-[0_0_12px_rgba(234,88,12,0.8)]"
          style={{ animation: 'tdffilm-brightness-pulse 2.2s ease-in-out infinite' }}
        >
          FILM
        </span>
      </div>
    </div>
  );
}
