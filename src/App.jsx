import React, { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';

// ============ Supabase 클라이언트 설정 ============
const SUPABASE_URL = 'https://wbbobsmddyonnycasecs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndiYm9ic21kZHlvbm55Y2FzZWNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4NTUxNTMsImV4cCI6MjA4MzQzMTE1M30.6u9iAh4fUiKvqt6JInyxnAdLoWTgs913q2TrkLPxsRE';

// 기본 설정
const DEFAULT_SETTINGS = {
  questionCount: 10
};

// ============ API 함수들 ============
async function login(phone, password) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/users?phone=eq.${encodeURIComponent(phone)}&password=eq.${encodeURIComponent(password)}&select=*`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    }
  });
  const data = await res.json();
  if (!data || data.length === 0) {
    throw new Error('전화번호 또는 비밀번호가 올바르지 않습니다.');
  }
  return data[0];
}

async function register(name, phone, password) {
  const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/users?phone=eq.${encodeURIComponent(phone)}&select=id`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    }
  });
  const existing = await checkRes.json();
  if (existing && existing.length > 0) {
    throw new Error('이미 등록된 전화번호입니다.');
  }
  
  const res = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({ name, phone, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error('회원가입에 실패했습니다.');
  return data[0];
}

async function getWords() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/words?select=*&order=id`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    }
  });
  return await res.json();
}

async function getWordCount() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/words?select=id`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Prefer': 'count=exact'
    }
  });
  const count = res.headers.get('content-range')?.split('/')[1];
  return count ? parseInt(count) : 0;
}

async function addWords(words) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/words`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(words)
  });
  if (!res.ok) throw new Error('단어 추가에 실패했습니다.');
  return await res.json();
}

async function deleteAllWords() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/words?id=gt.0`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    }
  });
  if (!res.ok) throw new Error('단어 삭제에 실패했습니다.');
  return true;
}

async function saveTestResult(userId, result) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/test_results`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      user_id: userId,
      test_type: result.testType,
      total_questions: result.totalQuestions,
      correct_answers: result.correctAnswers,
      score: (result.correctAnswers / result.totalQuestions) * 100,
      wrong_words: result.wrongWords,
      time_spent_seconds: result.timeSpentSeconds
    })
  });
  return await res.json();
}

async function getUserStats(userId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/test_results?user_id=eq.${userId}&select=*`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    }
  });
  const results = await res.json();
  
  if (!results || results.length === 0) {
    return { totalTests: 0, avgScore: 0, totalCorrect: 0, totalQuestions: 0, streak: 0 };
  }
  
  const totalTests = results.length;
  const totalCorrect = results.reduce((sum, r) => sum + r.correct_answers, 0);
  const totalQuestions = results.reduce((sum, r) => sum + r.total_questions, 0);
  const avgScore = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  
  const dates = [...new Set(results.map(r => r.created_at.split('T')[0]))].sort().reverse();
  let streak = 0;
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  
  if (dates[0] === today || dates[0] === yesterday) {
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(Date.now() - i * 86400000).toISOString().split('T')[0];
      if (dates.includes(checkDate)) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }
  }
  
  return { totalTests, avgScore, totalCorrect, totalQuestions, streak };
}

async function getWeeklyReport(userId) {
  const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/test_results?user_id=eq.${userId}&created_at=gte.${oneWeekAgo}&select=*&order=created_at`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    }
  });
  const results = await res.json();
  
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const dailyData = {};
  
  for (let i = 6; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000);
    const dateKey = date.toISOString().split('T')[0];
    const month = date.getMonth() + 1;
    const day = date.getDate();
    dailyData[dateKey] = { 
      day: days[date.getDay()], 
      date: `${month}/${day}`,
      fullDate: dateKey,
      score: 0, 
      tests: 0, 
      correct: 0, 
      total: 0 
    };
  }
  
  (results || []).forEach(result => {
    const dateKey = result.created_at.split('T')[0];
    if (dailyData[dateKey]) {
      dailyData[dateKey].tests += 1;
      dailyData[dateKey].correct += result.correct_answers;
      dailyData[dateKey].total += result.total_questions;
    }
  });
  
  Object.keys(dailyData).forEach(key => {
    const d = dailyData[key];
    d.score = d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0;
  });
  
  return Object.values(dailyData);
}

async function getFrequentlyWrongWords(userId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/test_results?user_id=eq.${userId}&select=wrong_words`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    }
  });
  const results = await res.json();
  
  const wrongCounts = {};
  (results || []).forEach(r => {
    (r.wrong_words || []).forEach(w => {
      const word = w.word || w;
      wrongCounts[word] = (wrongCounts[word] || 0) + 1;
    });
  });
  
  return Object.entries(wrongCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word, count]) => ({ word, count }));
}

// 모든 사용자 목록 가져오기 (관리자용)
async function getAllUsers() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/users?select=id,name,phone,is_admin,created_at&order=created_at.desc`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    }
  });
  return await res.json();
}

// 특정 사용자의 주간 통계 가져오기 (관리자용)
async function getUserWeeklyStats(userId) {
  const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/test_results?user_id=eq.${userId}&created_at=gte.${oneWeekAgo}&select=*`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    }
  });
  const results = await res.json();
  
  if (!results || results.length === 0) {
    return { totalTests: 0, avgScore: 0, totalCorrect: 0, totalQuestions: 0 };
  }
  
  const totalTests = results.length;
  const totalCorrect = results.reduce((sum, r) => sum + r.correct_answers, 0);
  const totalQuestions = results.reduce((sum, r) => sum + r.total_questions, 0);
  const avgScore = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  
  return { totalTests, avgScore, totalCorrect, totalQuestions };
}

