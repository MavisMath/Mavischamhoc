import React, { useState } from 'react';
import { PadletDocument } from '../../types/padlet';

interface RecentPadletsGridProps {
  padlets: PadletDocument[];
  onOpenPadlet: (roomId: string) => void;
  onRenamePadlet: (roomId: string) => void;
  onDuplicatePadlet: (roomId: string) => void;
  onDeletePadlet: (roomId: string) => void;
}

export const RecentPadletsGrid: React.FC<RecentPadletsGridProps> = ({
  padlets,
  onOpenPadlet,
  onRenamePadlet,
  onDuplicatePadlet,
  onDeletePadlet
}) => {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const toggleMenu = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setActiveMenuId(activeMenuId === id ? null : id);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
      {padlets.map((p) => {
        const theme = p.themeColor || 'from-pink-500 to-rose-600';
        return (
          <div
            key={p.roomId}
            onClick={() => onOpenPadlet(p.roomId)}
            className="group rounded-xl border border-slate-200/90 hover:border-blue-500 overflow-hidden bg-white shadow-2xs hover:shadow-xl transition-all duration-200 cursor-pointer flex flex-col justify-between"
          >
            <!-- Banner Visual -->
            <div className={`h-36 bg-gradient-to-br ${theme} p-4 flex flex-col justify-between text-white relative select-none`}>
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-xs text-[10px] font-bold uppercase tracking-wider">Padlet</span>
                <span className="text-xs opacity-80"><i className="fa-solid fa-cloud"></i></span>
              </div>
              <div>
                <div className="text-xl mb-1"><i className="fa-solid fa-shapes"></i></div>
                <p className="text-xs font-semibold opacity-90 line-clamp-2">{p.preview || 'Bảng vẽ toán học'}</p>
              </div>
              <div className="flex items-center gap-2 text-[10px] opacity-80 font-medium">
                <span><i className="fa-solid fa-clone text-[9px]"></i> {p.cardsCount || 0} thẻ</span>
                <span><i className="fa-solid fa-pen-nib text-[9px]"></i> {p.strokesCount || 0} nét</span>
              </div>
            </div>

            <!-- Footer Metadata -->
            <div className="p-3 bg-white border-t border-slate-100 flex items-center justify-between gap-2">
              <div className="truncate flex-1">
                <h4 className="font-bold text-slate-800 text-xs truncate group-hover:text-blue-600 transition" title={p.name}>
                  {p.name}
                </h4>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                  <i className="fa-solid fa-file-lines text-blue-500 text-[10px]"></i>
                  <span>Padlet Toán học</span>
                </div>
              </div>

              <!-- 3-Dots Menu -->
              <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={(e) => toggleMenu(e, p.roomId)}
                  className="w-7 h-7 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition"
                >
                  <i className="fa-solid fa-ellipsis-vertical text-xs"></i>
                </button>

                {activeMenuId === p.roomId && (
                  <div className="absolute right-0 bottom-8 w-44 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 z-40 text-xs font-medium text-slate-700">
                    <button
                      onClick={() => { setActiveMenuId(null); onRenamePadlet(p.roomId); }}
                      className="w-full text-left px-3.5 py-2 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                    >
                      <i className="fa-solid fa-pen-to-square text-blue-500"></i> Đổi tên
                    </button>
                    <button
                      onClick={() => { setActiveMenuId(null); onDuplicatePadlet(p.roomId); }}
                      className="w-full text-left px-3.5 py-2 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                    >
                      <i className="fa-solid fa-copy text-indigo-500"></i> Tạo bản sao
                    </button>
                    <div className="my-1 border-t border-slate-100"></div>
                    <button
                      onClick={() => { setActiveMenuId(null); onDeletePadlet(p.roomId); }}
                      className="w-full text-left px-3.5 py-2 hover:bg-rose-50 text-rose-600 flex items-center gap-2"
                    >
                      <i className="fa-solid fa-trash-can"></i> Xóa bảng
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
