'use client';

import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="border-t border-slate-800 bg-slate-950 py-12 mt-auto">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <h4 className="text-xl font-black tracking-tighter text-white mb-4">
            TDF<span className="text-orange-600">FILM</span>
          </h4>
          <p className="text-slate-500 text-sm leading-relaxed">{t('footer.mission')}</p>
        </div>
        <div>
          <h5 className="font-bold text-white mb-4 uppercase text-xs tracking-wider">{t('footer.explore')}</h5>
          <ul className="space-y-2 text-sm text-slate-500">
            <li><Link href="/locaciones" className="hover:text-orange-500 transition">{t('nav.locaciones')}</Link></li>
            <li><Link href="/guia" className="hover:text-orange-500 transition">{t('footer.guia')}</Link></li>
            <li><Link href="/proyectos" className="hover:text-orange-500 transition">{t('footer.cartelera')}</Link></li>
          </ul>
        </div>
        <div>
          <h5 className="font-bold text-white mb-4 uppercase text-xs tracking-wider">{t('footer.contact')}</h5>
          <p className="text-sm text-slate-500 mb-2">info@filmcommissiontdf.com.ar</p>
          <p className="text-sm text-slate-500">Ushuaia, Tierra del Fuego, Argentina</p>
        </div>
      </div>
      <div className="text-center mt-12 pt-8 border-t border-slate-900 text-xs text-slate-600">
        {t('footer.rights')}
      </div>
    </footer>
  );
}