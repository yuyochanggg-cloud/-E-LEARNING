// 1. React 相關功能 (useMemo 要放在這裡)
import React, { useState, useRef, useEffect, useMemo } from 'react';

// 2. Lucide 圖示 (這裡純放圖示，把 useMemo 移走)
import { 
  Play, Pause, CheckCircle, BookOpen, Headphones, Award, 
  ChevronLeft, FileText, Upload, LayoutDashboard, Library, 
  ShieldCheck, Clock, Flame, Sun, Heart, TrendingUp, Gem,
  Cloud, AlertCircle, Info, ExternalLink, Rocket, BatteryCharging,
  Briefcase, Users, Target, Map, UploadCloud, Sparkles, Mic,
  Lock, Key, Mail
} from 'lucide-react';

import { gasClient } from './utils/gasClient';

const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// ==========================================
// 全域音訊播放器 (singleton，跨頁面背景播放)
// ==========================================
const globalAudio = new Audio();

// ==========================================
// Toast 系統 (全域，避免 prop drilling)
// ==========================================
let _setToast = null;
function showToast(message, type = 'success') {
  if (_setToast) _setToast({ message, type, id: Date.now() });
}

function Toast() {
  const [toast, setToast] = useState(null);
  useEffect(() => {
    _setToast = setToast;
    return () => { _setToast = null; };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;
  const colors = {
    success: 'bg-emerald-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
    warning: 'bg-amber-500',
  };
  return (
    <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[9999] ${colors[toast.type] || colors.success} text-white px-6 py-3 rounded-2xl shadow-2xl font-bold text-sm flex items-center gap-2 transition-all`}>
      {toast.message}
    </div>
  );
}

// --- 六大頻道配置 (前台 / 後台 雙軌命名) ---
const categoriesConfig = {
  '生存百寶箱': { backend: '流程與行政 SOP', icon: Briefcase, color: 'text-purple-500', bg: 'bg-purple-100', border: 'border-purple-200', radarIndex: 4 },
  '初心補給站': { backend: '組織文化與思維', icon: Sparkles, color: 'text-amber-500', bg: 'bg-amber-100', border: 'border-amber-200', radarIndex: 0 },
  '職人練功坊': { backend: '專業戰技與業務 ROI', icon: TrendingUp, color: 'text-red-500', bg: 'bg-red-100', border: 'border-red-200', radarIndex: 1 },
  '效率外掛區': { backend: 'AI 與未來職能', icon: Rocket, color: 'text-blue-500', bg: 'bg-blue-100', border: 'border-blue-200', radarIndex: 2 },
  '心靈充電站': { backend: '心理資本與韌性', icon: BatteryCharging, color: 'text-emerald-500', bg: 'bg-emerald-100', border: 'border-emerald-200', radarIndex: 3 },
  '領導與溝通': { backend: '領導與群體動力', icon: Users, color: 'text-indigo-500', bg: 'bg-indigo-100', border: 'border-indigo-200', radarIndex: 5 }
};

// --- 課程資料庫 (涵蓋六大頻道) ---


// --- Radar Chart Helper ---
const RadarChart = ({ data }) => {
  const size = 300;
  const center = size / 2;
  const radius = 100;
  
  // 六個頂點的角度 (從 12 點鐘方向開始順時針)
  const angles = [270, 330, 30, 90, 150, 210];
  const categories = ['初心補給', '職人練功', '效率外掛', '心靈充電', '生存百寶', '領導溝通'];
  
  const getPoint = (value, angle) => {
    const r = (value / 100) * radius;
    const rad = angle * (Math.PI / 180);
    return `${center + r * Math.cos(rad)},${center + r * Math.sin(rad)}`;
  };

  const polygonPoints = data.map((val, i) => getPoint(val, angles[i])).join(' ');

  // 背景網格 (畫 5 層)
  const gridLevels = [20, 40, 60, 80, 100];

  return (
    <div className="relative w-full max-w-[340px] mx-auto flex items-center justify-center p-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        {/* 背景網格 */}
        {gridLevels.map((level) => (
          <polygon
            key={level}
            points={angles.map(a => getPoint(level, a)).join(' ')}
            fill="none"
            stroke="#e2e8f0" // slate-200
            strokeWidth="1"
          />
        ))}
        {/* 對角線 */}
        {angles.slice(0, 3).map((a, i) => (
          <line
            key={i}
            x1={center + radius * Math.cos(a * Math.PI / 180)}
            y1={center + radius * Math.sin(a * Math.PI / 180)}
            x2={center + radius * Math.cos((a + 180) * Math.PI / 180)}
            y2={center + radius * Math.sin((a + 180) * Math.PI / 180)}
            stroke="#e2e8f0"
            strokeWidth="1"
          />
        ))}
        
        {/* 實際數據區塊 */}
        <polygon
          points={polygonPoints}
          fill="rgba(59, 130, 246, 0.4)" // blue-500 with opacity
          stroke="#3b82f6"
          strokeWidth="3"
          className="transition-all duration-1000 ease-out"
        />

        {/* 數據頂點圓圈 */}
        {data.map((val, i) => {
          const point = getPoint(val, angles[i]).split(',');
          return (
            <circle
              key={i}
              cx={point[0]}
              cy={point[1]}
              r="4"
              fill="#fff"
              stroke="#2563eb" // blue-600
              strokeWidth="2"
            />
          );
        })}

        {/* 標籤文字 */}
        {angles.map((a, i) => {
          // 將標籤稍微往外推
          const rText = radius + 25;
          const x = center + rText * Math.cos(a * Math.PI / 180);
          const y = center + rText * Math.sin(a * Math.PI / 180);
          
          return (
            <text
              key={`label-${i}`}
              x={x}
              y={y}
              dominantBaseline="middle"
              textAnchor={a > 90 && a < 270 ? "end" : a === 90 || a === 270 ? "middle" : "start"}
              className="text-xs font-bold fill-slate-600"
            >
              {categories[i]}
            </text>
          );
        })}
      </svg>
    </div>
  );
};

export default function App() {
  // ==========================================
  // 1. 狀態宣告區
  // ==========================================
  const [currentView, setCurrentView] = useState('dashboard'); 
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [coursesData, setCoursesData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [userProfile, setUserProfile] = useState(null); 
  const [loginInput, setLoginInput] = useState('');
  const [passwordInput, setPasswordInput] = useState(''); // ✨ 新增：密碼狀態     
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');     

  const [isFirstLoginMode, setIsFirstLoginMode] = useState(false); // ✨ 新增：控制是否顯示強制換密碼畫面
  const [newPassword, setNewPassword] = useState(''); // ✨ 新增：新密碼
  const [confirmPassword, setConfirmPassword] = useState(''); // ✨ 新增：確認新密碼
  const [notifyEmail, setNotifyEmail] = useState(''); // 首次登入蒐集提醒信箱
  const [showEmailPrompt, setShowEmailPrompt] = useState(false); // 既有帳號補填信箱的小視窗
  const [promptEmail, setPromptEmail] = useState('');
  const [promptEmailError, setPromptEmailError] = useState('');

  const [progressData, setProgressData] = useState({
    completedCourses: [],
    earnedBadges: [],
    totalLearningMinutes: 0
  });

  // 🎵 背景音訊狀態
  const [nowPlaying, setNowPlaying] = useState(null); // { src, title, category }
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioSpeed, setAudioSpeed] = useState(1.0);

  // 同步全域 Audio 事件到 React state
  useEffect(() => {
    const onPlay  = () => setIsAudioPlaying(true);
    const onPause = () => setIsAudioPlaying(false);
    const onEnded = () => setIsAudioPlaying(false);
    globalAudio.addEventListener('play',  onPlay);
    globalAudio.addEventListener('pause', onPause);
    globalAudio.addEventListener('ended', onEnded);
    return () => {
      globalAudio.removeEventListener('play',  onPlay);
      globalAudio.removeEventListener('pause', onPause);
      globalAudio.removeEventListener('ended', onEnded);
    };
  }, []);

  // ==========================================
  // 2. 核心資料抓取邏輯 (統一由這個函式負責)
  // ==========================================
  const fetchDashboardData = async (validUserId) => {
    try {
      setIsLoading(true);

      // 一次呼叫拿齊課程清單與進度（原本分兩次，各付一趟 GAS 冷啟＋往返）
      const res = await gasClient.securePost('bootstrap', { userId: validUserId });

      if (res && res.status === 'error') {
        // 只有「登入逾期／身分驗證失敗」才強制登出，其他錯誤保留登入狀態
        // （否則任何後端暫時性錯誤都會把使用者踢出去）
        const msg = String(res.message || '');
        if (msg.indexOf('逾期') >= 0 || msg.indexOf('身分驗證') >= 0) {
          localStorage.removeItem('cloud_academy_user');
          localStorage.removeItem('cloud_academy_token');
          showToast(msg || '登入已逾期，請重新登入', 'error');
          window.location.reload();
          return;
        }
        showToast('載入失敗：' + msg, 'error');
        return; // 保留現有畫面資料，不要用空值覆蓋
      }

      const courses = Array.isArray(res?.courses) ? res.courses : [];
      setCoursesData(courses);

      // 只有真的拿到進度才覆寫本地狀態。拿不到時保留現值，
      // 避免「讀取失敗 → 本地變空 → 下一次寫入把使用者歷史清掉」
      if (res?.progress) {
        setProgressData(res.progress);
      }

      // ✨ 深度連結與狀態同步
      const params = new URLSearchParams(window.location.search);
      const courseIdFromUrl = params.get('courseId');

      if (courseIdFromUrl && courses.length > 0) {
        const target = courses.find(c => String(c.id || c.CourseId) === String(courseIdFromUrl));
        if (target) {
          setSelectedCourse(target);
          setCurrentView('course');
        }
      } else if (selectedCourse) {
        const updatedTarget = courses.find(c => String(c.id || c.CourseId) === String(selectedCourse.id || selectedCourse.CourseId));
        if (updatedTarget) setSelectedCourse(updatedTarget);
      }
    } catch (error) {
      console.error("載入失敗:", error);
      showToast('載入失敗，請檢查網路後重新整理', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // 3. 核心行為邏輯
  // ==========================================

  // 🏆 處理完課存檔 (OJT 攔截 + 嚴格同步版)
const handleCourseComplete = async (badges) => {
  if (!selectedCourse || !userProfile) return;

  try {
    setIsLoading(true);
    const uId = userProfile.userId || userProfile.empId;
    const cId = String(selectedCourse.id || selectedCourse.CourseId);

    // ✨ 判斷這是不是實戰任務 (OJT)
    const isOJT = String(selectedCourse.category || '').trim() === '實戰解鎖' || selectedCourse.isOJT === true;

    // 完課紀錄與彙總表（完課清單／徽章）現在都由後端 completeCourse 一次處理完，
    // 前端不再傳整包 progress 快照回去覆寫——那會抹掉主管剛核准的完課或
    // 另一個分頁剛寫入的徽章（last-write-wins）。
    // OJT 課程後端會自己判斷不發徽章，等 reviewOJTTask 核准才寫入。
    const res = await gasClient.securePost('completeCourse', {
      userId: uId,
      courseId: cId,
      badges: badges,
      isOJT: isOJT
    });

    if (res.success || res.status === 'success') {
      if (res.data) setProgressData(res.data); // 用後端 merge 後的實際結果更新本地

      if (isOJT) {
        showToast('測驗關卡通過！請完成實戰成果上傳，待主管核准後徽章才會解鎖。', 'warning');
      } else {
        showToast('恭喜完成課程！完課紀錄與徽章已同步至雲端。', 'success');
      }

      // 重整畫面資料
      await fetchDashboardData(uId);

    } else {
      throw new Error(res.message || "伺服器存檔失敗");
    }
  } catch (error) {
    console.error("存檔發生錯誤:", error);
    showToast('存檔失敗：' + (error.message || '未知錯誤') + '（請截圖回報）', 'error');
  } finally {
    setIsLoading(false);
  }
};

 // 🔐 處理登入驗證 (雙重欄位)
  const handleLogin = async () => {
    if (!loginInput.trim() || !passwordInput.trim()) {
      setLoginError('請完整輸入工號與密碼');
      return;
    }

    try {
      setIsLoggingIn(true);
      setLoginError('');
      
      // 👇👇👇 CTO 關鍵開刀位置：注意括號的位置！ 👇👇👇
      const response = await gasClient.post('verifyLogin', { 
        userId: loginInput.trim(),
        password: passwordInput.trim() 
      });
      // 👆👆👆 已經將 action 獨立為第一個參數 👆👆👆

      if (response.status === 'success') {
        const profile = response.data;

        // 儲存 session token（第一次登入也要存，changePassword 會用到）
        if (profile.sessionToken) {
          localStorage.setItem('cloud_academy_token', profile.sessionToken);
        }

        if (profile.isFirstLogin) {
          setUserProfile(profile);
          setIsFirstLoginMode(true);
        } else {
          setUserProfile(profile);
          localStorage.setItem('cloud_academy_user', JSON.stringify(profile));
          if (profile.needsEmail) setShowEmailPrompt(true);
          fetchDashboardData(profile.userId || profile.UserId);
        }
      } else {
        setLoginError(response.message || '登入失敗，請檢查工號與密碼。');
      }
    } catch (error) {
      console.error("【登入當機】:", error);
      setLoginError('伺服器連線失敗，請稍後再試。');
    } finally {
      setIsLoggingIn(false);
    }
  };

// 🛡️ 處理首次登入修改密碼
  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 4) {
      setLoginError('新密碼請至少設定 4 位數');
      return;
    }
    if (newPassword !== confirmPassword) {
      setLoginError('兩次輸入的新密碼不一致，請重新確認');
      return;
    }
    if (!isValidEmail(notifyEmail.trim())) {
      setLoginError('請輸入一個有效的信箱，之後會用來寄送必修課提醒');
      return;
    }

    try {
      setIsLoggingIn(true);
      setLoginError('');

      const response = await gasClient.securePost('changePassword', {
        userId: userProfile.userId || userProfile.UserId,
        newPassword: newPassword.trim(),
        notifyEmail: notifyEmail.trim()
      });

      if (response.status === 'success') {
        const updatedProfile = { ...userProfile, isFirstLogin: false, needsEmail: false };
        setUserProfile(updatedProfile);
        localStorage.setItem('cloud_academy_user', JSON.stringify(updatedProfile));
        setIsFirstLoginMode(false);
        fetchDashboardData(updatedProfile.userId || updatedProfile.UserId);
      } else {
        setLoginError(response.message || '密碼修改失敗');
      }
    } catch (error) {
      setLoginError('伺服器連線異常，請聯繫人資部門');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // 📧 既有帳號補填提醒信箱（不強制重設密碼的溫和版）
  const handleSubmitNotifyEmail = async () => {
    if (!isValidEmail(promptEmail.trim())) {
      setPromptEmailError('請輸入有效的信箱');
      return;
    }
    try {
      setIsLoggingIn(true);
      setPromptEmailError('');
      const response = await gasClient.securePost('updateNotifyEmail', {
        userId: userProfile.userId || userProfile.UserId,
        email: promptEmail.trim()
      });
      if (response.status === 'success') {
        const updatedProfile = { ...userProfile, needsEmail: false };
        setUserProfile(updatedProfile);
        localStorage.setItem('cloud_academy_user', JSON.stringify(updatedProfile));
        setShowEmailPrompt(false);
      } else {
        setPromptEmailError(response.message || '儲存失敗，請再試一次');
      }
    } catch (error) {
      setPromptEmailError('伺服器連線異常，請稍後再試');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // 🚪 處理登出
  const handleLogout = () => {
    localStorage.removeItem('cloud_academy_user');
    localStorage.removeItem('cloud_academy_userId');
    localStorage.removeItem('cloud_academy_token');
    window.location.reload();
  };

// ⏱️ 學習時數累加：只送 delta，由後端 merge（前端不再送整包快照）
  const handleUpdateProgress = async (courseId, spentMinutes) => {
    if (!spentMinutes || spentMinutes <= 0 || !userProfile) return;
    try {
      const res = await gasClient.securePost('updateProgress', {
        userId: userProfile.userId || userProfile.UserId,
        addMinutes: spentMinutes
      });
      // 用後端 merge 後的實際值更新本地 state
      if (res.status === 'success' && res.data) {
        setProgressData(res.data);
      }
    } catch (error) {
      console.error("進度更新失敗", error);
    }
  };

  // 🚀 自動登入檢查 (無密碼快取技術)
  useEffect(() => {
    const storedUser = localStorage.getItem('cloud_academy_user');
    if (storedUser) {
      try {
        const profile = JSON.parse(storedUser);
        setUserProfile(profile);
        if (profile.needsEmail) setShowEmailPrompt(true);
        fetchDashboardData(profile.userId || profile.UserId);
      } catch (e) {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, []);

  // ==========================================
  // 4. 生命週期與路由
  // ==========================================

  // 監聽瀏覽器上一頁/下一頁
  useEffect(() => {
    const handlePopState = (event) => {
      const params = new URLSearchParams(window.location.search);
      const courseId = params.get('courseId');

      if (!courseId) {
        setSelectedCourse(null);
        // 回到當初推入歷程的那個頁面，不要一律導到 library
        setCurrentView(event?.state?.view || 'dashboard');
      } else if (coursesData.length > 0) {
        const target = coursesData.find(c => String(c.id || c.CourseId) === String(courseId));
        if (target) {
          setSelectedCourse(target);
          setCurrentView('course'); 
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [coursesData]);

  // 路由與網址連動邏輯
  const navigateTo = (view, course = null) => {
    setSelectedCourse(course);
    setCurrentView(view);

    if (view === 'course' && course) {
      const id = course.id || course.CourseId;
      window.history.pushState({ courseId: id, view }, '', `?courseId=${id}`);
      window.scrollTo(0, 0);
    } else {
      // 把 view 記進 history state，上一頁才能回到正確的頁面
      window.history.pushState({ view }, '', window.location.pathname);
    }
  };

  // ==========================================
  // 5. 攔截渲染區 (Guard Clauses)
  // ==========================================
  if (isLoading && !userProfile) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-bold tracking-widest animate-pulse">連線至良興雲端資料庫中...</h2>
      </div>
    );
  }

  if (!userProfile || isFirstLoginMode) {
    return (
      <>
      <Toast />
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md flex flex-col items-center border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-400 opacity-10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-emerald-400 opacity-10 rounded-full blur-3xl -ml-10 -mb-10 pointer-events-none"></div>
          
          <div className="w-20 h-20 bg-gradient-to-tr from-blue-600 to-indigo-500 text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-500/30 transform -rotate-3 hover:rotate-0 transition-transform">
            {isFirstLoginMode ? <Key size={40} /> : <Cloud size={40} />}
          </div>
          
          <h1 className="text-3xl font-extrabold text-slate-800 mb-2 text-center tracking-tight">
            {isFirstLoginMode ? '啟動帳號防護' : '良興雲端學院'}
          </h1>
          <p className="text-slate-500 mb-8 text-center text-sm font-medium">
            {isFirstLoginMode ? '首次登入請務必修改您的預設密碼' : 'Empowering Your Career Journey'}
          </p>

          <div className="w-full space-y-5 relative z-10">
            {/* --- 畫面 A：正常登入表單 --- */}
            {!isFirstLoginMode && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">員工專屬工號</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400"><ShieldCheck size={20} /></div>
                    <input
                      type="text" value={loginInput} onChange={(e) => setLoginInput(e.target.value)}
                      placeholder="請輸入工號 (例: 20880001)"
                      className="w-full pl-12 pr-4 py-3.5 bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-slate-700"
                      disabled={isLoggingIn} autoComplete="off"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">登入密碼</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400"><Lock size={20} /></div>
                    <input
                      type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                      placeholder="請輸入密碼 (預設為生日)"
                      className="w-full pl-12 pr-4 py-3.5 bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-slate-700"
                      disabled={isLoggingIn}
                    />
                  </div>
                </div>
              </>
            )}

            {/* --- 畫面 B：首次登入強制換密碼表單 --- */}
            {isFirstLoginMode && (
              <>
                <div className="bg-amber-50 border border-amber-200 text-amber-700 p-3 rounded-xl text-xs font-bold flex items-start mb-4">
                  <AlertCircle size={16} className="mr-2 mt-0.5 flex-shrink-0"/>
                  為保障您的學習紀錄與個資安全，系統已暫時攔截登入，請設定專屬您的新密碼。
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">設定新密碼</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400"><Lock size={20} /></div>
                    <input
                      type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="請至少輸入 4 位數"
                      className="w-full pl-12 pr-4 py-3.5 bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium text-slate-700"
                      disabled={isLoggingIn}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">確認新密碼</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400"><CheckCircle size={20} /></div>
                    <input
                      type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="請再次輸入新密碼"
                      className="w-full pl-12 pr-4 py-3.5 bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium text-slate-700"
                      disabled={isLoggingIn}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">個人聯絡信箱</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400"><Mail size={20} /></div>
                    <input
                      type="email" value={notifyEmail} onChange={(e) => setNotifyEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleChangePassword()}
                      placeholder="用來接收必修課提醒通知"
                      className="w-full pl-12 pr-4 py-3.5 bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-medium text-slate-700"
                      disabled={isLoggingIn}
                    />
                  </div>
                </div>
              </>
            )}

            {/* --- 錯誤提示區 --- */}
            {loginError && (
              <div className="mt-3 flex items-start text-red-500 bg-red-50 p-3 rounded-lg border border-red-100 animate-fade-in">
                <AlertCircle size={16} className="mr-2 mt-0.5 flex-shrink-0"/>
                <p className="text-sm font-medium">{loginError}</p>
              </div>
            )}

            {/* --- 執行按鈕 --- */}
            <button
              onClick={isFirstLoginMode ? handleChangePassword : handleLogin} disabled={isLoggingIn}
              className={`w-full py-3.5 rounded-xl font-bold text-white transition-all duration-300 flex justify-center items-center group ${isLoggingIn ? 
                'bg-slate-400 cursor-not-allowed opacity-70' : 
                isFirstLoginMode ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md transform hover:-translate-y-0.5'}`}
            >
              {isLoggingIn ? (
                <><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div> 處理中...</>
              ) : (
                isFirstLoginMode ? '確認修改並進入學院' : <>登入驗證 <ChevronLeft className="w-5 h-5 ml-1 rotate-180 group-hover:translate-x-1 transition-transform" /></>
              )}
            </button>
            
          </div>
        </div>
      </div>
      </>
    );
  }
  // ==========================================
  // 6. 登入後主畫面 (Main Render)
  // ==========================================
  return (
    <>
    <Toast />
    {showEmailPrompt && (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
          <div className="flex items-center mb-3">
            <Mail className="w-6 h-6 text-blue-600 mr-2" />
            <h3 className="text-lg font-bold text-slate-800">補填聯絡信箱</h3>
          </div>
          <p className="text-sm text-slate-500 mb-4">用來接收必修課逾期提醒，之後隨時可以在這裡更新。</p>
          <input
            type="email" value={promptEmail} onChange={(e) => setPromptEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmitNotifyEmail()}
            placeholder="you@example.com"
            className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-slate-700 mb-2"
            disabled={isLoggingIn}
          />
          {promptEmailError && <p className="text-sm text-red-500 mb-3">{promptEmailError}</p>}
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setShowEmailPrompt(false)}
              className="flex-1 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
            >
              稍後再填
            </button>
            <button
              onClick={handleSubmitNotifyEmail} disabled={isLoggingIn}
              className="flex-1 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {isLoggingIn ? '儲存中...' : '儲存'}
            </button>
          </div>
        </div>
      </div>
    )}
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      {/* --- 左側導航列 --- */}
      <nav className="bg-slate-900 text-slate-300 w-full md:w-64 flex-shrink-0 flex md:flex-col justify-between md:justify-start shadow-xl z-20 fixed md:sticky bottom-0 md:top-0 h-16 md:h-screen">
        <button type="button" className="w-full text-left p-4 md:p-6 hidden md:flex items-center space-x-3 mb-6 cursor-pointer hover:opacity-80 focus-visible:ring-2 focus-visible:ring-blue-400 transition-all" onClick={() => navigateTo('dashboard')}>
          <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-900/50"><Cloud className="w-6 h-6 text-white" /></div>
          <div>
            <span className="text-xl font-bold text-white tracking-wider block">良興雲端學院</span>
            <span className="text-[10px] text-blue-400 font-mono tracking-widest uppercase">Cloud E-Learning</span>
          </div>
        </button>

        <div className="flex md:flex-col w-full px-2 md:px-4 py-2 md:py-0 space-y-0 md:space-y-2 justify-around md:justify-start overflow-y-auto">
          {/* 備註：你原本使用了 <NavItem />，確保這個組件存在，或者直接替換為 button */}
          <button onClick={() => navigateTo('dashboard')} className={`w-full flex items-center justify-center md:justify-start p-3 rounded-xl font-bold transition-colors ${currentView === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><LayoutDashboard className="md:mr-3 w-5 h-5"/> <span className="hidden md:inline">學習儀表板</span></button>
          <button onClick={() => navigateTo('library')} className={`w-full flex items-center justify-center md:justify-start p-3 rounded-xl font-bold transition-colors ${currentView === 'library' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Library className="md:mr-3 w-5 h-5"/> <span className="hidden md:inline">課程資源庫</span></button>
          <button onClick={() => navigateTo('achievements')} className={`w-full flex items-center justify-center md:justify-start p-3 rounded-xl font-bold transition-colors ${currentView === 'achievements' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Award className="md:mr-3 w-5 h-5"/> <span className="hidden md:inline">我的成就</span></button>
          
          {(userProfile?.role === 'manager' || userProfile?.role === 'admin') && (
            <button onClick={() => navigateTo('manager')} className={`w-full flex items-center justify-center md:justify-start p-3 rounded-xl font-bold transition-colors ${currentView === 'manager' ? 'bg-amber-600 text-white' : 'text-amber-500 hover:bg-slate-800'}`}><ShieldCheck className="md:mr-3 w-5 h-5"/> <span className="hidden md:inline">{userProfile?.role === 'admin' ? '系統管理中心' : '主管審核中心'}</span></button>
          )}
        </div>

        <div className="mt-auto p-4 hidden md:flex items-center space-x-3 border-t border-slate-800 bg-slate-900/50 hover:bg-slate-800 transition-colors cursor-default">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-emerald-400 flex items-center justify-center text-white font-bold border-2 border-slate-700 shadow-inner flex-shrink-0">
            {userProfile.name.charAt(0)}
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-white truncate">{userProfile.name}</p>
            <div className="flex items-center mt-1">
              <span className="text-[10px] text-blue-300 font-bold border border-blue-800 bg-blue-900/50 px-1.5 py-0.5 rounded tracking-wider truncate max-w-[80px]">
                {userProfile.userId || userProfile.empId}
              </span>
              {userProfile.role === 'manager' && <span className="text-[10px] text-amber-300 font-bold border border-amber-800 bg-amber-900/50 px-1.5 py-0.5 rounded ml-1 tracking-wider">👑 主管</span>}
              {userProfile.role === 'admin' && <span className="text-[10px] text-blue-300 font-bold border border-blue-800 bg-blue-900/50 px-1.5 py-0.5 rounded ml-1 tracking-wider">⚙️ Admin</span>}
            </div>
          </div>
        </div>
      </nav>

      {/* --- 右側內容區 --- */}
      <main className="flex-1 pb-20 md:pb-0 min-h-screen overflow-y-auto bg-slate-50">
        <header className="bg-white shadow-sm sticky top-0 z-10 hidden md:block border-b border-slate-200">
          <div className="px-8 py-4 flex justify-between items-center max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold text-slate-800 flex items-center">
              {currentView === 'dashboard' && '學習儀表板 (智能引導與個人化路徑)'}
              {currentView === 'library' && '六大頻道資源庫'}
              {currentView === 'achievements' && '六大向度與遊戲化成就'}
              {currentView === 'manager' && <><ShieldCheck className="w-6 h-6 mr-2 text-amber-500"/> {userProfile?.role === 'admin' ? '系統管理中心' : '主管審核中心'}</>}
              {currentView === 'course' && <><BookOpen className="w-6 h-6 mr-2 text-blue-600"/> 課程學習區 (提取練習與微學習)</>}
            </h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm font-bold bg-slate-100 text-slate-600 px-4 py-2 rounded-full flex items-center shadow-inner border border-slate-200">
                <Clock className="w-4 h-4 mr-2 text-blue-500" /> 累積時數: {progressData.totalLearningMinutes} 分鐘
              </span>
              <button onClick={handleLogout} className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors flex items-center">登出</button>
            </div>
          </div>
        </header>

        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {/* ⚠️ 確保這些子元件在你的專案中有被 import */}
          {currentView === 'dashboard' && <DashboardView courses={coursesData} progress={progressData} onStartCourse={(c) => navigateTo('course', c)} onViewAll={() => navigateTo('library')} />}
          {currentView === 'library' && <LibraryView courses={coursesData} progress={progressData} onStartCourse={(c) => navigateTo('course', c)} />}
          {currentView === 'achievements' && <AchievementView progress={progressData} courses={coursesData} />}
          {currentView === 'manager' && <ManagerDashboard onBack={() => navigateTo('dashboard')} userProfile={userProfile} courses={coursesData} />}

          {currentView === 'course' && selectedCourse && (
            <CoursePlayerView
              course={selectedCourse}
              onBack={() => navigateTo('library')}
              onComplete={handleCourseComplete}
              isCompleted={selectedCourse.isCompleted}
              onUpdateProgress={handleUpdateProgress}
              onRefresh={() => fetchDashboardData(userProfile.userId || userProfile.empId)}
              userId={userProfile?.userId || userProfile?.UserId}
              nowPlaying={nowPlaying}
              setNowPlaying={setNowPlaying}
              isAudioPlaying={isAudioPlaying}
              audioSpeed={audioSpeed}
              setAudioSpeed={setAudioSpeed}
            />
          )}
        </div>
      </main>

      {/* 🎵 背景播放 Mini Player */}
      {nowPlaying && currentView !== 'course' && (
        <MiniPlayer
          nowPlaying={nowPlaying}
          isPlaying={isAudioPlaying}
          speed={audioSpeed}
          onSpeedChange={(s) => {
            setAudioSpeed(s);
            globalAudio.playbackRate = s;
          }}
          onTogglePlay={() => isAudioPlaying ? globalAudio.pause() : globalAudio.play()}
          onStop={() => { globalAudio.pause(); globalAudio.src = ''; setNowPlaying(null); setIsAudioPlaying(false); }}
          onGoToCourse={() => {
            const course = coursesData.find(c => c.title === nowPlaying.title);
            if (course) navigateTo('course', course);
          }}
        />
      )}
    </div>
    </>
  );
}

function MiniPlayer({ nowPlaying, isPlaying, speed, onSpeedChange, onTogglePlay, onStop, onGoToCourse }) {
  const config = categoriesConfig[nowPlaying.category] || categoriesConfig['初心補給站'];
  const Icon = config.icon;

  return (
    <div className={`fixed bottom-16 md:bottom-0 left-0 right-0 md:left-64 z-30 ${config.bg} border-t-2 ${config.border} shadow-2xl`}>
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3">
        {/* 頻道圖示 */}
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${config.color}`}>
          <Icon className="w-4 h-4" />
        </div>

        {/* 課程名稱 (點擊跳回課程) */}
        <button onClick={onGoToCourse} className="flex-1 text-left min-w-0">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">背景播放中</p>
          <p className="text-sm font-black text-slate-800 truncate">{nowPlaying.title}</p>
        </button>

        {/* 速度 */}
        <div className="hidden sm:flex items-center gap-1">
          {[0.75, 1.0, 1.25, 1.5, 2.0].map(s => (
            <button key={s} onClick={() => onSpeedChange(s)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${speed === s ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-200'}`}>
              {s}x
            </button>
          ))}
        </div>

        {/* 播放/暫停 */}
        <button onClick={onTogglePlay}
          className="w-9 h-9 rounded-full bg-slate-800 text-white flex items-center justify-center hover:bg-slate-700 transition-colors flex-shrink-0">
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>

        {/* 停止 */}
        <button onClick={onStop} className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0 p-1">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
        </button>
      </div>
    </div>
  );
}

const DASHBOARD_ELECTIVE_PREVIEW_COUNT = 6;

function DashboardView({ courses, progress, onStartCourse, onViewAll }) {
  // 🛡️ 守門員：確保資料存在
  if (!courses || !progress) {
    return <div className="p-10 text-center text-slate-400 font-bold">資料同步中...</div>;
  }

  // 1️⃣ 找出必修課 (處理 Sheets 各種 TRUE 格式)
  const mandatoryCourses = courses.filter(c => 
    c.isMandatory === true || 
    String(c.isMandatory).toUpperCase() === 'TRUE' ||
    c.isMandatory === 1 ||
    c.isMandatory === '1'
  );

  // 2️⃣ 找出選修課
  const electiveCourses = courses.filter(c => !mandatoryCourses.includes(c));

  // 3️⃣ ✨ 計算完成數量 (直接讀取課程物件的 isCompleted，跟成就頁面完全同步)
  const mandatoryCompleted = mandatoryCourses.filter(c => c.isCompleted).length;
  const mandatoryRate = Math.round((mandatoryCompleted / mandatoryCourses.length) * 100) || 0;

  // 4️⃣ 雷達圖數據 (也改用 isCompleted 判定)
  const radarData = React.useMemo(() => {
    const data = [10, 10, 10, 10, 10, 10]; 
    courses.forEach(c => {
      if (c.isCompleted === true) {
        const idx = categoriesConfig[c.category]?.radarIndex;
        if (idx !== undefined) {
          data[idx] = Math.min(100, data[idx] + 45); 
        }
      }
    });
    return data;
  }, [courses]);

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* 🏆 頂部歡迎區塊 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 rounded-2xl p-6 md:p-10 text-white shadow-xl relative overflow-hidden flex flex-col justify-center">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
          <div className="relative z-10">
            <div className="flex items-center space-x-2 mb-4">
              <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-xs font-bold tracking-wider border border-white/30">
                職位專屬地圖：新進人員
              </span>
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold mb-4 leading-tight">準備好升級了嗎？<br/>解鎖你的職場超能力！</h2>
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => {
                  // 自動找第一堂還沒過的必修，都過了就找第一堂選修
                  // 兩者都沒有時不能傳 undefined——那會讓畫面切到課程頁但
                  // selectedCourse 是 null，整片內容區空白
                  const nextCourse = mandatoryCourses.find(c => !c.isCompleted)
                    || electiveCourses.find(c => !c.isCompleted)
                    || electiveCourses[0]
                    || courses[0];
                  if (!nextCourse) {
                    showToast('目前沒有可開始的課程', 'warning');
                    return;
                  }
                  onStartCourse(nextCourse);
                }}
                className="bg-white text-blue-800 font-bold px-8 py-3.5 rounded-xl shadow-lg hover:bg-slate-50 transition-all flex items-center"
              >
                <Play className="w-5 h-5 mr-2" /> 
                {mandatoryCompleted === 0 ? '啟動新手任務' : '接續必修進度'}
              </button>
            </div>
          </div>
        </div>

        {/* 🎯 雷達圖 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col items-center justify-center relative min-h-[300px]">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center absolute top-6 left-6">
            <Map className="w-4 h-4 mr-2 text-indigo-500"/> 六大向度雷達
          </h3>
          <div className="mt-4 w-full h-full">
              <RadarChart data={radarData} />
          </div>
        </div>
      </div>

      {/* 📍 必修任務包 (核心修正區) */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-slate-800 flex items-center">
            <Target className="w-5 h-5 mr-2 text-emerald-500"/> 必修任務包 
            <span className="text-sm font-normal text-slate-500 ml-3">({mandatoryCompleted}/{mandatoryCourses.length} 完成)</span>
          </h3>
          <button onClick={onViewAll} className="text-blue-600 font-bold hover:underline text-sm">
            前往資源庫 {'>'}
          </button>
        </div>
        
        <div className="w-full bg-slate-100 rounded-full h-2.5 mb-6 overflow-hidden">
          <div className="bg-emerald-500 h-2.5 rounded-full transition-all duration-1000" style={{ width: `${mandatoryRate}%` }}></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mandatoryCourses.map(course => (
            <CourseCard 
              key={course.id} 
              course={course} 
              isCompleted={course.isCompleted} 
              onClick={() => onStartCourse(course)} 
            />
          ))}
        </div>
      </div>

      {/* ✨ 選修池：Dashboard 只做快速入口，不重複資源庫的完整瀏覽，
          固定顯示最新 6 堂（3欄 grid 剛好兩整排），其餘導去資源庫 */}
      <div className="pt-8 border-t border-slate-200">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-slate-800 flex items-center">
            <Sparkles className="w-5 h-5 mr-2 text-amber-500"/> T 型選修池
          </h3>
          <button onClick={onViewAll} className="text-blue-600 font-bold hover:underline text-sm">
            更多選修課 {'>'}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {electiveCourses
            .slice()
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
            .slice(0, DASHBOARD_ELECTIVE_PREVIEW_COUNT)
            .map(course => (
              <CourseCard
                key={course.id}
                course={course}
                isCompleted={course.isCompleted}
                onClick={() => onStartCourse(course)}
              />
            ))}
        </div>
      </div>
    </div>
  );
}

const LIBRARY_PREVIEW_COUNT = 4;

function LibraryView({ courses, progress, onStartCourse }) {
  // 1. 確保 categoriesConfig 存在 (這是你定義那 6 個頻道的地方)
  const categories = Object.keys(categoriesConfig);
  const [expandedCats, setExpandedCats] = useState({});

  // 🛡️ 安全檢查：如果 courses 還沒抓到，先顯示載入中
  if (!courses || courses.length === 0) {
    return (
      <div className="text-center py-20 text-slate-400 font-bold animate-pulse">
        正在開啟雲端圖書館...
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up space-y-12 pb-20">
      
      {/* 🏆 頂部大看板 (保留你原本的提示資訊，但視覺升級) */}
      <div className="bg-gradient-to-br from-blue-700 to-indigo-900 rounded-3xl p-8 md:p-10 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="relative z-10">
          <h2 className="text-3xl font-black mb-4 tracking-wide">良興雲端學習地圖</h2>
          <div className="flex items-start bg-white/10 p-4 rounded-xl border border-white/20 backdrop-blur-sm max-w-2xl">
            <Info className="w-5 h-5 text-blue-300 mr-3 flex-shrink-0 mt-0.5" />
            <p className="text-blue-50 text-sm leading-relaxed font-medium">
              我們的課程分為六大主題，結合後台 KSA 戰略建模，讓學習更貼近您的日常需求。
            </p>
          </div>
        </div>
      </div>

      {/* 📚 依照頻道產出課程：六個頻道固定顯示，空頻道顯示「內容製作中」 */}
      {categories.map(catName => {
        // ✨ 強化過濾邏輯：去除前後空格，確保比對精準；依 createdAt 新到舊排序
        const catCourses = courses
          .filter(c => (c.category || "").trim() === catName.trim())
          .slice()
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

        const config = categoriesConfig[catName];
        const Icon = config.icon;
        const isExpanded = !!expandedCats[catName];
        const visibleCourses = isExpanded ? catCourses : catCourses.slice(0, LIBRARY_PREVIEW_COUNT);
        const hasMore = catCourses.length > LIBRARY_PREVIEW_COUNT;

        return (
          <div key={catName} className="space-y-6">

            {/* 🏷️ 分類標題列 */}
            <div className="flex items-center border-b border-slate-200 pb-4">
              <div className={`p-3 rounded-2xl ${config.bg} ${config.color} mr-4 shadow-sm`}>
                <Icon className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">{catName}</h2>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                  HR 戰略維度: {config.backend}
                </p>
              </div>
              <div className="ml-auto">
                 <span className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                   {catCourses.length} 堂課
                 </span>
              </div>
            </div>

            {catCourses.length === 0 ? (
              /* 🚧 空頻道：內容還沒上架，顯示製作中而不是留白或直接消失 */
              <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-14 text-center">
                <Icon className={`w-8 h-8 mx-auto mb-3 ${config.color} opacity-40`} />
                <p className="text-slate-400 font-bold">內容製作中，敬請期待</p>
              </div>
            ) : (
              <>
                {/* 🃏 課程卡片網格 (確保呼叫你原本的 CourseCard) */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                  {visibleCourses.map(course => (
                    <CourseCard
                      key={course.id}
                      course={course}
                      // 統一用後端算好的 course.isCompleted（已含 OJT 核准），
                      // 不要改用 progress.completedCourses 判斷——那份彙總是快取，
                      // OJT 核准後若沒同步就會出現「其他頁顯示完成、資源庫不亮」
                      isCompleted={course.isCompleted === true}
                      onClick={() => onStartCourse(course)}
                    />
                  ))}
                </div>

                {hasMore && (
                  <div className="text-center">
                    <button
                      onClick={() => setExpandedCats(prev => ({ ...prev, [catName]: !prev[catName] }))}
                      className="min-h-[44px] text-sm font-bold text-blue-600 hover:text-blue-800 px-5 py-2 rounded-full border border-blue-200 hover:bg-blue-50 transition-colors"
                    >
                      {isExpanded ? '收合' : `查看更多（還有 ${catCourses.length - LIBRARY_PREVIEW_COUNT} 堂）`}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CourseCard({ course, isCompleted, onClick }) {
  const catConfig = categoriesConfig[course.category] || categoriesConfig['初心補給站'];
  const CatIcon = catConfig.icon;

  return (
    <button type="button" onClick={onClick} className="w-full text-left bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-xl hover:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-400 transition-all cursor-pointer group flex flex-col h-full relative overflow-hidden">
      {isCompleted && (
        <div className="absolute top-0 right-0 bg-emerald-500 text-white text-xs font-bold px-4 py-1.5 rounded-bl-xl shadow-sm z-10 flex items-center">
          <CheckCircle className="w-3 h-3 mr-1" /> 已完課
        </div>
      )}
      
      <div className="flex items-start justify-between mb-4 mt-2">
        <span className={`text-xs font-bold px-3 py-1.5 rounded-lg border flex items-center ${catConfig.bg} ${catConfig.color} ${catConfig.border}`}>
          <CatIcon className="w-3.5 h-3.5 mr-1.5" /> {course.category}
        </span>
        <div className="flex items-center space-x-2">
          {course.isMandatory && (
            <span className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded font-bold">必修</span>
          )}
          <div className="flex items-center text-slate-500 text-sm font-medium bg-slate-50 px-2 py-1 rounded-md">
            <Cloud className="w-3.5 h-3.5 mr-1 text-slate-400" /> {course.duration}
          </div>
        </div>
      </div>

      <h3 className="text-xl font-extrabold text-slate-800 mb-3 group-hover:text-blue-700 transition-colors leading-snug">
        {course.title}
      </h3>
      
      <p className="text-slate-500 text-sm mb-6 line-clamp-3 flex-grow leading-relaxed font-medium">
        {course.summary}
      </p>

      <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between items-center">
        <div>
          <div className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">可解鎖成就</div>
          <div className="flex flex-wrap gap-2">
            {course.badges.map(badge => (
              <span key={badge} className="px-2.5 py-1 bg-slate-100 text-slate-600 border-slate-200 border text-xs font-bold rounded-lg">
                {badge}
              </span>
            ))}
          </div>
        </div>
        {course.ojtRequired && (
          <div className="flex flex-col items-center justify-center text-indigo-500 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100">
            <UploadCloud className="w-4 h-4 mb-0.5" />
            <span className="text-[9px] font-bold">實戰解鎖</span>
          </div>
        )}
      </div>
    </button>
  );
}

function AchievementView({ progress, courses }) {
  // 🛡️ 防呆：確保資料存在
  if (!courses || !progress) return <div className="p-10 text-center text-slate-400 font-bold">成就資料同步中...</div>;

  // 1️⃣ 核心邏輯：計算「職能掌握度」
  const skillStats = React.useMemo(() => {
    if (!courses || courses.length === 0) return [];

    // 找出所有課程中出現過的徽章種類
    const allUniqueBadges = Array.from(new Set(courses.flatMap(c => c.badges || [])));

    return allUniqueBadges.map(badgeName => {
      // 找出與此徽章相關的所有課程
      const relatedCourses = courses.filter(c => c.badges && c.badges.includes(badgeName));
      
      // ✨ 關鍵修正：嚴格且動態的「完課」判定
      const completedCount = relatedCourses.filter(c => {
        // A. 判定是否為 OJT 課程 (包含分類、欄位標記、或已有審核狀態者)
        const isOJT = 
          String(c.category || '').trim() === '實戰解鎖' || 
          c.isOJT === true || 
          c.isOJT === 'TRUE' ||
          (c.ojtStatus && String(c.ojtStatus).trim() !== '');

        if (isOJT) {
          // 🚩 OJT 課程完課標準：
          // 只要主管審核狀態是 'approved'，就視為完成（不論 isCompleted 標籤為何）
          const status = String(c.ojtStatus || '').toLowerCase().trim();
          return status === 'approved';
        }
        
        // 🚩 一般課程完課標準：
        // 依賴原本的 isCompleted 標籤 (即測驗滿分)
        return c.isCompleted === true;
      }).length;

      const totalCount = relatedCourses.length;
      const percentage = Math.round((completedCount / totalCount) * 100) || 0;

      // 當「實質完成數」等於「總數」，且該職能真的有課程時，判定為 Mastered
      const isMastered = totalCount > 0 && completedCount === totalCount;

      return {
        label: badgeName.trim(),
        completed: completedCount,
        total: totalCount,
        percentage,
        isMastered
      };
    });
  }, [courses]);

  // 2️⃣ 核心邏輯：處理「已獲得徽章」的比對 (保留 JSON 與字串格式相容)
  const myEarnedBadges = React.useMemo(() => {
    let raw = progress.earnedBadges || [];
    if (typeof raw === 'string') {
      return raw.replace(/[\[\]"]/g, '').split(',').map(b => b.trim()).filter(b => b !== "");
    }
    if (Array.isArray(raw)) {
      return raw.map(id => String(id).replace(/[\[\]"]/g, '').trim());
    }
    return [];
  }, [progress.earnedBadges]);

  return (
    <div className="animate-fade-in-up space-y-10 pb-20">
      {/* 🏆 頂部看板 */}
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-full -mr-16 -mt-16 opacity-50"></div>
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-100 text-amber-500 mb-4 border-4 border-white shadow-md">
          <Award className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-2">企業職能認證中心</h2>
        <p className="text-slate-500 font-medium tracking-tight font-bold">
          實戰任務經主管審核通過後，將自動點亮對應勳章。
        </p>
      </div>

      {/* 📊 職能達成率 */}
      <section>
        <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center">
          <TrendingUp className="w-6 h-6 mr-2 text-blue-600" /> 職能維度達成率
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {skillStats.map(skill => (
            <div key={skill.label} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                    skill.isMastered ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-50 text-blue-600'
                  }`}>
                    <Award className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-slate-700 text-lg">{skill.label}</span>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-black px-3 py-1 rounded-full ${
                    skill.isMastered ? 'text-emerald-700 bg-emerald-100' : 'text-blue-600 bg-blue-50'
                  }`}>
                    {skill.completed} / {skill.total}
                  </span>
                </div>
              </div>
              <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-1000 ${
                    skill.isMastered ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' : 'bg-gradient-to-r from-blue-500 to-indigo-600'
                  }`} 
                  style={{ width: `${skill.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 🏅 成就徽章牆 */}
      <section>
        <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center">
          <ShieldCheck className="w-6 h-6 mr-2 text-indigo-500" /> 成就徽章牆
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {skillStats.map(skill => {
            // ✨ 雙軌制解鎖：
            // 1. myEarnedBadges 有名字 (後端直接發放)
            // 2. skill.isMastered 為 true (前端計算所有相關課皆已 Approved)
            const isEarned = myEarnedBadges.includes(skill.label) || skill.isMastered;
            
            return (
              <div key={skill.label} className={`relative p-6 rounded-2xl border-2 flex flex-col items-center justify-center text-center transition-all duration-500 ${
                isEarned 
                  ? `bg-white border-blue-200 shadow-lg transform scale-100` 
                  : 'bg-slate-50 border-slate-100 opacity-40 grayscale-[90%] scale-95' 
              }`}>
                {isEarned && (
                  <div className="absolute top-2 right-2 animate-bounce-subtle">
                    <CheckCircle className="w-5 h-5 text-emerald-500 bg-white rounded-full shadow-sm" />
                  </div>
                )}
                <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${
                  isEarned ? 'bg-gradient-to-br from-blue-50 to-indigo-50' : 'bg-slate-100'
                }`}>
                  <Award className={`w-7 h-7 ${isEarned ? 'text-blue-600' : 'text-slate-400'}`} />
                </div>
                <span className={`font-black text-xs ${isEarned ? 'text-slate-800' : 'text-slate-400'}`}>
                  {skill.label}
                </span>
                <span className={`text-[10px] mt-1 font-bold ${isEarned ? 'text-blue-500' : 'text-slate-400'}`}>
                  {isEarned ? 'MASTERED' : 'LOCKED'}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ==========================================
// 👑 主管管理中心（三 Tab 版）
// ==========================================
function ManagerDashboard({ onBack, userProfile, courses }) {
  const [activeTab, setActiveTab] = useState('ojt');
  const [tasks, setTasks]               = useState([]);
  const [deptReport, setDeptReport]     = useState(null);
  const [deptMandatory, setDeptMandatory] = useState(new Set());
  const [departments, setDepartments]   = useState([]);
  const [selectedDept, setSelectedDept] = useState(userProfile?.department || '');
  const [isLoading, setIsLoading]       = useState(false);

  const isAdmin   = userProfile?.role === 'admin';
  const userId    = userProfile?.userId || userProfile?.empId;

  // 切 tab 時重新拉資料
  useEffect(() => {
    if (activeTab === 'ojt')      fetchPendingTasks();
    if (activeTab === 'report')   fetchDeptReport();
    if (activeTab === 'settings') fetchDeptMandatory();
  }, [activeTab, selectedDept]);

  // admin 進入時先拉部門清單
  useEffect(() => {
    if (isAdmin) {
      gasClient.securePost('getDepartments', { requestUserId: userId })
        .then(res => { if (res.status === 'success') setDepartments(res.departments || []); });
    }
  }, []);

  async function fetchPendingTasks() {
    setIsLoading(true);
    try {
      const res = await gasClient.securePost('getPendingOJTTasks', {
        requestUserId: userId
      });
      if (res.success || res.status === 'success') {
        setTasks(res.tasks || res.data?.tasks || []);
      } else {
        // 不能靜默忽略——session 過期時會顯示成「目前沒有待審核作業」
        showToast(res.message || '待審清單載入失敗', 'error');
      }
    } finally { setIsLoading(false); }
  }

  async function fetchDeptReport() {
    if (!selectedDept) return;
    setIsLoading(true);
    try {
      const res = await gasClient.securePost('getDeptReport', { deptId: selectedDept, requestUserId: userId });
      if (res.status === 'success') setDeptReport(res.data);
      else showToast(res.message || '部門報表載入失敗', 'error');
    } finally { setIsLoading(false); }
  }

  async function fetchDeptMandatory() {
    if (!selectedDept) return;
    setIsLoading(true);
    try {
      const res = await gasClient.securePost('getDeptMandatory', { deptId: selectedDept, requestUserId: userId });
      if (res.status === 'success') setDeptMandatory(new Set(res.courseIds || []));
      else showToast(res.message || '必修課設定載入失敗', 'error');
    } finally { setIsLoading(false); }
  }

  async function handleReview(task, newStatus) {
    if (!window.confirm(newStatus === 'approved' ? '確定核准？' : '確定退回？')) return;
    // 傳 taskId 讓後端定位，不靠 rowNumber（列號會因插入/刪除列而位移）
    const res = await gasClient.securePost('reviewOJTTask', {
      taskId: task.taskId,
      rowNumber: task.rowNumber,
      newStatus,
      requestUserId: userId
    });
    if (res.success) {
      showToast(newStatus === 'approved' ? '已核准！' : '已退回！', newStatus === 'approved' ? 'success' : 'info');
      fetchPendingTasks();
    } else {
      showToast(res.message || '審核失敗', 'error');
      fetchPendingTasks(); // 可能是別人已經審過了，重抓最新狀態
    }
  }

  async function handleToggleMandatory(courseId, currentlyOn) {
    // 先確認後端寫入成功才更新 UI，否則寫入失敗畫面仍會顯示已開啟
    const res = await gasClient.securePost('setDeptMandatory', {
      deptId: selectedDept, courseId, isAdd: !currentlyOn, requestUserId: userId
    });
    if (res.status !== 'success') {
      showToast(res.message || '設定失敗，請重試', 'error');
      return;
    }
    setDeptMandatory(prev => {
      const next = new Set(prev);
      currentlyOn ? next.delete(courseId) : next.add(courseId);
      return next;
    });
  }

  const tabs = [
    { key: 'ojt',      label: 'OJT 作業審核' },
    { key: 'report',   label: '部門學習狀況' },
    { key: 'settings', label: '必修課設定' },
  ];

  return (
    <div className="max-w-5xl mx-auto p-4 mt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <ShieldCheck className="w-7 h-7 text-blue-600" /> 管理中心
        </h2>
        <button onClick={onBack} className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium">
          ← 返回
        </button>
      </div>

      {/* admin 部門選擇 */}
      {isAdmin && (
        <div className="mb-4 flex items-center gap-3">
          <span className="text-sm text-slate-500 font-medium">查看部門：</span>
          <select value={selectedDept} onChange={e => setSelectedDept(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">請選擇</option>
            {departments.map(d => (
              <option key={d.deptId} value={d.deptId}>{d.deptId}（{d.employeeCount} 人）</option>
            ))}
          </select>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === t.key ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      )}

      {/* ── Tab 1: OJT 審核 ── */}
      {!isLoading && activeTab === 'ojt' && (
        tasks.length === 0 ? (
          <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
            <div className="text-4xl mb-3">🎉</div>
            <p className="font-bold text-slate-700">目前沒有待審核作業</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map(task => (
              <div key={task.taskId || task.TaskId}
                className="p-5 bg-white border border-slate-200 rounded-xl flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded">待審核</span>
                    <span className="text-xs font-mono text-slate-400">{task.taskId || task.TaskId}</span>
                  </div>
                  <p className="font-semibold text-slate-800">
                    {task.userName || task.UserId} <span className="text-slate-400 font-normal text-sm">（{task.userId || task.UserId}）</span>
                  </p>
                  <p className="text-sm text-slate-500 mt-0.5">{task.courseTitle || task.CourseId}</p>
                  <a href={task.ojtFileUrl || task.OjtFileUrl} target="_blank" rel="noreferrer"
                    className="inline-flex items-center text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-sm mt-2 transition-colors">
                    <ExternalLink className="w-4 h-4 mr-1.5" /> 預覽作業
                  </a>
                </div>
                <div className="flex md:flex-col gap-2 min-w-[110px]">
                  <button onClick={() => handleReview(task, 'approved')}
                    className="flex-1 py-2 bg-emerald-500 text-white text-sm font-bold rounded-lg hover:bg-emerald-600">✅ 核准</button>
                  <button onClick={() => handleReview(task, 'rejected')}
                    className="flex-1 py-2 border-2 border-slate-200 text-slate-600 text-sm font-bold rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200">❌ 退回</button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Tab 2: 部門學習狀況 ── */}
      {!isLoading && activeTab === 'report' && (
        !selectedDept ? (
          <p className="text-slate-400 text-center py-12">請先選擇部門</p>
        ) : !deptReport ? (
          <p className="text-slate-400 text-center py-12">無資料</p>
        ) : (
          <div className="space-y-6">
            {/* 摘要卡片 */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: '部門人數', value: deptReport.totalUsers, unit: '人' },
                { label: '必修課數', value: deptReport.mandatoryCourseCount, unit: '門' },
                { label: '必修完成率', value: deptReport.overallMandatoryRate, unit: '%',
                  color: deptReport.overallMandatoryRate >= 80 ? 'text-emerald-600' : deptReport.overallMandatoryRate >= 50 ? 'text-amber-600' : 'text-red-600' },
              ].map(card => (
                <div key={card.label} className="bg-white border border-slate-200 rounded-2xl p-4 text-center">
                  <p className="text-xs text-slate-400 mb-1">{card.label}</p>
                  <p className={`text-3xl font-extrabold ${card.color || 'text-slate-800'}`}>{card.value}<span className="text-base font-normal text-slate-400 ml-1">{card.unit}</span></p>
                </div>
              ))}
            </div>

            {/* 必修課完成率 */}
            {deptReport.courseStats.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5">
                <h3 className="font-bold text-slate-700 mb-4">必修課程完成情況</h3>
                <div className="space-y-3">
                  {deptReport.courseStats.map(c => (
                    <div key={c.courseId}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-700 font-medium truncate mr-2">{c.title}</span>
                        <span className="text-slate-500 whitespace-nowrap">{c.completedCount}/{c.totalUsers} 人（{c.completionRate}%）</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${c.completionRate >= 80 ? 'bg-emerald-400' : c.completionRate >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                          style={{ width: `${c.completionRate}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 員工明細 */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-700">員工學習明細</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {deptReport.employees.map(emp => (
                  <div key={emp.userId} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-slate-800">{emp.name} <span className="text-xs text-slate-400 font-normal">{emp.userId}</span></p>
                        <p className="text-sm text-slate-500 mt-0.5">
                          已完成 {emp.completedCount}/{emp.totalCourses} 門｜必修 {emp.mandatoryCompleted}/{emp.mandatoryTotal} 門
                        </p>
                      </div>
                      {emp.mandatoryIncomplete.length === 0 ? (
                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg whitespace-nowrap">✓ 必修完成</span>
                      ) : (
                        <span className="px-2.5 py-1 bg-red-50 text-red-700 text-xs font-bold rounded-lg whitespace-nowrap">⚠ 缺 {emp.mandatoryIncomplete.length} 門</span>
                      )}
                    </div>
                    {emp.mandatoryIncomplete.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {emp.mandatoryIncomplete.map(c => (
                          <span key={c.courseId} className="px-2 py-0.5 bg-red-50 text-red-600 text-xs rounded border border-red-100">{c.title}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      )}

      {/* ── Tab 3: 必修課設定 ── */}
      {!isLoading && activeTab === 'settings' && (
        !selectedDept ? (
          <p className="text-slate-400 text-center py-12">請先選擇部門</p>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-700">設定「{selectedDept}」部門必修課</h3>
              <p className="text-xs text-slate-400 mt-1">全域必修課已固定，這裡只能設定部門加選的必修課程</p>
            </div>
            <div className="divide-y divide-slate-100">
              {(courses || []).filter(c => !(c.isMandatory && !deptMandatory.has(c.id))).length === 0 && (
                <p className="text-slate-400 text-center py-8 text-sm">無課程可設定</p>
              )}
              {(courses || []).map(c => {
                const courseId = c.id || c.CourseId;
                const isDeptMandatory = deptMandatory.has(courseId);
                // 用後端獨立提供的 isGlobalMandatory，不要從 c.isMandatory 反推——
                // 那個旗標已經疊加了「檢視者自己部門」的必修，admin 看別部門時
                // 會把自己部門的加選誤判成全域必修、鎖住無法切換
                const isGlobalMandatory = c.isGlobalMandatory === true;
                return (
                  <div key={courseId} className="px-5 py-3.5 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-slate-700 text-sm">{c.title}</p>
                      <p className="text-xs text-slate-400">{c.category}</p>
                    </div>
                    {isGlobalMandatory ? (
                      <span className="px-2.5 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-lg whitespace-nowrap">全域必修</span>
                    ) : (
                      <button onClick={() => handleToggleMandatory(courseId, isDeptMandatory)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                          isDeptMandatory ? 'bg-blue-600' : 'bg-slate-200'
                        }`}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          isDeptMandatory ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}
    </div>
  );
}

// ⚠️ 請確保檔案最上方有這行 (新增了 Mic)
// import { ChevronLeft, BookOpen, FileText, CheckCircle, Info, Award, Sparkles, Mic, Cloud, Target, Clock } from 'lucide-react';

const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5, 2.0];

function CoursePlayerView({ course, onBack, onComplete, isCompleted, onUpdateProgress, onRefresh, userId,
  nowPlaying, setNowPlaying, isAudioPlaying, audioSpeed, setAudioSpeed }) {
  // 1. 狀態管理
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('quiz');
  // audioSpeed/setAudioSpeed 來自 App，統一由 globalAudio 管理
  const playbackSpeed = audioSpeed ?? 1.0;

  // 2. 自動置頂
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // 2.5 課程內容（摘要＋題目）改成點開課程時才拉。
  // 課程清單不再夾帶這兩項，首屏才不用付整表序列化的代價。
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(true);

  const loadDetail = React.useCallback(async () => {
    if (!course.id || !userId) return;
    setDetailLoading(true);
    try {
      const res = await gasClient.securePost('getCourseDetail', {
        courseId: course.id,
        userId
      });
      setDetail(res?.status === 'success' ? res.data : { AiSummary: '', quiz: [] });
    } catch (e) {
      console.error('課程內容載入失敗', e);
      setDetail({ AiSummary: '', quiz: [] });
    } finally {
      setDetailLoading(false);
    }
  }, [course.id, userId]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  // 3. ✨ 隱形碼錶：紀錄學習時間
  //
  // 用 ref 存回呼與起算時間，effect 依賴只留 course.id。
  // 原本依賴 onUpdateProgress（每次 render 都是新函式）與 course.title，
  // 導致 App 每重繪一次 effect 就重跑、startTime 歸零，時數幾乎永遠寫 0。
  const onUpdateProgressRef = useRef(onUpdateProgress);
  useEffect(() => { onUpdateProgressRef.current = onUpdateProgress; }, [onUpdateProgress]);

  useEffect(() => {
    const startTime = Date.now();
    const courseId  = course.id;

    return () => {
      const spentMinutes = Math.floor((Date.now() - startTime) / 60000);
      if (spentMinutes > 0 && onUpdateProgressRef.current) {
        onUpdateProgressRef.current(courseId, spentMinutes);
      }
    };
  }, [course.id]);

  // 4. 🪄 網址轉換引擎
  const isDriveUrl = (url) =>
    typeof url === 'string' && url.includes('drive.google.com');

  const convertDriveLink = (url, type) => {
    if (!url || typeof url !== 'string') return null;

    const match = url.match(/\/d\/([^/?]+)|[?&]id=([^&]+)/);
    const fileId = match ? (match[1] || match[2]) : null;

    // Google Drive URL → 一律使用 /preview（iframe 模式，CORS 穩定）
    if (fileId) return `https://drive.google.com/file/d/${fileId}/preview`;

    // 非 Drive URL（直接 CDN）→ 原樣回傳，讓 <audio> 自行處理
    return url;
  };

  // 5. 🤖 處理召喚 AI
  const handleGenerateAI = async () => {
    const courseId = course.id || course.CourseId;
    if (!courseId) {
      showToast('找不到課程 ID，請重新整理後再試。', 'error');
      return;
    }
    setIsGenerating(true);
    try {
      const res = await gasClient.securePost('generateAiContent', { courseId, userId });
      if (res.success || res.status === 'success') {
        showToast('AI 助教已完成重點摘要與測驗題目！', 'success');
        await loadDetail();          // 重新拉摘要與題目
        if (onRefresh) onRefresh();  // 更新課程清單的 hasQuiz/hasSummary 旗標
      } else {
        showToast(res.message || 'AI 助教產出失敗，請稍後再試。', 'error');
      }
    } catch (e) {
      showToast('AI 助教連線失敗，請稍後再試。', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // 6. 資料防彈處理
  const materialType = course.materialType || 'video';
  const safeCourse = {
    ...course,
    title: course.title || "未命名課程",
    category: course.category || "初心補給站",
    materialType,
    materialUrl: convertDriveLink(course.materialUrl, materialType) || "",
    keyPoints: Array.isArray(course.keyPoints) ? course.keyPoints : [],
    badges: Array.isArray(course.badges) ? course.badges : [],
    transcript: course.transcript || "暫無逐字稿"
  };

  // 速度變更時同步到 globalAudio
  const handleSpeedChange = (speed) => {
    setAudioSpeed(speed);
    globalAudio.playbackRate = speed;
  };

  // 原始 URL（未轉換）是否為 Google Drive
  const sourceIsDrive = isDriveUrl(course.materialUrl);

  // 載入音訊到 globalAudio 並開始播放（只有非 Drive 直連才使用）
  const handlePlayAudio = () => {
    if (globalAudio.src !== safeCourse.materialUrl) {
      globalAudio.src = safeCourse.materialUrl;
      globalAudio.load();
    }
    globalAudio.playbackRate = playbackSpeed;
    globalAudio.play();
    setNowPlaying({ src: safeCourse.materialUrl, title: safeCourse.title, category: safeCourse.category });
  };

  const isThisCourseNowPlaying = nowPlaying?.src === safeCourse.materialUrl;

  // 7. 渲染播放器
  const renderPlayer = () => {
    // Google Drive 音訊 → iframe（穩定，無 CORS 問題，不支援速度控制）
    if (safeCourse.materialType === 'audio' && sourceIsDrive) {
      return (
        <iframe
          src={safeCourse.materialUrl}
          className="w-full h-full border-none"
          allow="autoplay"
        />
      );
    }

    // 直連 CDN 音訊 → 原生 <audio>，支援速度控制與背景播放
    if (safeCourse.materialType === 'audio' && !sourceIsDrive) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 p-6 gap-5">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (!isThisCourseNowPlaying) { handlePlayAudio(); return; }
                isAudioPlaying ? globalAudio.pause() : globalAudio.play();
              }}
              className="w-14 h-14 rounded-full bg-amber-400 text-slate-900 flex items-center justify-center shadow-lg hover:bg-amber-300 transition-all"
            >
              {isThisCourseNowPlaying && isAudioPlaying
                ? <Pause className="w-6 h-6" />
                : <Play className="w-6 h-6 ml-0.5" />}
            </button>
            <div className="text-white">
              <p className="font-black text-base">{safeCourse.title}</p>
              <p className="text-slate-400 text-xs mt-0.5">
                {isThisCourseNowPlaying && isAudioPlaying ? '播放中 — 可切換頁面背景聆聽' : '點擊播放'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs font-bold mr-1">播放速度</span>
            {SPEED_OPTIONS.map(s => (
              <button key={s} onClick={() => handleSpeedChange(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  playbackSpeed === s ? 'bg-amber-400 text-slate-900 shadow-md scale-105' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}>
                {s}x
              </button>
            ))}
          </div>
        </div>
      );
    }

    // 外部連結型課程(如互動網頁、學習地圖)→ 開新分頁按鈕,不用 iframe 硬嵌
    if (safeCourse.materialType === 'link') {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 gap-5 p-6">
          <div className="w-16 h-16 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center">
            <Map className="w-8 h-8" />
          </div>
          <p className="text-white font-bold text-center">{safeCourse.title}</p>
          <a
            href={safeCourse.materialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-xl font-bold shadow-lg hover:bg-blue-400 transition-all"
          >
            前往學習地圖 <ExternalLink className="w-4 h-4" />
          </a>
          <p className="text-slate-400 text-xs">看完後,回來下方完成小測驗即可完課</p>
        </div>
      );
    }

    // 影片 / 其他 → iframe
    return (
      <div className="w-full h-full bg-black relative">
        <iframe
          src={safeCourse.materialUrl}
          className="absolute top-0 left-0 w-full h-full border-none"
          allow="autoplay; fullscreen"
          loading="lazy"
        />
      </div>
    );
  };


  return (
    <div className="animate-fade-in pb-20 max-w-5xl mx-auto px-4">
      {/* 返回導航 */}
      <button onClick={onBack} className="flex items-center text-slate-500 hover:text-blue-600 mb-6 font-bold transition-colors">
        ← 返回資源庫
      </button>

      {/* 標題區 */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-600 text-[10px] font-bold uppercase">
            {safeCourse.category}
          </span>
          {safeCourse.materialType === 'audio' && (
            <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold">Podcast 模式</span>
          )}
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">{safeCourse.title}</h1>
      </div>

      {/* 播放區域：audio 縮小高度，video 維持 16:9 */}
      <div className="mb-10 relative">
        <div className={`relative w-full bg-slate-900 rounded-2xl shadow-xl overflow-hidden border-2 border-slate-200 flex items-center justify-center ${
          safeCourse.materialType === 'audio' ? 'h-36 md:h-28' : 'aspect-video rounded-3xl border-4 border-white shadow-2xl'
        }`}>
          {renderPlayer()}
        </div>
      </div>

      {/* ✨ AI 智慧摘要區塊 */}
<div className="mb-10">
  {/* 💡 強化判定：確保內容不是空的，也不是空的 JSON 陣列 */}
  {detailLoading ? (
    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 text-center text-slate-400 font-bold animate-pulse">
      載入課程內容中...
    </div>
  ) : detail?.AiSummary && String(detail.AiSummary).trim() !== "" && detail.AiSummary !== "[]" ? (
    <div className="p-6 bg-gradient-to-br from-indigo-50 to-white rounded-3xl border border-indigo-100 shadow-sm animate-in fade-in duration-500">
      <h3 className="flex items-center text-indigo-900 font-bold mb-4 text-lg">
        <Sparkles className="w-5 h-5 mr-2 text-indigo-500" />
        AI 智慧助教：本課精華
      </h3>
      <div className="grid grid-cols-1 gap-3">
        {(() => {
          try {
            const points = JSON.parse(detail.AiSummary);
            // 確保解析出來的是有內容的陣列
            if (Array.isArray(points) && points.length > 0) {
              return points.map((point, index) => (
                <div key={index} className="flex items-start bg-white/60 p-3 rounded-xl border border-indigo-50">
                  <span className="flex-shrink-0 w-6 h-6 bg-indigo-600 text-white rounded-full text-xs flex items-center justify-center font-bold mr-3 mt-0.5">
                    {index + 1}
                  </span>
                  <p className="text-slate-700 leading-relaxed font-medium">{point}</p>
                </div>
              ));
            }
            return <p className="text-slate-400 italic text-sm">摘要內容格式有誤</p>;
          } catch (e) {
            // 如果不是 JSON，則嘗試直接顯示文字內容
            return <p className="text-slate-700 p-2">{detail.AiSummary}</p>;
          }
        })()}
      </div>
    </div>
  ) : (
    <button
      onClick={handleGenerateAI}
      disabled={isGenerating}
      className="w-full py-10 bg-white border-2 border-dashed border-indigo-200 rounded-3xl text-indigo-500 font-bold hover:bg-indigo-50 hover:border-indigo-400 transition-all flex flex-col items-center justify-center"
    >
      {isGenerating ? (
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <span>AI 正在分析課程中...</span>
        </div>
      ) : (
        <>
          <Sparkles className="w-6 h-6 mb-2" />
          <span>召喚 AI 智慧助教生成摘要</span>
        </>
      )}
    </button>
  )}
</div>

      {/* 下方分頁與資訊 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            
            {/* 🔘 標籤按鈕區 */}
            <div className="flex border-b border-slate-200 bg-slate-50/50">
              
              {/* 🥇 第一順位：隨堂測驗 */}
              <button 
                onClick={() => setActiveTab('quiz')} 
                className={`p-4 text-sm font-bold flex-1 transition-colors ${activeTab === 'quiz' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'}`}
              >
                隨堂測驗
              </button>

              {/* 🥈 第二順位：實戰任務 (只有在 course.ojtRequired 為 true 時才長出來！) */}
              {course.ojtRequired && (
                <button 
                  onClick={() => setActiveTab('ojt')} 
                  className={`p-4 text-sm font-bold flex-1 transition-colors ${activeTab === 'ojt' ? 'bg-white text-amber-600 border-b-2 border-amber-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'}`}
                >
                  實戰任務 (OJT)
                </button>
              )}

              {/* 🥉 隱藏區：未來講義跟逐字稿做好了，把註解拿掉就會出現了 */}
              {/* <button onClick={() => setActiveTab('summary')} className={`p-4 text-sm font-bold flex-1 ${activeTab === 'summary' ? 'bg-white text-blue-600' : 'text-slate-400'}`}>重點講義</button>
              <button onClick={() => setActiveTab('transcript')} className={`p-4 text-sm font-bold flex-1 ${activeTab === 'transcript' ? 'bg-white text-blue-600' : 'text-slate-400'}`}>逐字稿</button>
              */}
            </div>

            {/* 📄 內容顯示區 */}
            <div className="p-8 min-h-[400px]">
              
              {/* 1️⃣ ✨ 第一個房間：隨堂測驗 (房間門牌：quiz) - 只會執行 QuizSection */}
              {activeTab === 'quiz' && (
                <div className="animate-fade-in">
                  {/* 🚨 這裡必須是呼叫你的題目組件：QuizSection！ */}
                  {/* 如果你的題目長在這裡，那就絕對不能在下面塞「上傳按鈕」的程式碼 */}
                  <QuizSection
                    course={course}
                    quiz={detail?.quiz}
                    isLoading={detailLoading}
                    isAlreadyPassed={isCompleted}
                    badges={safeCourse.badges}
                    userId={userId}
                    onSubmit={(score) => {
                      if (score === 100) {
                        onComplete(safeCourse.badges);
                      }
                    }}
                  />
                  {/* (檢查看看是不是這一行下面不小心多出了上傳照片的代碼？如果有，把它刪掉) */}
                </div>
              )}

             {/* 2️⃣ 第二個房間：實戰任務 (OJT) */}
              {activeTab === 'ojt' && course.ojtRequired && (
                <div className="animate-fade-in">
                  {/* ✨ 放上真正的 OJT 組件！ */}
                  <OJTSection course={course} isAlreadyPassed={isCompleted} />
                </div>
              )}

            </div>
          </div>
        </div>
        
        {/* 側邊資訊 */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 h-fit">
          <h3 className="font-black text-slate-800 mb-6 text-lg">課程資訊</h3>
          <div className="space-y-6">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400 font-bold">預估時長</span>
                <span className="text-slate-800 font-black">{safeCourse.duration} 分鐘</span>
              </div>
              <div className="pt-4 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-400 block mb-3 uppercase tracking-widest">完課獲得徽章</span>
                <div className="flex flex-wrap gap-2">
                  {safeCourse.badges.map(badge => (
                     <span key={badge} className="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-lg border border-blue-100">#{badge}</span>
                  ))}
                </div>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuizSection({ course, quiz, isLoading, onSubmit, isAlreadyPassed, badges, userId }) {
  // --- 1. 資料整合層 ---
  // 題目由 CoursePlayerView 透過 getCourseDetail 取得後傳進來（不再夾在課程清單裡）。
  // 過濾掉缺 question 或 options 的殘缺題目——AI 產出偶爾會少欄位，
  // 沒過濾的話 q.options.map 會直接讓整頁白畫面、該課永久打不開。
  const quizData = useMemo(() => {
    const source = Array.isArray(quiz) ? quiz : [];
    return source.filter(q => q && q.question && Array.isArray(q.options) && q.options.length > 0);
  }, [quiz]);

  const hasQuiz = quizData.length > 0;

  // --- 2. 狀態管理 (拔除所有 OJT 邏輯) ---
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  // --- 3. 邏輯處理 ---
  const handleSelect = (qIndex, oIndex) => {
    if (submitted || isAlreadyPassed) return;
    setAnswers({ ...answers, [qIndex]: oIndex });
  };

  const handleSubmitQuiz = async () => {
    if (!hasQuiz) return;
    if (Object.keys(answers).length < quizData.length) {
      showToast('請回答所有問題後再送出！', 'warning');
      return;
    }

    try {
      const courseId = course.id || course.CourseId;
      const answersArr = quizData.map((_, idx) => (answers[idx] !== undefined ? answers[idx] : -1));

      const result = await gasClient.securePost('submitQuiz', {
        userId: userId,
        courseId: courseId,
        answers: answersArr
      });

      if (result.status !== 'success') {
        showToast(result.message || '判分失敗，請再試一次', 'error');
        return;
      }

      const finalScore = result.score;
      setScore(finalScore);
      setSubmitted(true);

      if (finalScore === 100) {
        const isOJT = String(course.category).trim() === '實戰解鎖';
        if (isOJT) {
          showToast('測驗滿分！請完成下方實戰檔案上傳，待管理員審核後才算正式完課。', 'warning');
        } else {
          onSubmit(finalScore);
        }
      }
    } catch (err) {
      showToast('連線異常，請稍後再試', 'error');
    }
  };

  const resetQuiz = () => { setAnswers({}); setSubmitted(false); setScore(0); };

  // --- 畫面渲染 ---
  if (isLoading) {
    return <div className="text-center py-10 text-slate-400 font-bold bg-slate-50 rounded-2xl animate-pulse">載入測驗題目中...</div>;
  }

  if (isAlreadyPassed || (submitted && score === 100)) {
    return (
      <div className="text-center py-12 animate-fade-in bg-emerald-50 rounded-2xl border border-emerald-100 shadow-sm">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-emerald-100 text-emerald-500 mb-6 border-4 border-white shadow-inner">
          <Award className="w-12 h-12" />
        </div>
        <h3 className="text-2xl font-black text-slate-800 mb-2">挑戰成功！</h3>
        <p className="text-slate-600 mb-8 font-medium">測驗紀錄已同步至雲端後台。</p>
        <div className="flex justify-center gap-2">
           {badges.map(b => <span key={b} className="px-3 py-1 bg-blue-100 text-blue-600 text-xs font-bold rounded-lg border border-blue-200">#{b}</span>)}
        </div>
      </div>
    );
  }

  if (submitted && score < 100 && hasQuiz) {
    return (
      <div className="text-center py-12 bg-red-50 rounded-2xl border border-red-100">
        <div className="text-4xl font-black text-red-500 mb-4">{score} 分</div>
        <h3 className="text-xl font-bold text-slate-800 mb-4">未達標 (需 100 分)</h3>
        <button onClick={resetQuiz} className="px-8 py-3 bg-red-500 text-white rounded-xl font-bold shadow-lg">重新挑戰</button>
      </div>
    );
  }

  if (!hasQuiz) return <div className="text-center py-10 text-slate-400 font-bold bg-slate-50 rounded-2xl">本課程暫無測驗題目。</div>;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center border-b pb-4 border-slate-200">
         <h3 className="text-lg font-black text-slate-800">結業提取測驗</h3>
         <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded font-bold">需全對及格</span>
      </div>
      {quizData.map((q, qIndex) => (
        <div key={qIndex} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="font-extrabold text-slate-800 mb-5 leading-relaxed">
            <span className="text-blue-600 mr-2">{qIndex + 1}.</span> {q.question}
          </p>
          <div className="space-y-3">
            {q.options.map((option, oIndex) => {
              const isSelected = answers[qIndex] === oIndex;
              // 真的 <input type="radio"> 才有原生鍵盤操作（Tab/方向鍵/空白鍵）與
              // 螢幕閱讀器語意；視覺上用 sr-only 藏起來，圓圈 div 純裝飾（aria-hidden）。
              return (
                <label
                  key={oIndex}
                  className={`flex items-center p-4 rounded-xl border-2 cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-400 transition-all ${isSelected ? 'border-blue-500 bg-blue-50 text-blue-800 font-bold' : 'border-slate-100 text-slate-600'}`}
                >
                  <input
                    type="radio"
                    name={`quiz-q${qIndex}`}
                    checked={isSelected}
                    onChange={() => handleSelect(qIndex, oIndex)}
                    className="sr-only"
                  />
                  <div aria-hidden="true" className={`w-4 h-4 rounded-full border mr-3 flex-shrink-0 flex items-center justify-center ${isSelected ? 'border-blue-500 bg-blue-500' : 'border-slate-300'}`}>
                    {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                  </div>
                  {option}
                </label>
              );
            })}
          </div>
        </div>
      ))}
      <button onClick={handleSubmitQuiz} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg hover:bg-blue-700 transition-all text-lg">
        正式送出答案
      </button>
    </div>
  );
}

function OJTSection({ course }) {
  const initialStatus = (course.ojtStatus || '').toLowerCase();
  const [ojtStatus, setOjtStatus] = useState(initialStatus || 'idle'); 
  const [ojtLink, setOjtLink] = useState(''); // 新增：用於儲存輸入的連結
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (course.ojtStatus) {
      setOjtStatus(course.ojtStatus.toLowerCase());
    }
  }, [course.ojtStatus]);

  // --- 核心功能 A：處理檔案上傳 ---
  const handleOjtUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      if (file.size > 5 * 1024 * 1024) {
        showToast('檔案請勿超過 5MB！', 'error');
        return;
      }

      const storedUser = localStorage.getItem('cloud_academy_user');
      const currentUserId = storedUser ? (JSON.parse(storedUser).userId || JSON.parse(storedUser).UserId) : null;
      if (!currentUserId) {
        showToast('系統找不到您的登入資訊，請重新整理網頁。', 'error');
        return;
      }

      setOjtStatus('uploading');
      const reader = new FileReader();

      reader.onload = async () => {
        try {
          const base64String = reader.result.split(',')[1];
          const response = await gasClient.securePost('submitOJT', {
            userId: currentUserId,
            courseId: course.id || course.CourseId,
            fileName: file.name,
            mimeType: file.type,
            base64Data: base64String,
            submitType: 'file' // 標註為檔案提交
          });

          if (response.status === 'success') {
            setOjtStatus('pending');
            showToast('檔案上傳成功！等待主管審核中。', 'success');
          } else {
            throw new Error(response.message);
          }
        } catch (error) {
          showToast('上傳失敗：' + error.message, 'error');
          setOjtStatus('idle');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // --- 核心功能 B：處理連結提交 ---
  const handleLinkSubmit = async () => {
    if (!ojtLink || !ojtLink.startsWith('http')) {
      showToast('請輸入正確的網址連結！', 'warning');
      return;
    }

    const storedUser2 = localStorage.getItem('cloud_academy_user');
    const currentUserId = storedUser2 ? (JSON.parse(storedUser2).userId || JSON.parse(storedUser2).UserId) : null;
    setOjtStatus('uploading');

    try {
      const response = await gasClient.securePost('submitOJT', {
        userId: currentUserId,
        courseId: course.id || course.CourseId,
        linkUrl: ojtLink,
        submitType: 'link' // 標註為連結提交
      });

      if (response.status === 'success') {
        setOjtStatus('pending');
        showToast('連結提交成功！等待主管審核中。', 'success');
      } else {
        throw new Error(response.message);
      }
    } catch (error) {
      showToast('提交失敗：' + error.message, 'error');
      setOjtStatus('idle');
    }
  };

  // --- 畫面渲染 ---

  if (ojtStatus === 'approved') {
    return (
      <div className="text-center py-10 text-emerald-600 font-bold bg-emerald-50 rounded-2xl border-2 border-emerald-100 animate-fade-in">
        <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-black">主管已核准您的實戰任務！</h3>
        <p className="text-emerald-500/70 text-sm mt-1">恭喜完課，職能已點亮。</p>
      </div>
    );
  }

  if (ojtStatus === 'pending') {
    return (
      <div className="text-center py-12 bg-amber-50 rounded-3xl border-2 border-amber-100 border-dashed animate-fade-in">
        <Clock className="w-12 h-12 mx-auto text-amber-500 mb-4 animate-pulse" />
        <h3 className="text-xl font-black text-amber-800">任務已送出，等待主管審核中</h3>
        <p className="text-amber-600 text-sm mt-2 font-medium">請稍候，核准後即可領取成就。</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="p-8 bg-indigo-50/50 rounded-3xl border border-indigo-100 border-dashed">
        <div className="flex items-center mb-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white mr-3">
            <Rocket className="w-5 h-5" />
          </div>
          <h3 className="font-black text-indigo-900 text-xl">實戰成果提交</h3>
        </div>

        <p className="text-indigo-800/80 text-sm mb-8 leading-relaxed">
          <strong>任務說明：</strong><br />
          {course.ojtDescription || '請根據課程所學進行實作，並上傳檔案或提供外部連結。'}
        </p>

        {/* 方法 A：檔案上傳 */}
        <div 
          onClick={() => ojtStatus !== 'uploading' && fileInputRef.current.click()}
          className={`border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center transition-all ${
            ojtStatus === 'uploading' 
            ? 'bg-slate-50 border-slate-200 cursor-not-allowed' 
            : 'border-indigo-200 bg-white hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer shadow-sm'
          }`}
        >
          {ojtStatus === 'uploading' ? (
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          ) : (
            <>
              <UploadCloud className="w-10 h-10 text-indigo-400 mb-2" />
              <span className="font-bold text-indigo-700">上傳成果檔案 (圖檔/PDF/Office)</span>
              <span className="text-[10px] text-indigo-400 mt-1">上限 5MB</span>
            </>
          )}
        </div>

        {/* 分隔線 */}
        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-indigo-100"></span></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-indigo-50 px-3 text-indigo-300 font-bold">或</span></div>
        </div>

        {/* 方法 B：連結提交 */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-indigo-400 uppercase tracking-wider">提交外部連結 (Google Doc / Canva / 影音)</label>
          <div className="flex gap-2">
            <input 
              type="url" 
              value={ojtLink}
              onChange={(e) => setOjtLink(e.target.value)}
              disabled={ojtStatus === 'uploading'}
              placeholder="請貼上您的成果網址..."
              className="flex-1 p-3 rounded-xl border-2 border-indigo-100 focus:border-indigo-500 outline-none text-sm transition-all"
            />
            <button 
              onClick={handleLinkSubmit}
              disabled={ojtStatus === 'uploading' || !ojtLink}
              className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-indigo-700 disabled:bg-slate-300 transition-colors"
            >
              提交連結
            </button>
          </div>
        </div>

        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={handleOjtUpload} 
          // ✨ 更新 accept：包含 Word, Excel, PDF 與圖片
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" 
        />
      </div>
    </div>
  );
}