// ============ 메인 앱 컴포넌트 ============
export default function VocabQuizApp() {
  const [currentPage, setCurrentPage] = useState('login');
  const [user, setUser] = useState(null);
  const [quizType, setQuizType] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [selectedUserId, setSelectedUserId] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('vocab_user');
    const savedSettings = localStorage.getItem('vocab_settings');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      setCurrentPage('home');
    }
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('vocab_user', JSON.stringify(userData));
    setCurrentPage('home');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('vocab_user');
    setCurrentPage('login');
  };

  const startQuiz = (type) => {
    setQuizType(type);
    setCurrentPage('quiz');
  };

  const finishQuiz = (result) => {
    setLastResult(result);
    setCurrentPage('results');
  };

  const updateSettings = (newSettings) => {
    setSettings(newSettings);
    localStorage.setItem('vocab_settings', JSON.stringify(newSettings));
  };

  const viewUserReport = (userId) => {
    setSelectedUserId(userId);
    setCurrentPage('user-report');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700&family=Outfit:wght@300;400;500;600;700;800&display=swap');
        
        * { font-family: 'Outfit', 'Noto Sans KR', sans-serif; }
        
        .glass {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .gradient-text {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        
        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          transition: all 0.3s ease;
        }
        
        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 40px rgba(102, 126, 234, 0.4);
        }
        
        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .btn-secondary {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          transition: all 0.3s ease;
        }
        
        .btn-secondary:hover { background: rgba(255, 255, 255, 0.15); }
        
        .card-hover { transition: all 0.3s ease; }
        .card-hover:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        }
        
        .option-btn { transition: all 0.2s ease; }
        .option-btn:hover:not(:disabled) {
          transform: scale(1.02);
          background: rgba(255, 255, 255, 0.15);
        }
        .option-btn.correct {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%) !important;
          border-color: #10b981 !important;
        }
        .option-btn.wrong {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%) !important;
          border-color: #ef4444 !important;
        }
        
        .progress-bar {
          background: linear-gradient(90deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
        }
        
        .floating { animation: float 3s ease-in-out infinite; }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        
        .pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(102, 126, 234, 0.3); }
          50% { box-shadow: 0 0 40px rgba(102, 126, 234, 0.6); }
        }
        
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        
        input:focus, select:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
        }
      `}</style>
      
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl floating" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl floating" style={{ animationDelay: '1s' }} />
      </div>
      
      <div className="relative z-10 max-w-md mx-auto min-h-screen">
        {currentPage === 'login' && <LoginPage onLogin={handleLogin} setCurrentPage={setCurrentPage} />}
        {currentPage === 'register' && <RegisterPage onLogin={handleLogin} setCurrentPage={setCurrentPage} />}
        {currentPage === 'home' && <HomePage user={user} onLogout={handleLogout} startQuiz={startQuiz} setCurrentPage={setCurrentPage} settings={settings} />}
        {currentPage === 'quiz' && <QuizPage user={user} quizType={quizType} onFinish={finishQuiz} setCurrentPage={setCurrentPage} settings={settings} />}
        {currentPage === 'results' && <ResultsPage result={lastResult} setCurrentPage={setCurrentPage} />}
        {currentPage === 'report' && <ReportPage user={user} setCurrentPage={setCurrentPage} />}
        {currentPage === 'upload' && <UploadPage user={user} setCurrentPage={setCurrentPage} />}
        {currentPage === 'settings' && <SettingsPage user={user} setUser={setUser} onLogout={handleLogout} setCurrentPage={setCurrentPage} />}
        {currentPage === 'admin' && <AdminPage user={user} setCurrentPage={setCurrentPage} settings={settings} updateSettings={updateSettings} viewUserReport={viewUserReport} />}
        {currentPage === 'user-report' && <UserReportPage userId={selectedUserId} setCurrentPage={setCurrentPage} />}
      </div>
    </div>
  );
}

// ============ 로그인 페이지 ============
function LoginPage({ onLogin, setCurrentPage }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!phone || !password) {
      setError('전화번호와 비밀번호를 입력하세요');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const user = await login(phone, password);
      onLogin(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 py-12">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 mb-6 pulse-glow">
          <span className="text-4xl">📚</span>
        </div>
        <h1 className="text-3xl font-bold gradient-text mb-2">Vocab Master</h1>
        <p className="text-slate-400">유의어 · 반의어 학습</p>
      </div>

      <div className="glass rounded-3xl p-8">
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
            {error}
          </div>
        )}
        
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">전화번호</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="01012345678"
              className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500"
            />
          </div>
          
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-4 rounded-xl btn-primary text-white font-semibold text-lg flex items-center justify-center gap-2"
          >
            {loading ? <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full spin" /> 로그인 중...</> : '로그인'}
          </button>
        </div>
        
        <div className="mt-6 text-center">
          <button onClick={() => setCurrentPage('register')} className="text-slate-400 hover:text-white">
            계정이 없으신가요? <span className="text-indigo-400 font-medium">회원가입</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ 회원가입 페이지 ============
function RegisterPage({ onLogin, setCurrentPage }) {
  const [formData, setFormData] = useState({ name: '', phone: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!formData.name || !formData.phone || !formData.password) {
      setError('모든 필드를 입력하세요');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다');
      return;
    }
    if (formData.password.length < 4) {
      setError('비밀번호는 4자 이상이어야 합니다');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const user = await register(formData.name, formData.phone, formData.password);
      onLogin(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 py-12">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">회원가입</h1>
        <p className="text-slate-400">새 계정을 만들어보세요</p>
      </div>

      <div className="glass rounded-3xl p-8">
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
            {error}
          </div>
        )}
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">이름</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="홍길동"
              className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">전화번호</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value.replace(/[^0-9]/g, '')})}
              placeholder="01012345678"
              className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">비밀번호</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              placeholder="••••••••"
              className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">비밀번호 확인</label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
              placeholder="••••••••"
              className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500"
            />
          </div>
          
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-4 rounded-xl btn-primary text-white font-semibold text-lg flex items-center justify-center gap-2"
          >
            {loading ? <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full spin" /> 가입 중...</> : '가입하기'}
          </button>
        </div>
        
        <div className="mt-6 text-center">
          <button onClick={() => setCurrentPage('login')} className="text-slate-400 hover:text-white">
            이미 계정이 있으신가요? <span className="text-indigo-400 font-medium">로그인</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ 홈 페이지 ============
function HomePage({ user, onLogout, startQuiz, setCurrentPage, settings }) {
  const [stats, setStats] = useState({ totalTests: 0, avgScore: 0, streak: 0 });
  const [wordCount, setWordCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [userStats, count] = await Promise.all([
          getUserStats(user.id),
          getWordCount()
        ]);
        setStats(userStats);
        setWordCount(count);
      } catch (err) {
        console.error('데이터 로딩 실패:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user.id]);

  return (
    <div className="min-h-screen px-6 py-8 pb-24">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-slate-400 text-sm">안녕하세요 👋</p>
          <h1 className="text-2xl font-bold text-white">{user?.name || '학습자'}님</h1>
          {user?.is_admin && <span className="text-xs bg-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-full">관리자</span>}
        </div>
        <button 
          onClick={() => setCurrentPage('settings')}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20"
        >
          <span className="text-lg">👤</span>
        </button>
      </div>

      <div className="glass rounded-2xl p-5 mb-6">
        {loading ? (
          <div className="flex justify-center py-8">
            <span className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3">
              <div className="text-3xl font-bold gradient-text">{stats.streak}</div>
              <div className="text-slate-400 text-sm mt-1">연속 학습일</div>
            </div>
            <div className="text-center p-3">
              <div className="text-3xl font-bold gradient-text">{stats.avgScore}%</div>
              <div className="text-slate-400 text-sm mt-1">평균 점수</div>
            </div>
            <div className="text-center p-3">
              <div className="text-3xl font-bold text-white">{stats.totalTests}</div>
              <div className="text-slate-400 text-sm mt-1">완료한 테스트</div>
            </div>
            <div className="text-center p-3">
              <div className="text-3xl font-bold text-white">{wordCount}</div>
              <div className="text-slate-400 text-sm mt-1">등록된 단어</div>
            </div>
          </div>
        )}
      </div>

      {/* 문제 수 표시 */}
      <div className="glass rounded-xl p-3 mb-4 flex items-center justify-between">
        <span className="text-slate-400 text-sm">문제 수</span>
        <span className="text-white font-medium">{settings.questionCount}문제</span>
      </div>

      <h2 className="text-lg font-semibold text-white mb-4">학습 모드 선택</h2>
      
      <div className="space-y-4">
        <button onClick={() => startQuiz('synonym')} className="w-full glass rounded-2xl p-5 text-left card-hover">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-2xl">🔗</div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white">유의어 퀴즈</h3>
              <p className="text-slate-400 text-sm">같은 의미의 단어 찾기</p>
            </div>
            <span className="text-slate-500">→</span>
          </div>
        </button>

        <button onClick={() => startQuiz('antonym')} className="w-full glass rounded-2xl p-5 text-left card-hover">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-2xl">↔️</div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white">반의어 퀴즈</h3>
              <p className="text-slate-400 text-sm">반대 의미의 단어 찾기</p>
            </div>
            <span className="text-slate-500">→</span>
          </div>
        </button>

        <button onClick={() => startQuiz('mixed')} className="w-full glass rounded-2xl p-5 text-left card-hover">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl">🎲</div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white">혼합 퀴즈</h3>
              <p className="text-slate-400 text-sm">유의어 + 반의어 랜덤</p>
            </div>
            <span className="text-slate-500">→</span>
          </div>
        </button>
      </div>

      <BottomNav currentPage="home" setCurrentPage={setCurrentPage} isAdmin={user?.is_admin} />
    </div>
  );
}

// ============ 퀴즈 페이지 ============
function QuizPage({ user, quizType, onFinish, setCurrentPage, settings }) {
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [wrongAnswers, setWrongAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    async function loadQuestions() {
      try {
        const words = await getWords();
        
        // 퀴즈 타입에 따라 유효한 단어만 필터링
        const validWords = words.filter(word => {
          if (quizType === 'synonym') {
            return word.synonyms && word.synonyms.length > 0;
          } else if (quizType === 'antonym') {
            return word.antonyms && word.antonyms.length > 0;
          } else {
            // mixed: 유의어 또는 반의어 중 하나라도 있으면 됨
            return (word.synonyms && word.synonyms.length > 0) || (word.antonyms && word.antonyms.length > 0);
          }
        });

        if (validWords.length < 4) {
          alert('유효한 단어가 부족합니다. 최소 4개 이상의 단어가 필요합니다.');
          setCurrentPage('home');
          return;
        }
        
        const questionCount = Math.min(settings.questionCount, validWords.length);
        const shuffled = [...validWords].sort(() => Math.random() - 0.5).slice(0, questionCount);
        
        const generated = shuffled.map((word, idx) => {
          let isAntonym;
          if (quizType === 'synonym') {
            isAntonym = false;
          } else if (quizType === 'antonym') {
            isAntonym = true;
          } else {
            // mixed: 해당 단어에 있는 것 중에서 선택
            const hasSynonyms = word.synonyms && word.synonyms.length > 0;
            const hasAntonyms = word.antonyms && word.antonyms.length > 0;
            if (hasSynonyms && hasAntonyms) {
              isAntonym = Math.random() > 0.5;
            } else {
              isAntonym = hasAntonyms;
            }
          }

          const correctAnswers = isAntonym ? (word.antonyms || []) : (word.synonyms || []);
          
          if (correctAnswers.length === 0) {
            return null;
          }
          
          const correctAnswer = correctAnswers[Math.floor(Math.random() * correctAnswers.length)];
          
          // 오답 생성 - 같은 타입(유의어/반의어)에서 가져옴
          const otherWords = validWords.filter(w => w.id !== word.id);
          const wrongOptions = [];
          let attempts = 0;
          
          while (wrongOptions.length < 3 && attempts < 100) {
            const randomWord = otherWords[Math.floor(Math.random() * otherWords.length)];
            const pool = isAntonym ? (randomWord.antonyms || []) : (randomWord.synonyms || []);
            if (pool.length > 0) {
              const randomOption = pool[Math.floor(Math.random() * pool.length)];
              if (!wrongOptions.includes(randomOption) && randomOption !== correctAnswer && !correctAnswers.includes(randomOption)) {
                wrongOptions.push(randomOption);
              }
            }
            attempts++;
          }
          
          if (wrongOptions.length < 3) return null;
          
          const options = [...wrongOptions, correctAnswer].sort(() => Math.random() - 0.5);
          
          return {
            id: idx,
            wordId: word.id,
            word: word.word,
            meaning_ko: word.meaning_ko,
            questionType: isAntonym ? 'antonym' : 'synonym',
            correctAnswer,
            options
          };
        }).filter(q => q !== null);
        
        if (generated.length === 0) {
          alert('유효한 문제를 생성할 수 없습니다. 단어 데이터를 확인하세요.');
          setCurrentPage('home');
          return;
        }
        
        setQuestions(generated);
      } catch (err) {
        console.error('문제 로딩 실패:', err);
        alert('문제를 불러오는데 실패했습니다.');
        setCurrentPage('home');
      } finally {
        setLoading(false);
      }
    }
    loadQuestions();
  }, [quizType, setCurrentPage, settings.questionCount]);

  const handleAnswer = (answer) => {
    if (showResult) return;
    
    setSelectedAnswer(answer);
    setShowResult(true);
    
    const current = questions[currentQuestion];
    const isCorrect = answer === current.correctAnswer;
    
    if (isCorrect) {
      setScore(score + 1);
    } else {
      setWrongAnswers([...wrongAnswers, { word: current.word, correctAnswer: current.correctAnswer, userAnswer: answer }]);
    }
  };

  const nextQuestion = async () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    } else {
      const timeSpent = Math.round((Date.now() - startTime) / 1000);
      const finalScore = score + (selectedAnswer === questions[currentQuestion].correctAnswer ? 1 : 0);
      const result = {
        testType: quizType,
        totalQuestions: questions.length,
        correctAnswers: finalScore,
        wrongWords: wrongAnswers,
        timeSpentSeconds: timeSpent
      };
      
      try {
        await saveTestResult(user.id, result);
      } catch (err) {
        console.error('결과 저장 실패:', err);
      }
      
      onFinish(result);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <span className="w-12 h-12 border-3 border-white/30 border-t-white rounded-full spin inline-block mb-4" />
          <p className="text-white">문제 준비 중...</p>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return null;
  }

  const current = questions[currentQuestion];
  const progress = ((currentQuestion + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => setCurrentPage('home')} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">←</button>
        <span className="text-slate-400 text-sm">{current.questionType === 'synonym' ? '유의어' : '반의어'} 퀴즈</span>
        <div className="text-white font-medium">{currentQuestion + 1}/{questions.length}</div>
      </div>

      <div className="h-2 bg-white/10 rounded-full mb-8 overflow-hidden">
        <div className="h-full progress-bar rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      <div className="glass rounded-3xl p-8 mb-8 text-center">
        <div className="mb-2">
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
            current.questionType === 'synonym' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-orange-500/20 text-orange-400'
          }`}>
            {current.questionType === 'synonym' ? '유의어 찾기' : '반의어 찾기'}
          </span>
        </div>
        <h2 className="text-4xl font-bold text-white mb-3">{current.word}</h2>
        <p className="text-slate-400">{current.meaning_ko}</p>
      </div>

      <div className="space-y-3 mb-8">
        {current.options.map((option, idx) => {
          let className = "option-btn w-full py-4 px-6 rounded-2xl text-left font-medium border border-white/10 bg-white/5";
          if (showResult) {
            if (option === current.correctAnswer) className += " correct";
            else if (option === selectedAnswer) className += " wrong";
          }
          return (
            <button key={idx} onClick={() => handleAnswer(option)} disabled={showResult} className={className}>
              <span className="text-white">{option}</span>
            </button>
          );
        })}
      </div>

      {showResult && (
        <div className="space-y-4">
          <div className={`p-4 rounded-2xl text-center ${
            selectedAnswer === current.correctAnswer ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {selectedAnswer === current.correctAnswer ? '🎉 정답입니다!' : `❌ 오답! 정답: ${current.correctAnswer}`}
          </div>
          <button onClick={nextQuestion} className="w-full py-4 rounded-xl btn-primary text-white font-semibold">
            {currentQuestion < questions.length - 1 ? '다음 문제' : '결과 보기'}
          </button>
        </div>
      )}

      <div className="fixed bottom-8 left-1/2 -translate-x-1/2">
        <div className="glass rounded-full px-6 py-2">
          <span className="text-slate-400">현재 점수: </span>
          <span className="text-white font-bold">{score}/{currentQuestion + (showResult ? 1 : 0)}</span>
        </div>
      </div>
    </div>
  );
}

// ============ 결과 페이지 ============
function ResultsPage({ result, setCurrentPage }) {
  if (!result) {
    setCurrentPage('home');
    return null;
  }

  const percentage = Math.round((result.correctAnswers / result.totalQuestions) * 100);
  const minutes = Math.floor(result.timeSpentSeconds / 60);
  const seconds = result.timeSpentSeconds % 60;

  return (
    <div className="min-h-screen px-6 py-12 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-8 pulse-glow">
          <span className="text-6xl">{percentage >= 80 ? '🏆' : percentage >= 60 ? '👍' : '💪'}</span>
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">테스트 완료!</h1>
        <p className="text-slate-400 mb-8">수고하셨습니다</p>

        <div className="glass rounded-3xl p-8 w-full mb-8">
          <div className="text-6xl font-bold gradient-text mb-2">{percentage}%</div>
          <div className="text-slate-400 mb-6">{result.totalQuestions}문제 중 {result.correctAnswers}문제 정답</div>
          
          <div className="grid grid-cols-2 gap-4 pt-6 border-t border-white/10">
            <div>
              <div className="text-2xl font-bold text-white">{result.correctAnswers}</div>
              <div className="text-slate-400 text-sm">정답</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{minutes}분 {seconds}초</div>
              <div className="text-slate-400 text-sm">소요 시간</div>
            </div>
          </div>
        </div>

        {result.wrongWords && result.wrongWords.length > 0 && (
          <div className="glass rounded-2xl p-6 w-full mb-6 text-left">
            <h3 className="text-white font-semibold mb-3">틀린 단어</h3>
            <div className="space-y-2">
              {result.wrongWords.map((w, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-slate-300">{w.word}</span>
                  <span className="text-emerald-400">{w.correctAnswer}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="w-full space-y-3">
          <button onClick={() => setCurrentPage('home')} className="w-full py-4 rounded-xl btn-primary text-white font-semibold">
            다시 도전하기
          </button>
          <button onClick={() => setCurrentPage('report')} className="w-full py-4 rounded-xl btn-secondary text-white font-semibold">
            학습 리포트 보기
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ 리포트 페이지 ============
function ReportPage({ user, setCurrentPage }) {
  const [weeklyData, setWeeklyData] = useState([]);
  const [wrongWords, setWrongWords] = useState([]);
  const [summary, setSummary] = useState({ totalTests: 0, avgScore: 0, streak: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReport() {
      try {
        const [weekly, wrong, stats] = await Promise.all([
          getWeeklyReport(user.id),
          getFrequentlyWrongWords(user.id),
          getUserStats(user.id)
        ]);
        setWeeklyData(weekly);
        setWrongWords(wrong);
        setSummary(stats);
      } catch (err) {
        console.error('리포트 로딩 실패:', err);
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, [user.id]);

  const maxScore = Math.max(...weeklyData.map(d => d.score), 1);

  return (
    <div className="min-h-screen px-6 py-8 pb-24">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setCurrentPage('home')} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">←</button>
        <h1 className="text-xl font-bold text-white">주간 학습 리포트</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <span className="w-10 h-10 border-2 border-white/30 border-t-white rounded-full spin" />
        </div>
      ) : (
        <>
          <div className="glass rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-semibold text-white mb-4">이번 주 요약</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold gradient-text">{weeklyData.reduce((s, d) => s + d.tests, 0)}</div>
                <div className="text-slate-400 text-xs mt-1">총 테스트</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold gradient-text">{summary.avgScore}%</div>
                <div className="text-slate-400 text-xs mt-1">평균 점수</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold gradient-text">{summary.streak}일</div>
                <div className="text-slate-400 text-xs mt-1">연속 학습</div>
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-semibold text-white mb-4">일별 성적</h2>
            <div className="flex items-end justify-between h-40 gap-2">
              {weeklyData.map((data, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                  <div className="text-xs text-slate-400">{data.score > 0 ? `${data.score}%` : '-'}</div>
                  <div 
                    className="w-full rounded-t-lg bg-gradient-to-t from-indigo-600 to-purple-500 transition-all"
                    style={{ height: data.score > 0 ? `${(data.score / maxScore) * 100}%` : '4px', opacity: data.score > 0 ? 1 : 0.3 }}
                  />
                  <div className="text-center">
                    <div className="text-xs text-white font-medium">{data.day}</div>
                    <div className="text-xs text-slate-500">{data.date}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {wrongWords.length > 0 && (
            <div className="glass rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">자주 틀리는 단어</h2>
              <div className="space-y-3">
                {wrongWords.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-medium text-slate-400">{idx + 1}</div>
                    <div className="flex-1 text-white font-medium">{item.word}</div>
                    <div className="text-red-400 text-sm">{item.count}회</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <BottomNav currentPage="report" setCurrentPage={setCurrentPage} isAdmin={user?.is_admin} />
    </div>
  );
}

// ============ 업로드 페이지 ============
function UploadPage({ user, setCurrentPage }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [wordCount, setWordCount] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getWordCount().then(setWordCount);
  }, [result]);

  const handleUpload = async () => {
    if (!file) return;
    
    setUploading(true);
    setResult(null);
    
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet);
      
      const words = json.map(row => ({
        word: row.word || row.Word || row['단어'],
        meaning_ko: row.meaning_ko || row.meaning || row['뜻'] || row['의미'],
        synonyms: (row.synonyms || row.Synonyms || row['유의어'] || '').split(',').map(s => s.trim()).filter(s => s),
        antonyms: (row.antonyms || row.Antonyms || row['반의어'] || '').split(',').map(s => s.trim()).filter(s => s),
        category: row.category || row['분류'] || null,
        difficulty: parseInt(row.difficulty || row['난이도']) || 1
      })).filter(w => w.word);

      // 유의어/반의어 없는 단어 카운트
      const validWords = words.filter(w => w.synonyms.length > 0 || w.antonyms.length > 0);
      const skippedWords = words.length - validWords.length;
      
      if (words.length === 0) {
        setResult({ success: false, message: '유효한 단어가 없습니다. 엑셀 형식을 확인하세요.' });
        return;
      }
      
      await addWords(words);
      
      let message = `${words.length}개의 단어가 추가되었습니다.`;
      if (skippedWords > 0) {
        message += ` (${skippedWords}개는 유의어/반의어가 없어 퀴즈에서 제외됩니다)`;
      }
      
      setResult({ success: true, message });
      setFile(null);
    } catch (err) {
      console.error('업로드 실패:', err);
      setResult({ success: false, message: '업로드에 실패했습니다: ' + err.message });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('정말 모든 단어를 삭제하시겠습니까?')) return;
    
    setDeleting(true);
    try {
      await deleteAllWords();
      setWordCount(0);
      setResult({ success: true, message: '모든 단어가 삭제되었습니다.' });
    } catch (err) {
      setResult({ success: false, message: '삭제에 실패했습니다.' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen px-6 py-8 pb-24">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setCurrentPage('home')} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">←</button>
        <h1 className="text-xl font-bold text-white">단어 데이터 업로드</h1>
      </div>

      <div className="glass rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-3">📋 엑셀 파일 형식</h2>
        <p className="text-slate-400 text-sm mb-4">아래 형식에 맞춰 엑셀 파일을 준비하세요:</p>
        <div className="bg-black/30 rounded-xl p-4 overflow-x-auto">
          <table className="text-xs text-slate-300 w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 px-2">word</th>
                <th className="text-left py-2 px-2">meaning_ko</th>
                <th className="text-left py-2 px-2">synonyms</th>
                <th className="text-left py-2 px-2">antonyms</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-2 px-2">abandon</td>
                <td className="py-2 px-2">버리다</td>
                <td className="py-2 px-2">desert, leave</td>
                <td className="py-2 px-2">keep, maintain</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-slate-500 text-xs mt-3">* 유의어 또는 반의어가 없는 단어는 퀴즈에서 제외됩니다.</p>
      </div>

      <div className="glass rounded-2xl p-6 mb-6">
        {result && (
          <div className={`mb-4 p-3 rounded-xl text-sm ${result.success ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
            {result.message}
          </div>
        )}
        
        <div className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${file ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/20'}`}>
          {file ? (
            <div>
              <div className="text-5xl mb-4">📄</div>
              <p className="text-white font-medium">{file.name}</p>
            </div>
          ) : (
            <div>
              <div className="text-5xl mb-4">📁</div>
              <p className="text-white font-medium mb-2">엑셀 파일을 선택하세요</p>
              <p className="text-slate-400 text-sm">.xlsx, .xls 파일</p>
            </div>
          )}
        </div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => { setFile(e.target.files[0]); setResult(null); }}
              className="block w-full text-sm text-slate-400 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:bg-white/10 file:text-white hover:file:bg-white/20 file:cursor-pointer"
            />
          </label>
          
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className={`w-full py-4 rounded-xl font-semibold flex items-center justify-center gap-2 ${file && !uploading ? 'btn-primary text-white' : 'bg-white/10 text-slate-500 cursor-not-allowed'}`}
          >
            {uploading ? <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full spin" /> 업로드 중...</> : '업로드하기'}
          </button>
        </div>
      </div>

      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm">현재 등록된 단어</p>
            <p className="text-2xl font-bold text-white">{wordCount}개</p>
          </div>
          <button 
            onClick={handleDeleteAll}
            disabled={deleting || wordCount === 0}
            className="px-4 py-2 rounded-xl bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30 disabled:opacity-50"
          >
            {deleting ? '삭제 중...' : '전체 삭제'}
          </button>
        </div>
      </div>

      <BottomNav currentPage="upload" setCurrentPage={setCurrentPage} isAdmin={user?.is_admin} />
    </div>
  );
}

// ============ 설정 페이지 ============
function SettingsPage({ user, setUser, onLogout, setCurrentPage }) {
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPw || !newPw || !confirmPw) {
      setMessage({ type: 'error', text: '모든 필드를 입력하세요' });
      return;
    }
    if (newPw !== confirmPw) {
      setMessage({ type: 'error', text: '새 비밀번호가 일치하지 않습니다' });
      return;
    }
    if (newPw.length < 4) {
      setMessage({ type: 'error', text: '비밀번호는 4자 이상이어야 합니다' });
      return;
    }
    
    setLoading(true);
    try {
      const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}&password=eq.${encodeURIComponent(currentPw)}&select=id`, {
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
      });
      const checkData = await checkRes.json();
      
      if (!checkData || checkData.length === 0) {
        setMessage({ type: 'error', text: '현재 비밀번호가 올바르지 않습니다' });
        return;
      }
      
      const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password: newPw })
      });
      
      if (updateRes.ok) {
        setMessage({ type: 'success', text: '비밀번호가 변경되었습니다' });
        setCurrentPw('');
        setNewPw('');
        setConfirmPw('');
      } else {
        throw new Error();
      }
    } catch (err) {
      setMessage({ type: 'error', text: '비밀번호 변경에 실패했습니다' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-6 py-8 pb-24">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setCurrentPage('home')} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">←</button>
        <h1 className="text-xl font-bold text-white">설정</h1>
      </div>

      <div className="glass rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">내 정보</h2>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-slate-400">이름</span>
            <span className="text-white">{user?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">전화번호</span>
            <span className="text-white">{user?.phone}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">계정 유형</span>
            <span className="text-white">{user?.is_admin ? '관리자' : '일반 사용자'}</span>
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">비밀번호 변경</h2>
        
        {message && (
          <div className={`mb-4 p-3 rounded-xl text-sm ${message.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
            {message.text}
          </div>
        )}
        
        <div className="space-y-4">
          <input
            type="password"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            placeholder="현재 비밀번호"
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500"
          />
          <input
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            placeholder="새 비밀번호"
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500"
          />
          <input
            type="password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            placeholder="새 비밀번호 확인"
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500"
          />
          <button
            onClick={handleChangePassword}
            disabled={loading}
            className="w-full py-3 rounded-xl btn-primary text-white font-medium"
          >
            {loading ? '변경 중...' : '비밀번호 변경'}
          </button>
        </div>
      </div>

      <button
        onClick={onLogout}
        className="w-full py-4 rounded-xl bg-red-500/20 text-red-400 font-semibold hover:bg-red-500/30"
      >
        로그아웃
      </button>

      <BottomNav currentPage="settings" setCurrentPage={setCurrentPage} isAdmin={user?.is_admin} />
    </div>
  );
}

