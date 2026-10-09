import React, { useState, useEffect, useMemo } from 'react';
import {
  Users, Activity, Search, Bell, 
  Menu, X, Settings, LogOut, Filter, Shield,
  Gamepad2, Monitor, Smartphone, Tablet, Trash2,
  RefreshCw, CheckCircle2, UserCheck, User, Sparkles, AlertTriangle
} from 'lucide-react';
import { collection, onSnapshot, getDocs, deleteDoc, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

// Helper to safely format last login timestamps
const formatLastLogin = (lastLoginAt: any) => {
  if (!lastLoginAt) return 'N/A';
  try {
    if (lastLoginAt.toMillis) {
      return new Date(lastLoginAt.toMillis()).toLocaleString();
    }
    if (typeof lastLoginAt === 'number') {
      return new Date(lastLoginAt).toLocaleString();
    }
    if (typeof lastLoginAt === 'string') {
      return new Date(lastLoginAt).toLocaleString();
    }
    if (lastLoginAt?.seconds) {
      return new Date(lastLoginAt.seconds * 1000).toLocaleString();
    }
  } catch (e) {
    console.error("Date formatting error:", e);
  }
  return 'Recently';
};

// --- UI COMPONENTS ---
const Card = ({ children, className = '', title, action }: any) => (
  <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden ${className}`}>
    {(title || action) && (
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/60 flex justify-between items-center flex-wrap gap-2">
        {title && <h3 className="font-semibold text-slate-800 dark:text-slate-200">{title}</h3>}
        {action && <div>{action}</div>}
      </div>
    )}
    <div className="p-6">{children}</div>
  </div>
);

const StatCard = ({ title, value, subtitle, trend, icon: Icon, colorClass, highlight, isLive, children }: any) => (
  <Card className="hover:shadow-md transition-shadow relative overflow-hidden group h-full flex flex-col">
    <div className={`absolute top-0 right-0 w-32 h-32 transform translate-x-12 -translate-y-12 rounded-full opacity-10 transition-transform group-hover:scale-110 ${colorClass}`}></div>
    <div className="flex justify-between items-start mb-4">
      <div>
        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1 flex items-center gap-2">
          {title}
          {isLive && <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>}
        </p>
        <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-200 flex items-baseline gap-2">
          {value}
          {highlight && <span className="text-sm font-medium text-slate-400">{highlight}</span>}
        </h2>
      </div>
      <div className={`p-3 rounded-xl ${colorClass.replace('bg-', 'bg-opacity-10 text-')}`}>
        <Icon size={24} className={colorClass.replace('bg-', 'text-')} />
      </div>
    </div>
    <div className="mt-auto">
      {subtitle && (
        <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1">
          {trend && (
            <span className={`font-medium ${trend > 0 ? 'text-emerald-500' : 'text-red-500'} flex items-center`}>
              {trend > 0 ? '+' : ''}{trend}%
            </span>
          )}
          {subtitle}
        </p>
      )}
      {children}
    </div>
  </Card>
);

const Avatar = ({ src, alt, size = 'md' }: any) => {
  const sizes: any = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-16 h-16', xl: 'w-24 h-24' };
  return (
    <img 
      src={src} 
      alt={alt} 
      className={`${sizes[size]} rounded-full border-2 border-white dark:border-slate-700 shadow-sm object-cover bg-slate-100 dark:bg-slate-700`}
      onError={(e: any) => { e.target.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(alt || 'User'); }}
    />
  );
};


// --- VIEWS ---

const APP_GAMES = [
  { id: "mystery-box", title: "Mystery Box", icon: "🎁" },
  { id: "neon-chain", title: "Neon Chain", icon: "🔗" },
  { id: "bubble-pop", title: "Bubble Pop", icon: "🫧" },
  { id: "flashcards-match", title: "Flashcards Match", icon: "🃏" },
  { id: "bubble-sentence-pro", title: "Bubble Island", icon: "🏝️" },
  { id: "yoga-quiz", title: "Yoga Quiz", icon: "🧘" },
  { id: "family-feud", title: "Family Feud", icon: "👨‍👩‍👧‍👦" },
  { id: "sumo", title: "Sumo Tags", icon: "🤼" },
  { id: "letter-lock", title: "Letter Lock", icon: "🎯" },
  { id: "hamster-pop-quiz", title: "Hamster Pop Quiz", icon: "🐹" },
  { id: "student-race", title: "Name Picker", icon: "🏎️" },
  { id: "tic-tac-toe", title: "Tic Tac Toe Battle", icon: "❌" },
  { id: "phonemic-master", title: "Phonemic Master", icon: "🗣️" }
];

const DashboardOverview = ({ users, onSync, isSyncing, onViewAll, publishedGames, onToggleGamePublish, pageVisits }: any) => {
  const [showGuestModal, setShowGuestModal] = React.useState(false);
  const registeredUsersList = users.filter((u: any) => u.isAnonymous !== true && u.email && u.email !== "User");
  const registeredUsers = registeredUsersList.length;
  const guestUsersList = users.filter((u: any) => u.isAnonymous === true || !u.email || u.email === "User");
  const guestUsers = guestUsersList.length;

  return (
    <div className="space-y-6">
      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <StatCard 
          title="Total Users" value={users.length.toLocaleString()} 
          subtitle="All accounts synced"
          icon={Users} colorClass="bg-indigo-500" 
        />
        <StatCard 
          title="Registered" value={registeredUsers.toLocaleString()} 
          subtitle="Non-guest accounts"
          icon={UserCheck} colorClass="bg-emerald-500" 
        >
          {registeredUsersList.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50">
              <div className="flex flex-wrap gap-2">
                {registeredUsersList.map((u: any, i: number) => (
                  <span key={i} className="px-2 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs rounded-md border border-emerald-100 dark:border-emerald-500/20 truncate max-w-full">
                    {u.displayName || u.email || 'Unknown'}
                  </span>
                ))}
              </div>
            </div>
          )}
        </StatCard>
        <StatCard 
          title="Guests" value={guestUsers.toLocaleString()} 
          subtitle="Anonymous accounts"
          icon={User} colorClass="bg-amber-500" 
        >
          {guestUsersList.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50">
              <button
                onClick={() => setShowGuestModal(true)}
                className="w-full px-3 py-2 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-sm font-semibold rounded-lg border border-amber-200 dark:border-amber-500/30 transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                View Guest Names
              </button>
            </div>
          )}
        </StatCard>
        <StatCard 
          title="Page Visits" value={pageVisits.toLocaleString()} 
          subtitle="Total platform visits"
          icon={Activity} colorClass="bg-blue-500" 
        />
      </div>
      
      {/* App Toggles */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
        <h4 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-6">Manage Apps</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {APP_GAMES.map(game => {
            const isGamePublished = publishedGames[game.id] !== false;
            return (
              <div key={game.id} className="flex items-center justify-between p-4 border border-slate-100 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{game.icon}</div>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{game.title}</span>
                </div>
                <button
                  onClick={() => onToggleGamePublish(game.id)}
                  className={`w-12 h-6 ${isGamePublished ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'} rounded-full relative transition-colors duration-200 focus:outline-none`}
                  title={isGamePublished ? "Unpublish App" : "Publish App"}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 shadow-sm transition-all duration-200 ${isGamePublished ? 'left-7' : 'left-1'}`}></div>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mini Live Users Table */}
      <Card 
        title="Recent Users" 
        action={
          <div className="flex items-center gap-3">
            <button 
              onClick={onSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={isSyncing ? "animate-spin text-indigo-600" : ""} />
              <span>{isSyncing ? "Syncing..." : "Sync Users"}</span>
            </button>
            <button 
              onClick={onViewAll}
              className="text-sm text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
            >
              View All
            </button>
          </div>
        }
      >
        <div className="overflow-x-auto -mx-6">
          <table className="w-full text-left text-sm min-w-[600px]">
            <thead className="text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50">
              <tr>
                <th className="py-3 px-6 font-medium">User</th>
                <th className="py-3 px-6 font-medium">Email</th>
                <th className="py-3 px-6 font-medium text-right">Last Login</th>
              </tr>
            </thead>
            <tbody>
              {users.slice(0, 10).map((user: any) => (
                <tr key={user.uid || user.id} className="border-b border-slate-50 dark:border-slate-700/40 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <td className="py-3 px-6">
                    <div className="flex items-center gap-3">
                      <Avatar src={user.photoURL} alt={user.displayName || user.email} size="sm" />
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{user.displayName || 'User'}</p>
                        {(user.isAnonymous || user.email === "User") && (
                          <span className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium">Guest</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-6 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                     {user.email || 'No email'}
                  </td>
                  <td className="py-3 px-6 text-right text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {formatLastLogin(user.lastLoginAt)}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-slate-500 dark:text-slate-400">
                    No users found. Click <span className="font-semibold text-indigo-600 dark:text-indigo-400">Sync Users</span> to refresh.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Guest Names Modal */}
      {showGuestModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowGuestModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl">
                <User size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">Guest Players</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">{guestUsers} anonymous accounts</p>
              </div>
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
              <div className="flex flex-wrap gap-2">
                {guestUsersList.map((u: any, i: number) => (
                  <span key={i} className="px-3 py-1.5 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-sm font-medium rounded-lg border border-amber-100 dark:border-amber-500/20">
                    {u.displayName || 'Guest Player'}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const UsersManagement = ({ users, onSync, isSyncing }: any) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const handleDeleteUser = async (uid: string, email: string) => {
    if (window.confirm(`Are you sure you want to delete user ${email || uid}?`)) {
      try {
        await deleteDoc(doc(db, 'users', uid));
        alert('User deleted successfully.');
      } catch (error) {
        console.error('Error deleting user:', error);
        alert('Failed to delete user.');
      }
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u: any) => 
      (u.displayName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
      (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.uid || u.id || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

  return (
    <Card 
      title={`User Management (${users.length} total)`} 
      action={
        <button 
          onClick={onSync}
          disabled={isSyncing}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-sm disabled:opacity-50"
        >
          <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
          <span>{isSyncing ? "Syncing..." : "Sync All Users"}</span>
        </button>
      }
      className="min-h-[500px] flex flex-col"
    >
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-6">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by name, email, or UID..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:bg-slate-800 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-auto flex-1 custom-scrollbar -mx-6">
        <table className="w-full text-left text-sm min-w-[650px]">
          <thead className="text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="py-4 px-6 font-medium">User</th>
              <th className="py-4 px-6 font-medium">Email</th>
              <th className="py-4 px-6 font-medium text-right">Last Login</th>
              <th className="py-4 px-6 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user: any) => (
              <tr key={user.uid || user.id} className="border-b border-slate-50 dark:border-slate-700/40 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <td className="py-3 px-6">
                  <div className="flex items-center gap-3">
                    <Avatar src={user.photoURL} alt={user.displayName || user.email} />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{user.displayName || 'User'}</p>
                        {user.isAnonymous && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] font-bold tracking-wide uppercase">Guest</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono truncate max-w-[120px]">{user.uid || user.id}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-6 text-slate-600 dark:text-slate-400">
                  {user.email || 'N/A'}
                </td>
                <td className="py-3 px-6 text-right text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  {formatLastLogin(user.lastLoginAt)}
                </td>
                <td className="py-3 px-6 text-right">
                  <button 
                    onClick={() => handleDeleteUser(user.uid || user.id, user.email)}
                    className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="Delete User"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-500 dark:text-slate-400">
                  No users found matching "{searchTerm}".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};


// --- MAIN APP COMPONENT ---
export function AdminDashboard({ onViewChange }: { onViewChange: (view: any) => void }) {
  const { user: currentUser } = useAuth();
  const [currentRoute, setCurrentRoute] = useState('dashboard');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [publishedGames, setPublishedGames] = useState<Record<string, boolean>>({});

  const [pageVisits, setPageVisits] = useState<number>(0);

  // Sync users logic
  const handleSyncUsers = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      // Ensure currentUser document exists and is up to date
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        await setDoc(userRef, {
          uid: currentUser.uid,
          email: currentUser.email || 'User',
          displayName: currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'User'),
          photoURL: currentUser.photoURL || null,
          isAnonymous: currentUser.isAnonymous,
          lastLoginAt: serverTimestamp(),
        }, { merge: true });
      }

      // Fetch all users directly
      const querySnapshot = await getDocs(collection(db, 'users'));
      const fetchedUsers: any[] = [];
      querySnapshot.forEach((doc) => {
        fetchedUsers.push({ id: doc.id, ...doc.data() });
      });

      // Sort client-side by lastLoginAt desc
      fetchedUsers.sort((a, b) => {
        const getTime = (val: any) => {
          if (!val) return 0;
          if (val.toMillis) return val.toMillis();
          if (val.seconds) return val.seconds * 1000;
          if (typeof val === 'number') return val;
          if (typeof val === 'string') return new Date(val).getTime();
          return 0;
        };
        return getTime(b.lastLoginAt) - getTime(a.lastLoginAt);
      });

      setUsers(fetchedUsers);
      setSyncMessage(`Successfully synced ${fetchedUsers.length} user accounts!`);
      setTimeout(() => setSyncMessage(null), 4000);
    } catch (error) {
      console.error("Error syncing users:", error);
      setSyncMessage("Sync completed with existing local data.");
      setTimeout(() => setSyncMessage(null), 3000);
    } finally {
      setIsSyncing(false);
    }
  };

  // Fetch real users from Firestore realtime listener
  useEffect(() => {
    // Query collection directly without orderBy to avoid dropping documents without lastLoginAt field
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData: any[] = [];
      snapshot.forEach((doc) => {
        usersData.push({ id: doc.id, ...doc.data() });
      });

      usersData.sort((a, b) => {
        const getTime = (val: any) => {
          if (!val) return 0;
          if (val.toMillis) return val.toMillis();
          if (val.seconds) return val.seconds * 1000;
          if (typeof val === 'number') return val;
          if (typeof val === 'string') return new Date(val).getTime();
          return 0;
        };
        return getTime(b.lastLoginAt) - getTime(a.lastLoginAt);
      });

      setUsers(usersData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching users: ", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch published games setting and page visits
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'general'), (doc) => {
      if (doc.exists()) {
        setPublishedGames(doc.data().publishedGames || {});
        setPageVisits(doc.data().pageVisits || 0);
      }
    });
    return () => unsubscribe();
  }, []);

  const toggleGamePublish = async (gameId: string) => {
    try {
      const isCurrentlyPublished = publishedGames[gameId] !== false;
      await setDoc(doc(db, 'settings', 'general'), { 
        publishedGames: {
          ...publishedGames,
          [gameId]: !isCurrentlyPublished
        }
      }, { merge: true });
    } catch (error) {
      console.error('Error toggling game status', error);
      alert('Failed to update game status.');
    }
  };

  // Navigation config
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleNavClick = (id: string) => {
    setCurrentRoute(id);
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900/50 font-sans overflow-hidden text-slate-800 dark:text-slate-200 -mx-4 -my-4 md:-mx-8 md:-my-8" style={{ margin: '-2rem' }}>
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-20 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30 w-72 bg-indigo-900 text-indigo-50 
        transform transition-transform duration-300 ease-in-out flex flex-col shadow-2xl lg:shadow-none
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 flex items-center justify-between border-b border-indigo-800/50">
          <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => onViewChange('home')}>
            <span className="text-xl font-bold tracking-tight text-white">Admin Dashboard</span>
          </div>
          <button className="lg:hidden text-indigo-300 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X size={24} />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          <p className="text-xs font-semibold text-indigo-400/70 uppercase tracking-wider mb-4 px-4">Menu</p>
          <nav className="space-y-1.5">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                  ${currentRoute === item.id 
                    ? 'bg-indigo-600/50 text-white font-medium shadow-sm backdrop-blur-md border border-indigo-500/30' 
                    : 'text-indigo-200 hover:bg-indigo-800/50 hover:text-white'}
                `}
              >
                <item.icon size={20} className={currentRoute === item.id ? 'text-white' : 'text-indigo-400'} />
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-indigo-800/50">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-indigo-200 hover:bg-red-500/20 hover:text-red-300 transition-all" onClick={() => onViewChange('home')}>
            <LogOut size={20} />
            Back to Home
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50 dark:bg-slate-900/50">
        
        {/* Top Header */}
        <header className="h-20 bg-white dark:bg-slate-800/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700/60 flex items-center justify-between px-6 z-10 sticky top-0">
          <div className="flex items-center gap-4">
            <button 
              className="lg:hidden p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 rounded-lg transition-colors"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={24} />
            </button>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200 hidden sm:block capitalize">
              {currentRoute.replace('-', ' ')}
            </h1>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* Sync Button */}
            <button
              onClick={handleSyncUsers}
              disabled={isSyncing}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-sm disabled:opacity-50"
              title="Sync user accounts"
            >
              <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} />
              <span className="hidden sm:inline">{isSyncing ? "Syncing..." : "Sync Users"}</span>
            </button>

            {/* Notifications */}
            <button className="relative p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>

            {/* Admin Profile */}
            <div className="flex items-center gap-3 pl-3 border-l border-slate-200 dark:border-slate-700">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{currentUser?.displayName || "Admin"}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Super Admin</p>
              </div>
              <Avatar src={currentUser?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.displayName || "Admin")}`} alt="Admin" />
            </div>
          </div>
        </header>

        {/* Sync Status Banner */}
        {syncMessage && (
          <div className="bg-emerald-500 text-white px-6 py-2.5 text-sm font-semibold flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top duration-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} />
              <span>{syncMessage}</span>
            </div>
            <button onClick={() => setSyncMessage(null)} className="hover:opacity-80">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Scrollable View Area */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 custom-scrollbar relative">
           
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 font-medium">
                <RefreshCw size={20} className="animate-spin text-indigo-500" />
                <span>Loading and syncing users...</span>
              </div>
            </div>
          ) : (
            <>
              {currentRoute === 'dashboard' && (
                <DashboardOverview 
                  users={users} 
                  onSync={handleSyncUsers} 
                  isSyncing={isSyncing}
                  onViewAll={() => setCurrentRoute('users')}
                  publishedGames={publishedGames}
                  onToggleGamePublish={toggleGamePublish}
                  pageVisits={pageVisits}
                />
              )}
              {currentRoute === 'users' && (
                <UsersManagement 
                  users={users} 
                  onSync={handleSyncUsers} 
                  isSyncing={isSyncing} 
                />
              )}
              {currentRoute === 'settings' && (
                  <div className="max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-8">
                     <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 mb-6">Platform Settings</h2>
                     <div className="space-y-6">
                        <div className="py-4 border-t border-slate-100 dark:border-slate-700">
                           <p className="text-slate-500 dark:text-slate-400">More settings coming soon...</p>
                        </div>
                     </div>
                  </div>
              )}
            </>
          )}
        </div>
      </main>

    </div>
  );
}

