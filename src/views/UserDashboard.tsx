import React from "react";
import { Gamepad2, Award, TrendingUp, Clock, Play } from "lucide-react";
import { cn } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";

export function UserDashboard() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen py-10 max-w-7xl mx-auto px-6">
      <div className="flex items-center gap-6 mb-8">
        {user?.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName || "User"}
            className="w-20 h-20 rounded-full border-4 border-white premium-shadow"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-brand-yellow flex items-center justify-center border-4 border-white premium-shadow text-3xl font-bold text-white">
            {user?.displayName?.charAt(0) || user?.email?.charAt(0) || "U"}
          </div>
        )}
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-slate-100">
            Welcome back, {user?.displayName?.split(" ")[0] || "Student"}! 🎮
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Ready for your next learning adventure?
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Games Played"
          value="12"
          change="+3 this week"
          icon={Gamepad2}
          color="brand-purple"
        />
        <StatCard
          title="Current Streak"
          value="12 Days"
          change="Keep it up!"
          icon={TrendingUp}
          color="brand-orange"
        />
        <StatCard
          title="Total XP"
          value="2,450"
          change="Top 15%"
          icon={Award}
          color="brand-yellow"
        />
        <StatCard
          title="Learning Time"
          value="4.5h"
          change="+1.2h this week"
          icon={Clock}
          color="brand-blue"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Continue Learning */}
          <div className="bg-white dark:bg-slate-800 rounded-[24px] p-6 premium-shadow border border-slate-100 dark:border-slate-700">
            <h2 className="font-display font-bold text-xl text-slate-900 dark:text-slate-100 mb-6">
              Continue Learning
            </h2>
            <div className="space-y-4">
              <GameRow
                name="Spin the Wheel: Airport"
                type="Speaking"
                progress={100}
                completed={true}
                color="brand-purple"
              />
              <GameRow
                name="Vocabulary Match: Animals"
                type="Vocabulary"
                progress={45}
                completed={false}
                color="brand-blue"
              />
            </div>
          </div>

          {/* Assignments */}
          <div className="bg-white dark:bg-slate-800 rounded-[24px] p-6 premium-shadow border border-slate-100 dark:border-slate-700">
            <h2 className="font-display font-bold text-xl text-slate-900 dark:text-slate-100 mb-6">
              New Assignments
            </h2>
            <div className="space-y-4">
              <AssignmentRow
                name="B2 First (FCE) Prep - Conditionals"
                due="Tomorrow, 11:59 PM"
                color="brand-red"
              />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          {/* Achievements */}
          <div className="bg-gradient-to-br from-brand-purple to-brand-blue rounded-[24px] p-6 text-white premium-shadow">
            <h2 className="font-display font-bold text-xl mb-6 flex items-center gap-2">
              <Award className="text-brand-yellow" /> Achievements
            </h2>
            <div className="space-y-4">
              <AchievementRow
                icon="🔥"
                title="Week Warrior"
                desc="Played 7 days in a row"
              />
              <AchievementRow
                icon="🎯"
                title="Perfect Score"
                desc="100% on a Hard game"
              />
              <AchievementRow
                icon="🧠"
                title="Vocab Master"
                desc="Learned 500 new words"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, change, icon: Icon, color }: any) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-[20px] p-6 premium-shadow border border-slate-100 dark:border-slate-700 flex items-start justify-between">
      <div>
        <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mb-1">{title}</p>
        <h3 className="text-3xl font-display font-bold text-slate-900 dark:text-slate-100 mb-2">
          {value}
        </h3>
        <p className="text-xs font-medium text-brand-green">{change}</p>
      </div>
      <div
        className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center bg-opacity-10",
          `bg-${color}/10 text-${color}`,
        )}
      >
        <Icon size={24} />
      </div>
    </div>
  );
}

function GameRow({ name, type, progress, completed, color }: any) {
  return (
    <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:border-slate-700 transition-colors bg-slate-50 dark:bg-slate-900/50 hover:bg-white dark:bg-slate-800 group">
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-sm",
            `bg-${color}`,
          )}
        >
          <Gamepad2 size={24} />
        </div>
        <div>
          <h4 className="font-bold text-slate-900 dark:text-slate-100">{name}</h4>
          <p className="text-sm text-slate-500 dark:text-slate-400">{type}</p>
        </div>
      </div>
      <div className="flex items-center gap-6">
        {completed ? (
          <div className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center gap-1">
            Completed
          </div>
        ) : (
          <div className="hidden sm:block w-32">
            <div className="flex justify-between text-xs font-medium mb-1">
              <span className="text-slate-500 dark:text-slate-400">Progress</span>
              <span className="text-slate-900 dark:text-slate-100">{progress}%</span>
            </div>
            <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full", `bg-${color}`)}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
        <button
          className={cn(
            "p-2 rounded-full text-white shadow-sm hover:scale-110 transition-transform",
            completed ? "bg-slate-300" : `bg-${color}`,
          )}
        >
          <Play size={16} className={cn(completed && "opacity-50")} />
        </button>
      </div>
    </div>
  );
}

function AssignmentRow({ name, due, color }: any) {
  return (
    <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:border-slate-700 transition-colors bg-slate-50 dark:bg-slate-900/50 hover:bg-white dark:bg-slate-800">
      <div className="flex items-center gap-4">
        <div className="w-2 h-12 rounded-full bg-brand-red" />
        <div>
          <h4 className="font-bold text-slate-900 dark:text-slate-100">{name}</h4>
          <p className="text-sm text-brand-red font-medium">Due: {due}</p>
        </div>
      </div>
      <button className="px-4 py-2 bg-brand-purple text-white rounded-xl text-sm font-bold shadow-sm hover:bg-brand-purple/90 transition-colors">
        Start
      </button>
    </div>
  );
}

function AchievementRow({ icon, title, desc }: any) {
  return (
    <div className="flex items-center gap-4 p-3 rounded-xl bg-white dark:bg-slate-800/10 hover:bg-white dark:bg-slate-800/20 transition-colors">
      <div className="text-2xl">{icon}</div>
      <div>
        <div className="font-bold text-white">{title}</div>
        <div className="text-xs text-white/70">{desc}</div>
      </div>
    </div>
  );
}
