import { Link } from 'react-router-dom';
import { FileText, ChevronRight } from 'lucide-react';
import { useI18n } from '../lib/i18n';

export default function TermsOfServicePage() {
  const { t } = useI18n();

  const sections = [
    { title: t('tos.s1.title'), paras: [t('tos.s1.p1')], bullets: [] },
    { title: t('tos.s2.title'), paras: [t('tos.s2.p1')], bullets: [] },
    { title: t('tos.s3.title'), paras: [t('tos.s3.p1')], bullets: [] },
    { title: t('tos.s4.title'), paras: [t('tos.s4.p1')], bullets: [] },
    { title: t('tos.s5.title'), paras: [t('tos.s5.p1')], bullets: [t('tos.s5.b1'), t('tos.s5.b2'), t('tos.s5.b3'), t('tos.s5.b4')] },
    { title: t('tos.s6.title'), paras: [t('tos.s6.p1')], bullets: [] },
    { title: t('tos.s7.title'), paras: [t('tos.s7.p1')], bullets: [] },
    { title: t('tos.s8.title'), paras: [t('tos.s8.p1')], bullets: [] },
    { title: t('tos.s9.title'), paras: [t('tos.s9.p1')], bullets: [] },
    { title: t('tos.s10.title'), paras: [t('tos.s10.p1')], bullets: [t('tos.s10.b1'), t('tos.s10.b2'), t('tos.s10.b3'), t('tos.s10.b4')] },
    { title: t('tos.s11.title'), paras: [t('tos.s11.p1')], bullets: [] },
    { title: t('tos.s12.title'), paras: [t('tos.s12.p1')], bullets: [] },
    { title: t('tos.s13.title'), paras: [t('tos.s13.p1')], bullets: [] },
    { title: t('tos.s14.title'), paras: [t('tos.s14.p1')], bullets: [] },
    { title: t('tos.s15.title'), paras: [t('tos.s15.p1')], bullets: [] },
    { title: t('tos.s16.title'), paras: [t('tos.s16.p1')], bullets: [] },
    { title: t('tos.s17.title'), paras: [t('tos.s17.p1')], bullets: [] },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-gray-900 to-gray-950 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-4">
            <Link to="/" className="hover:text-gray-200 transition-colors">{t('nav.home')}</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-200">{t('tos.breadcrumb')}</span>
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
              <FileText className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold">{t('tos.title')}</h1>
              <p className="text-gray-400 text-sm mt-0.5">{t('tos.subtitle')}</p>
            </div>
          </div>
          <p className="text-gray-500 text-xs mt-4">{t('tos.updated')}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-10">
          <div className="space-y-8">
            {sections.map((s, i) => (
              <section key={i}>
                <h2 className="text-lg font-display font-bold text-gray-900 mb-3">{s.title}</h2>
                {s.paras.map((p, j) => (
                  <p key={j} className="text-gray-600 text-sm leading-relaxed mb-3">{p}</p>
                ))}
                {s.bullets.length > 0 && (
                  <ul className="space-y-2 ml-1">
                    {s.bullets.map((b, j) => (
                      <li key={j} className="flex items-start gap-2.5 text-sm text-gray-600 leading-relaxed">
                        <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-forest-400 mt-1.5" />
                        {b}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
