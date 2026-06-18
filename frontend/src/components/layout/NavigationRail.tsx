import classNames from "classnames";

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  action?: () => void;
}

interface Props {
  activeMenu: string | null;
  setActiveMenu: (id: string | null) => void;
  onLogout: () => void;
  onSettingsClick: () => void;
  onNewProject: () => void;
  onDashboard: () => void;
}

export default function NavigationRail({
  activeMenu, setActiveMenu, onLogout, onSettingsClick, onNewProject, onDashboard,
}: Props) {
  const items: NavItem[] = [
    {
      id: "new",
      label: "New Project",
      action: onNewProject,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
    },
    {
      id: "dashboard",
      label: "Blank Canvas",
      action: onDashboard,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z" />
        </svg>
      ),
    },
    {
      id: "history",
      label: "History",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      id: "library",
      label: "Element Library",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
        </svg>
      ),
    },
    {
      id: "settings",
      label: "Settings",
      action: onSettingsClick,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="fixed left-0 top-0 bottom-0 w-16 bg-stone-950 border-r border-stone-800 z-[60] flex flex-col items-center py-6 space-y-4 shadow-xl text-stone-400">
      {/* Logo */}
      <div className="mb-4 flex items-center justify-center w-8 h-8 rounded bg-stone-900 border border-stone-700 text-amber-500 font-mono text-sm shadow select-none">
        {"[ ]"}
      </div>

      {items.map((item) => (
        <button
          key={item.id}
          onClick={() =>
            item.action
              ? item.action()
              : setActiveMenu(activeMenu === item.id ? null : item.id)
          }
          className={classNames(
            "p-3 rounded-xl transition-all duration-200 group relative",
            activeMenu === item.id
              ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
              : "hover:bg-stone-900 hover:text-white"
          )}
          title={item.label}
        >
          {item.icon}
          {/* Tooltip */}
          <span className="absolute left-14 bg-stone-800 border border-stone-700 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
            {item.label}
          </span>
        </button>
      ))}

      <div className="flex-grow" />

      {/* Logout */}
      <button
        onClick={onLogout}
        className="p-3 text-red-500/60 hover:text-red-400 hover:bg-red-900/20 rounded-xl transition-colors"
        title="Logout"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      </button>
    </div>
  );
}