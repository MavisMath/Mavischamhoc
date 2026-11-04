import React from 'react';

interface GoogleDocsHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  userName?: string;
  userEmail?: string;
}

export const GoogleDocsHeader: React.FC<GoogleDocsHeaderProps> = ({
  searchQuery,
  onSearchChange,
  userName = 'Thầy Nguyễn (GV)',
  userEmail = 'giaovien@gmail.com'
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200/80 px-4 py-2.5 flex items-center justify-between gap-4 h-16 shadow-2xs">
      <!-- Left: Logo & App Title -->
      <div className="flex items-center gap-3 shrink-0">
        <button className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600 transition" title="Menu chính">
          <i className="fa-solid fa-bars text-lg"></i>
        </button>
        <div className="flex items-center gap-2.5 select-none">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-500 via-rose-500 to-amber-400 flex items-center justify-center text-white shadow-md shadow-pink-500/20 text-lg">
            <i className="fa-solid fa-shapes"></i>
          </div>
          <div className="hidden sm:block">
            <span className="font-['Google_Sans',sans-serif] text-[20px] font-semibold text-slate-800 tracking-tight">MathBoard</span>
            <span className="text-xs text-pink-600 font-bold ml-1 px-1.5 py-0.5 bg-pink-50 border border-pink-200 rounded-md">Padlet</span>
          </div>
        </div>
      </div>

      <!-- Center: Search Pill (Google Docs Style) -->
      <div className="flex-1 max-w-[720px] mx-2">
        <div className="relative flex items-center bg-[#f1f3f4] hover:bg-[#e8eaed] focus-within:bg-white focus-within:shadow-md rounded-full px-4 py-2.5 transition duration-150">
          <i className="fa-solid fa-magnifying-glass text-slate-500 text-sm ml-1 mr-3"></i>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Tìm kiếm bảng Padlet..."
            className="w-full bg-transparent border-none outline-none text-slate-800 text-sm placeholder-slate-500"
          />
          {searchQuery && (
            <button onClick={() => onSearchChange('')} className="text-slate-400 hover:text-slate-700 w-6 h-6 rounded-full flex items-center justify-center">
              <i className="fa-solid fa-xmark text-sm"></i>
            </button>
          )}
        </div>
      </div>

      <!-- Right: User Avatar -->
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-sm flex items-center justify-center shadow-xs">
          {userName.substring(0, 2).toUpperCase()}
        </div>
      </div>
    </header>
  );
};
