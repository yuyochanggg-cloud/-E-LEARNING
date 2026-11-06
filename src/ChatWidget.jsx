import { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';

// 外部 AI 助理（altatech Data-DI）浮動視窗。
// 只有建置時有設 VITE_CHAT_WIDGET_URL 才會出現，目前僅用於測試環境（Vercel preview）。
const WIDGET_URL = import.meta.env.VITE_CHAT_WIDGET_URL;

export default function ChatWidget({ raised = false }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false); // 第一次點開才載入 iframe，之後保留對話

  if (!WIDGET_URL) return null;

  // 手機版底部有導覽列（h-16）；有 Mini Player 時再往上抬
  const bottom = raised ? 'bottom-40 md:bottom-28' : 'bottom-20 md:bottom-6';

  return (
    <>
      {loaded && (
        <div
          className={`fixed z-40 right-0 left-0 top-0 bottom-16 md:left-auto md:top-auto md:right-6 md:bottom-24 md:w-[380px] md:h-[600px] md:max-h-[calc(100vh-8rem)] md:rounded-2xl overflow-hidden bg-white shadow-2xl border border-slate-200 flex flex-col ${open ? '' : 'hidden'}`}
          role="dialog"
          aria-label="AI 助理"
        >
          <div className="flex items-center justify-between px-4 py-2 bg-slate-900 text-white text-sm font-bold">
            <span>AI 助理（測試中）</span>
            <button onClick={() => setOpen(false)} aria-label="關閉 AI 助理" className="p-1 rounded hover:bg-white/10">
              <X size={18} />
            </button>
          </div>
          <iframe
            src={WIDGET_URL}
            title="AI 助理"
            allow="microphone"
            className="flex-1 w-full border-0"
          />
        </div>
      )}
      <button
        onClick={() => { setLoaded(true); setOpen(o => !o); }}
        aria-label={open ? '關閉 AI 助理' : '開啟 AI 助理'}
        aria-expanded={open}
        className={`fixed z-40 right-4 md:right-6 ${bottom} w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl flex items-center justify-center transition-colors ${open ? 'max-md:hidden' : ''}`}
      >
        {open ? <X size={24} /> : <MessageCircle size={24} />}
      </button>
    </>
  );
}
