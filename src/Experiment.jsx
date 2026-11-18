import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, MessageCircle, Award, ClipboardList, Dumbbell } from 'lucide-react';
import { gasClient } from './utils/gasClient';

const LETTERS = ['A', 'B', 'C', 'D'];

// 門市對練用的課程類型：不出現在課程資源庫，集中在左側「門市對練」頁
export const EXPERIMENT_TYPES = ['test', 'practice', 'selfpractice'];

function Notice({ tone = 'info', icon, children }) {
  const Icon = icon || AlertCircle;
  const tones = {
    info:    'bg-blue-50 border-blue-200 text-blue-800',
    warn:    'bg-amber-50 border-amber-200 text-amber-800',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    error:   'bg-red-50 border-red-200 text-red-800'
  };
  return (
    <div className={`flex items-start gap-3 p-5 rounded-2xl border ${tones[tone]}`}>
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="text-sm font-medium leading-relaxed">{children}</div>
    </div>
  );
}

// ============================================================
// 商品知識測驗（前測／後測，員工端同名）：只能作答一次，不顯示分數與答案
// ============================================================
export function TestView({ course, userId, onSubmitted }) {
  const [state, setState] = useState({ loading: true });
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const load = useCallback(async () => {
    setState({ loading: true });
    try {
      const res = await gasClient.securePost('getTest', { userId, courseId: course.id });
      if (res?.status === 'success') setState({ loading: false, ...res.data });
      else setState({ loading: false, error: res?.message || '載入失敗' });
    } catch {
      setState({ loading: false, error: '連線異常，請稍後再試' });
    }
  }, [course.id, userId]);

  useEffect(() => { load(); }, [load]);

  if (state.loading) return <div className="p-10 text-center text-slate-500 font-bold animate-pulse">載入測驗中...</div>;
  if (state.error) return <Notice tone="warn">{state.error}</Notice>;
  if (state.submitted) {
    return (
      <Notice tone="success" icon={CheckCircle}>
        你已經完成這份測驗，感謝作答！<br />這份測驗是用來了解訓練前後的變化，所以不會顯示分數與答案。
      </Notice>
    );
  }

  const items = state.items || [];
  const answered = items.filter(it => answers[it.id]).length;

  const handleSubmit = async () => {
    setSubmitError('');
    if (answered < items.length) { setSubmitError(`還有 ${items.length - answered} 題沒有作答`); return; }
    if (!window.confirm('交卷後就不能修改，確定要交卷嗎？')) return;
    setSubmitting(true);
    try {
      const res = await gasClient.securePost('submitTest', { userId, courseId: course.id, answers });
      if (res?.status === 'success') {
        setState({ loading: false, submitted: true });
        onSubmitted && onSubmitted();
      } else {
        setSubmitError(res?.message || '交卷失敗，請再試一次');
      }
    } catch {
      // 連線中斷時可能其實已交卷成功：重新載入，已交過就會直接顯示完成畫面
      setSubmitError('連線異常，正在確認交卷狀態...');
      load();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Notice tone="info">
        共 {items.length} 題單選題，<b>只能作答一次</b>，交卷後不會顯示分數與答案。<br />
        請依自己目前的了解獨立作答，不要查資料或討論；不會的題目選最接近的答案即可。這份測驗不列入考核。
      </Notice>

      {items.map((it, idx) => (
        <fieldset key={it.id} className="bg-white rounded-2xl border border-slate-200 p-5">
          <legend className="sr-only">第 {idx + 1} 題</legend>
          <p className="font-bold text-slate-800 mb-4 leading-relaxed">
            <span className="text-blue-600 mr-2">{idx + 1}.</span>{it.question}
          </p>
          <div className="space-y-2">
            {it.options.map((opt, oi) => {
              const letter = LETTERS[oi];
              const checked = answers[it.id] === letter;
              return (
                <label key={letter} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${checked ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input
                    type="radio"
                    name={`q-${it.id}`}
                    className="mt-1"
                    checked={checked}
                    onChange={() => setAnswers(a => ({ ...a, [it.id]: letter }))}
                  />
                  <span className="text-slate-700 text-sm leading-relaxed"><b className="mr-1">{letter}.</b>{opt}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div className="sticky bottom-20 md:bottom-4 bg-white/95 backdrop-blur rounded-2xl border border-slate-200 shadow-lg p-4 flex flex-col sm:flex-row items-center gap-3">
        <span className="text-sm font-bold text-slate-600">已作答 {answered} / {items.length} 題</span>
        {submitError && <span className="text-sm font-bold text-red-600">{submitError}</span>}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="sm:ml-auto w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-xl font-bold"
        >
          {submitting ? '交卷中...' : '交卷'}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// 門市對練頁：商品知識測驗 → 每天派的正式練習 → 商品知識測驗（後測）→ 完課勳章；另有自主練習
// ============================================================
function ItemCard({ item, perItem, onOpenBot, onReport, sending, reportLabel = '我已完成', doneToday }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col gap-3">
      <div>
        <span className="text-xs font-bold text-blue-600">{item.category}</span>
        <h4 className="text-lg font-black text-slate-900">{item.name}</h4>
        {perItem && (
          <p className="text-xs text-slate-500 mt-1">
            {item.isSecond
              ? <span className="font-bold text-amber-700">第 2 次（第 1 次：{item.firstDay}）</span>
              : item.count >= perItem ? `✓ 這款已練完 ${perItem} 次`
              : (doneToday ? '第 1 次已完成，明天起會出現第 2 次' : `第 ${item.count + 1} 次`)}
          </p>
        )}
      </div>
      <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line flex-1">{item.guide || '（練習指引準備中）'}</p>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => onOpenBot(item)} className="flex items-center gap-1 px-4 py-2 rounded-xl border border-indigo-200 text-indigo-700 font-bold text-sm hover:bg-indigo-50">
          <MessageCircle className="w-4 h-4" /> 開啟 AI 對練
        </button>
        <button onClick={() => onReport(item)} disabled={sending || doneToday}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold text-sm">
          {doneToday ? '✓ 今天已完成' : (sending ? '送出中...' : reportLabel)}
        </button>
      </div>
    </div>
  );
}

export function DrillView({ userId, onChanged }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [testCourseId, setTestCourseId] = useState('');
  const [bot, setBot] = useState(null);
  const [sending, setSending] = useState(false);
  const [flash, setFlash] = useState('');
  const [selfCat, setSelfCat] = useState('');
  const [selfName, setSelfName] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await gasClient.securePost('getExperimentStatus', { userId });
      if (res?.status === 'success') { setStatus(res.data); setError(''); }
      else setError(res?.message || '載入失敗');
    } catch {
      setError('連線異常，請稍後再試');
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  if (error) return <Notice tone="warn">{error}</Notice>;
  if (!status) return <div className="p-10 text-center text-slate-500 font-bold animate-pulse">載入中...</div>;
  if (status.unbound) return <Notice tone="warn">你的帳號還沒有綁定門市，請聯絡管理者（HR）處理。</Notice>;
  if (!status.isExperimentStore) return <Notice tone="info">你所屬的單位（{status.dept || '未設定'}）目前沒有門市對練課程。</Notice>;

  if (testCourseId) {
    return (
      <div className="space-y-4 max-w-4xl">
        <button onClick={() => { setTestCourseId(''); load(); }} className="text-slate-500 hover:text-blue-600 font-bold">← 返回門市對練</button>
        <h2 className="text-2xl font-black text-slate-900">商品知識測驗</h2>
        <TestView course={{ id: testCourseId }} userId={userId} onSubmitted={() => { load(); onChanged && onChanged(); }} />
      </div>
    );
  }

  const send = async (payload, label, onOk) => {
    setFlash('');
    setSending(true);
    try {
      const res = await gasClient.securePost('submitPractice', { userId, note: '', ...payload });
      if (res?.status === 'success') {
        setStatus(res.data);
        setFlash(`已記錄：${label}`);
        onOk && onOk();
        if (res.data.completed) onChanged && onChanged();
      } else {
        setFlash(res?.message || '回報失敗，請再試一次');
      }
    } catch {
      setFlash('連線異常，請稍後再試');
    } finally {
      setSending(false);
    }
  };
  const report = item => send({ itemId: item.id, kind: 'formal' }, `${item.name}（正式練習）`);
  const reportSelf = () => {
    if (!selfCat || !selfName.trim()) { setFlash('自主練習請先選類別、填商品'); return; }
    send({ kind: 'self', category: selfCat, productName: selfName.trim() }, `${selfName.trim()}（自主練習）`, () => setSelfName(''));
  };
  const pct = status.formalTarget ? Math.round(status.formalDone / status.formalTarget * 100) : 0;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* 進度總覽 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-black text-slate-900">門市對練</h2>
          <span className="text-sm text-slate-500">{status.startDate}～{status.endDate}{status.phase === 'running' && <>，第 {status.weekNo} / {status.totalWeeks} 週</>}</span>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-sm font-bold text-slate-600 mb-1">
            <span>正式練習</span><span>{status.formalDone} / {status.formalTarget} 次</span>
          </div>
          <div className="h-3 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-blue-600 transition-all" style={{ width: pct + '%' }} />
          </div>
          {status.phase === 'running' && (
            <p className="text-sm font-bold text-slate-700 mt-3">本週 {status.weekDone} / {status.weekQuota} 次</p>
          )}
          <p className="text-xs text-slate-500 mt-2">
            共 {status.items.length} 個品項，每個品項正式練習 {status.perItem} 次；每週 {status.perWeek} 次，可以同一天練完。
            第 1 次練過的品項，隔天起會自動出現第 2 次。上週沒練滿的次數可以在這週補。全部完成後就能做最後一次商品知識測驗。
          </p>
        </div>
      </div>

      {flash && <div role="status"><Notice tone="info">{flash}</Notice></div>}

      {status.completed && (
        <Notice tone="success" icon={Award}>
          恭喜完課！你已完成全部正式練習與商品知識測驗{status.badges.length > 0 && <>，獲得「{status.badges.join('、')}」勳章（可在「我的成就」查看）</>}。
        </Notice>
      )}

      {/* 前測 */}
      {!status.pretestDone && (
        <div className="bg-white rounded-2xl border-2 border-blue-400 p-6 space-y-3">
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2"><ClipboardList className="w-5 h-5 text-blue-600" /> 第一步：商品知識測驗</h3>
          <p className="text-sm text-slate-600">完成這份測驗後才會開放練習。只能作答一次，約 25 分鐘，不會顯示分數。</p>
          <button onClick={() => setTestCourseId(status.preCourseId)} disabled={!status.preCourseId}
            className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold">開始作答</button>
        </div>
      )}

      {/* 後測 */}
      {status.pretestDone && status.posttestOpen && !status.posttestDone && (
        <div className="bg-white rounded-2xl border-2 border-emerald-400 p-6 space-y-3">
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2"><ClipboardList className="w-5 h-5 text-emerald-600" /> 商品知識測驗</h3>
          <p className="text-sm text-slate-600">
            {status.allDone
              ? '你已完成全部正式練習，請完成這份測驗，交卷後即完課。'
              : '測驗已開放，請盡快完成。還沒練完的品項，之後練完一樣會計入完課。'}
            只能作答一次，不會顯示分數。
          </p>
          <button onClick={() => setTestCourseId(status.postCourseId)}
            className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold">開始作答</button>
        </div>
      )}

      {/* 今日正式練習 */}
      {status.pretestDone && !status.allDone && (
        <section className="space-y-3">
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2"><Dumbbell className="w-5 h-5 text-blue-600" /> 今天的正式練習</h3>
          {status.phase === 'notStarted' && <Notice tone="info">正式練習將於 {status.startDate} 開始。</Notice>}
          {status.phase === 'ended' && <Notice tone="warn">正式練習期間已結束。</Notice>}
          {status.phase === 'running' && (
            <>
              {status.weekRemaining <= 0 ? (
                <Notice tone="success" icon={CheckCircle}>
                  本週目標達成 ✓ 下週一（{status.nextWeekStart}）會開放新的練習。想多練可以用下面的自主練習。
                </Notice>
              ) : (
                <p className="text-sm text-slate-500">
                  打開 AI 對練練完後，回來按「我已完成」。
                  {status.lastWeekShort > 0 && <b className="text-amber-700"> 上週還差 {status.lastWeekShort} 次，這週可以一起補（只能補上週）。</b>}
                </p>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                {status.today.map(it => (
                  <ItemCard key={it.id} item={it} perItem={status.perItem} onOpenBot={setBot}
                    onReport={report} sending={sending} doneToday={it.doneToday} />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* AI 對練視窗 */}
      {bot && (
        <div className="bg-white rounded-2xl border border-indigo-200 overflow-hidden">
          <div className="flex items-center justify-between p-3 bg-indigo-50">
            <span className="font-bold text-indigo-800 text-sm">AI 對練：{bot.name}</span>
            <button onClick={() => setBot(null)} className="text-sm font-bold text-indigo-700 hover:underline">收起</button>
          </div>
          {bot.url
            ? <iframe key={bot.id} src={bot.url} title={`AI 對練：${bot.name}`} allow="microphone" className="w-full h-[640px]" />
            : <p className="p-5 text-sm text-slate-500">這個品項的 AI 對練還在準備中。</p>}
        </div>
      )}

      {/* 品項進度 */}
      {status.pretestDone && (
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="font-black text-slate-900 mb-3">品項進度</h3>
          <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {status.items.map(it => (
              <div key={it.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">{it.name}</span>
                <span className="flex gap-1" aria-label={`已練 ${Math.min(it.count, status.perItem)} / ${status.perItem} 次`}>
                  {Array.from({ length: status.perItem }).map((_, k) => (
                    <span key={k} className={`w-3 h-3 rounded-full ${k < it.count ? 'bg-blue-600' : 'bg-slate-200'}`} />
                  ))}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 自主練習：不限類別與商品（例如每月主推），但要留下練了什麼 */}
      {status.pretestDone && status.selfCourse && status.phase !== 'notStarted' && (
        <section className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div>
            <h3 className="font-black text-slate-900">自主練習</h3>
            <p className="text-sm text-slate-500 mt-1">
              想多練什麼都可以（例如每月主推），不限次數，也不計入正式練習。練完請填下練了哪個商品再按「我已完成」，方便之後統計。
              {status.selfTotal > 0 && <> 目前已記錄 <b>{status.selfTotal}</b> 次。</>}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-bold text-slate-700">類別
              <select value={selfCat} onChange={e => setSelfCat(e.target.value)} className="mt-1 w-full p-3 rounded-xl border border-slate-200 text-sm font-normal">
                <option value="">選擇類別…</option>
                {status.selfCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="text-sm font-bold text-slate-700">商品
              <input list="self-products" value={selfName} onChange={e => setSelfName(e.target.value)} maxLength={80}
                placeholder="輸入或選擇商品名稱" className="mt-1 w-full p-3 rounded-xl border border-slate-200 text-sm font-normal" />
              <datalist id="self-products">
                {status.knownProducts.filter(p => !selfCat || p.category === selfCat).map(p => <option key={p.name} value={p.name} />)}
              </datalist>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setBot({ id: 'self', name: selfName || '自主練習', url: status.botUrl })}
              className="flex items-center gap-1 px-4 py-2 rounded-xl border border-indigo-200 text-indigo-700 font-bold text-sm hover:bg-indigo-50">
              <MessageCircle className="w-4 h-4" /> 開啟 AI 對練
            </button>
            <button onClick={reportSelf} disabled={sending}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold text-sm">
              {sending ? '送出中...' : '我已完成（自主）'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
