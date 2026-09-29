import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  HelpCircle, ChevronRight, ChevronDown, ChevronUp,
  ArrowRight, MessageCircle,
} from 'lucide-react';
import { useI18n } from '../lib/i18n';

interface FAQItem {
  qKey: string;
  aKey: string;
}

interface FAQCategoryData {
  catKey: string;
  emoji: string;
  items: FAQItem[];
}

const FAQ_DATA: FAQCategoryData[] = [
  {
    catKey: 'faq.cat1',
    emoji: '🚀',
    items: [
      { qKey: 'faq.q1', aKey: 'faq.a1' },
      { qKey: 'faq.q2', aKey: 'faq.a2' },
      { qKey: 'faq.q3', aKey: 'faq.a3' },
      { qKey: 'faq.q4', aKey: 'faq.a4' },
    ],
  },
  {
    catKey: 'faq.cat2',
    emoji: '🐾',
    items: [
      { qKey: 'faq.q5', aKey: 'faq.a5' },
      { qKey: 'faq.q6', aKey: 'faq.a6' },
      { qKey: 'faq.q7', aKey: 'faq.a7' },
      { qKey: 'faq.q8', aKey: 'faq.a8' },
      { qKey: 'faq.q9', aKey: 'faq.a9' },
    ],
  },
  {
    catKey: 'faq.cat3',
    emoji: '🌳',
    items: [
      { qKey: 'faq.q10', aKey: 'faq.a10' },
      { qKey: 'faq.q11', aKey: 'faq.a11' },
      { qKey: 'faq.q12', aKey: 'faq.a12' },
      { qKey: 'faq.q13', aKey: 'faq.a13' },
    ],
  },
  {
    catKey: 'faq.cat4',
    emoji: '💎',
    items: [
      { qKey: 'faq.q14', aKey: 'faq.a14' },
      { qKey: 'faq.q15', aKey: 'faq.a15' },
      { qKey: 'faq.q16', aKey: 'faq.a16' },
      { qKey: 'faq.q17', aKey: 'faq.a17' },
      { qKey: 'faq.q18', aKey: 'faq.a18' },
    ],
  },
  {
    catKey: 'faq.cat5',
    emoji: '🛒',
    items: [
      { qKey: 'faq.q19', aKey: 'faq.a19' },
      { qKey: 'faq.q20', aKey: 'faq.a20' },
      { qKey: 'faq.q21', aKey: 'faq.a21' },
      { qKey: 'faq.q22', aKey: 'faq.a22' },
    ],
  },
  {
    catKey: 'faq.cat6',
    emoji: '💱',
    items: [
      { qKey: 'faq.q23', aKey: 'faq.a23' },
      { qKey: 'faq.q24', aKey: 'faq.a24' },
      { qKey: 'faq.q25', aKey: 'faq.a25' },
      { qKey: 'faq.q26', aKey: 'faq.a26' },
    ],
  },
];

function FAQAccordion({ items }: { items: FAQItem[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className={`rounded-xl border transition-all duration-200 overflow-hidden ${
          open === i ? 'border-forest-300 shadow-sm' : 'border-gray-200 hover:border-gray-300'
        }`}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-start justify-between gap-4 px-5 py-4 text-left bg-white hover:bg-gray-50 transition-colors"
          >
            <span className="font-semibold text-gray-900 text-sm leading-relaxed">{t(item.qKey)}</span>
            {open === i
              ? <ChevronUp className="w-4 h-4 text-forest-500 flex-shrink-0 mt-0.5" />
              : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
            }
          </button>
          {open === i && (
            <div className="px-5 pb-5 bg-white border-t border-gray-100">
              <div className="pt-3 text-gray-600 text-sm leading-relaxed">{t(item.aKey)}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function FAQPage() {
  const { t } = useI18n();
  const [activeCategory, setActiveCategory] = useState(0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-ocean-900 to-ocean-950 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex items-center gap-2 text-ocean-300/60 text-sm mb-4">
            <Link to="/" className="hover:text-ocean-200 transition-colors">{t('nav.home')}</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-ocean-200">{t('faq.breadcrumb')}</span>
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
              <HelpCircle className="w-6 h-6 text-sky-300" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold">{t('faq.title')}</h1>
              <p className="text-ocean-200/70 text-sm mt-0.5">{t('faq.subtitle')}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-6">
            {FAQ_DATA.map((cat, i) => (
              <button
                key={i}
                onClick={() => setActiveCategory(i)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  activeCategory === i
                    ? 'bg-white text-ocean-900 shadow'
                    : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                }`}
              >
                <span>{cat.emoji}</span>
                {t(cat.catKey)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-display font-bold text-gray-900">
            {FAQ_DATA[activeCategory].emoji} {t(FAQ_DATA[activeCategory].catKey)}
          </h2>
          <span className="text-sm text-gray-400">{t('faq.questions', { count: FAQ_DATA[activeCategory].items.length })}</span>
        </div>

        <FAQAccordion items={FAQ_DATA[activeCategory].items} />

        {FAQ_DATA.length > 1 && (
          <div className="mt-10">
            <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">{t('faq.otherTopics')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FAQ_DATA.filter((_, i) => i !== activeCategory).map((cat) => {
                const idx = FAQ_DATA.indexOf(cat);
                return (
                  <button
                    key={idx}
                    onClick={() => setActiveCategory(idx)}
                    className="flex items-center justify-between p-4 rounded-xl bg-white border border-gray-200 hover:border-forest-300 hover:shadow-sm transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{cat.emoji}</span>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{t(cat.catKey)}</p>
                        <p className="text-gray-400 text-xs">{t('faq.questions', { count: cat.items.length })}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-10 bg-gradient-to-br from-forest-900 to-forest-950 rounded-2xl p-6 text-white text-center">
          <MessageCircle className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
          <h3 className="font-display font-bold text-lg mb-2">{t('faq.stillHaveQuestions')}</h3>
          <p className="text-forest-200/70 text-sm mb-5">
            {t('faq.stillDesc')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/docs"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm transition-colors"
            >
              {t('faq.readDocs')} <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/smart-contracts"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-sm transition-colors"
            >
              {t('faq.smartContracts')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