// ============ 관리자 페이지 ============
function AdminPage({ user, setCurrentPage, settings, updateSettings, viewUserReport }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [questionCount, setQuestionCount] = useState(settings.questionCount);
  const [userStats, setUserStats] = useState({});

  useEffect(() => {
    async function loadData() {
      try {
        const allUsers = await getAllUsers();
        setUsers(allUsers);
        
        // 각 사용자의 주간 통계 로드
        const stats = {};
        for (const u of allUsers) {
          stats[u.id] = await getUserWeeklyStats(u.id);
        }
        setUserStats(stats);
      } catch (err) {
        console.error('관리자 데이터 로딩 실패:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleSaveSettings = () => {
    updateSettings({ ...settings, questionCount: parseInt(questionCount) });
    alert('설정이 저장되었습니다.');
  };

  if (!user?.is_admin) {
    setCurrentPage('home');
    return null;
  }

  return (
    <div className="min-h-screen px-6 py-8 pb-24">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setCurrentPage('home')} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">←</button>
        <h1 className="text-xl font-bold text-white">관리자 페이지</h1>
      </div>

      {/* 퀴즈 설정 */}
      <div className="glass rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">⚙️ 퀴즈 설정</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">문제 수</label>
            <select
              value={questionCount}
              onChange={(e) => setQuestionCount(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white"
            >
              <option value="10">10문제</option>
              <option value="20">20문제</option>
            </select>
          </div>
          <button
            onClick={handleSaveSettings}
            className="w-full py-3 rounded-xl btn-primary text-white font-medium"
          >
            설정 저장
          </button>
        </div>
      </div>

      {/* 사용자 목록 */}
      <div className="glass rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">👥 사용자 관리</h2>
        
        {loading ? (
          <div className="flex justify-center py-8">
            <span className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((u) => (
              <div key={u.id} className="bg-white/5 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-white font-medium">{u.name}</span>
                    {u.is_admin && <span className="ml-2 text-xs bg-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-full">관리자</span>}
                  </div>
                  <button
                    onClick={() => viewUserReport(u.id)}
                    className="text-xs bg-white/10 text-slate-300 px-3 py-1.5 rounded-lg hover:bg-white/20"
                  >
                    리포트 보기
                  </button>
                </div>
                <div className="text-sm text-slate-400">{u.phone}</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <div className="text-white font-medium">{userStats[u.id]?.totalTests || 0}</div>
                    <div className="text-slate-500">이번 주 테스트</div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2 text-center">
                    <div className="text-white font-medium">{userStats[u.id]?.avgScore || 0}%</div>
                    <div className="text-slate-500">평균 점수</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav currentPage="admin" setCurrentPage={setCurrentPage} isAdmin={true} />
    </div>
  );
}

// ============ 특정 사용자 리포트 페이지 (관리자용) ============
function UserReportPage({ userId, setCurrentPage }) {
  const [userData, setUserData] = useState(null);
  const [weeklyData, setWeeklyData] = useState([]);
  const [wrongWords, setWrongWords] = useState([]);
  const [summary, setSummary] = useState({ totalTests: 0, avgScore: 0, streak: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReport() {
      try {
        // 사용자 정보 가져오기
        const userRes = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}&select=*`, {
          headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
        });
        const users = await userRes.json();
        if (users && users.length > 0) {
          setUserData(users[0]);
        }

        const [weekly, wrong, stats] = await Promise.all([
          getWeeklyReport(userId),
          getFrequentlyWrongWords(userId),
          getUserStats(userId)
        ]);
        setWeeklyData(weekly);
        setWrongWords(wrong);
        setSummary(stats);
      } catch (err) {
        console.error('리포트 로딩 실패:', err);
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, [userId]);

  const maxScore = Math.max(...weeklyData.map(d => d.score), 1);

  return (
    <div className="min-h-screen px-6 py-8 pb-24">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setCurrentPage('admin')} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">←</button>
        <div>
          <h1 className="text-xl font-bold text-white">{userData?.name || '사용자'} 리포트</h1>
          <p className="text-slate-400 text-sm">{userData?.phone}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <span className="w-10 h-10 border-2 border-white/30 border-t-white rounded-full spin" />
        </div>
      ) : (
        <>
          <div className="glass rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-semibold text-white mb-4">이번 주 요약</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold gradient-text">{weeklyData.reduce((s, d) => s + d.tests, 0)}</div>
                <div className="text-slate-400 text-xs mt-1">총 테스트</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold gradient-text">{summary.avgScore}%</div>
                <div className="text-slate-400 text-xs mt-1">평균 점수</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold gradient-text">{summary.streak}일</div>
                <div className="text-slate-400 text-xs mt-1">연속 학습</div>
              </div>
            </div>
          </div>

          <div className="glass rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-semibold text-white mb-4">일별 성적</h2>
            <div className="flex items-end justify-between h-40 gap-2">
              {weeklyData.map((data, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                  <div className="text-xs text-slate-400">{data.score > 0 ? `${data.score}%` : '-'}</div>
                  <div 
                    className="w-full rounded-t-lg bg-gradient-to-t from-indigo-600 to-purple-500 transition-all"
                    style={{ height: data.score > 0 ? `${(data.score / maxScore) * 100}%` : '4px', opacity: data.score > 0 ? 1 : 0.3 }}
                  />
                  <div className="text-center">
                    <div className="text-xs text-white font-medium">{data.day}</div>
                    <div className="text-xs text-slate-500">{data.date}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {wrongWords.length > 0 && (
            <div className="glass rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">자주 틀리는 단어</h2>
              <div className="space-y-3">
                {wrongWords.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-medium text-slate-400">{idx + 1}</div>
                    <div className="flex-1 text-white font-medium">{item.word}</div>
                    <div className="text-red-400 text-sm">{item.count}회</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============ 하단 네비게이션 ============
function BottomNav({ currentPage, setCurrentPage, isAdmin }) {
  const items = [
    { id: 'home', icon: '🏠', label: '홈' },
    { id: 'report', icon: '📊', label: '리포트' },
    { id: 'upload', icon: '📁', label: '업로드' },
    { id: 'settings', icon: '⚙️', label: '설정' },
  ];

  if (isAdmin) {
    items.splice(3, 0, { id: 'admin', icon: '👑', label: '관리자' });
  }
  
  return (
    <div className="fixed bottom-0 left-0 right-0 glass border-t border-white/10">
      <div className="max-w-md mx-auto flex justify-around py-4">
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => setCurrentPage(item.id)}
            className={`flex flex-col items-center gap-1 ${currentPage === item.id ? 'text-indigo-400' : 'text-slate-400 hover:text-white'}`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-xs">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
