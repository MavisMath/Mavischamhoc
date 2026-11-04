import React, { useState, useEffect } from 'react';
import { GoogleDocsHeader } from './components/dashboard/GoogleDocsHeader';
import { TemplateGallery } from './components/dashboard/TemplateGallery';
import { RecentPadletsGrid } from './components/dashboard/RecentPadletsGrid';
import { MathAgentDrawer } from './components/chat/MathAgentDrawer';
import { PadletDocument } from './types/padlet';
import { AgentMathResponse, AIExecutionMode } from './types/agent';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'dashboard' | 'workspace'>('dashboard');
  const [activeRoomId, setActiveRoomId] = useState<string>('phong-toan-hoc');
  const [activeRoomTitle, setActiveRoomTitle] = useState<string>('Padlet Toán học');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  const [padlets, setPadlets] = useState<PadletDocument[]>([]);

  // Load Padlets Registry
  useEffect(() => {
    try {
      const raw = localStorage.getItem('mathboard_padlet_registry');
      if (raw) {
        setPadlets(JSON.parse(raw));
      } else {
        // Fallback default sample padlets
        const defaults: PadletDocument[] = [
          {
            roomId: 'phong-toan-hoc',
            name: 'Phòng học Toán 9 - Ôn thi vào 10',
            hostId: 'u_gv',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            cardsCount: 3,
            strokesCount: 12,
            preview: '⭕ Đường tròn (O) và tiếp tuyến PM, PN',
            themeColor: 'from-pink-500 to-rose-600'
          },
          {
            roomId: 'math-grade9',
            name: 'Khảo sát hàm số & Parabol Oxy',
            hostId: 'u_gv',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            cardsCount: 2,
            strokesCount: 6,
            preview: '📈 Đồ thị Parabol y = x² - 4x + 3',
            themeColor: 'from-blue-500 to-indigo-600'
          }
        ];
        setPadlets(defaults);
        localStorage.setItem('mathboard_padlet_registry', JSON.stringify(defaults));
      }
    } catch (e) {}
  }, []);

  const handleOpenPadlet = (roomId: string) => {
    const p = padlets.find(item => item.roomId === roomId);
    if (p) setActiveRoomTitle(p.name);
    setActiveRoomId(roomId);
    // If opening full workspace, redirect to the live padlet page or switch view
    window.location.href = `padlet_ai_mathboard.html?room=${encodeURIComponent(roomId)}`;
  };

  const handleSelectTemplate = (templateKey: string) => {
    const newRoomId = 'padlet-' + Date.now().toString(36);
    let title = 'Padlet Toán học chưa đặt tên';
    if (templateKey === 'geometry_circle') title = 'Hình học phẳng - Đường tròn & Tiếp tuyến';
    if (templateKey === 'algebra_parabola') title = 'Đại số & Đồ thị Parabol Oxy';
    if (templateKey === 'geometry_3d') title = 'Hình không gian 3D - Chóp đều S.ABCD';

    const newDoc: PadletDocument = {
      roomId: newRoomId,
      name: title,
      hostId: 'u_gv',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      cardsCount: 1,
      strokesCount: 0,
      preview: title,
      themeColor: 'from-pink-500 to-rose-600'
    };

    const updated = [newDoc, ...padlets];
    setPadlets(updated);
    try {
      localStorage.setItem('mathboard_padlet_registry', JSON.stringify(updated));
    } catch (e) {}

    window.location.href = `padlet_ai_mathboard.html?room=${encodeURIComponent(newRoomId)}`;
  };

  const handleRenamePadlet = (roomId: string) => {
    const p = padlets.find(item => item.roomId === roomId);
    if (!p) return;
    const newName = prompt('Nhập tên mới cho Padlet:', p.name);
    if (newName && newName.trim()) {
      const updated = padlets.map(item => item.roomId === roomId ? { ...item, name: newName.trim(), updatedAt: new Date().toISOString() } : item);
      setPadlets(updated);
      try {
        localStorage.setItem('mathboard_padlet_registry', JSON.stringify(updated));
      } catch (e) {}
    }
  };

  const handleDuplicatePadlet = (roomId: string) => {
    const p = padlets.find(item => item.roomId === roomId);
    if (!p) return;
    const dupId = 'padlet-' + Date.now().toString(36);
    const dup: PadletDocument = {
      ...p,
      roomId: dupId,
      name: `Bản sao của ${p.name}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const updated = [dup, ...padlets];
    setPadlets(updated);
    try {
      localStorage.setItem('mathboard_padlet_registry', JSON.stringify(updated));
    } catch (e) {}
  };

  const handleDeletePadlet = (roomId: string) => {
    const p = padlets.find(item => item.roomId === roomId);
    if (!p) return;
    if (confirm(`Bạn có chắc muốn xóa "${p.name}" không?`)) {
      const updated = padlets.filter(item => item.roomId !== roomId);
      setPadlets(updated);
      try {
        localStorage.setItem('mathboard_padlet_registry', JSON.stringify(updated));
      } catch (e) {}
    }
  };

  const filteredPadlets = padlets.filter(p => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.preview && p.preview.toLowerCase().includes(q));
  });

  return (
    <div className="min-h-screen flex flex-col bg-white font-sans text-slate-900">
      <GoogleDocsHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <TemplateGallery
        onSelectTemplate={handleSelectTemplate}
      />

      <main className="flex-1 px-4 md:px-10 py-6 max-w-6xl mx-auto w-full">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-6">
          <h2 className="text-base font-medium text-[#202124]">Padlet gần đây</h2>
          <span className="text-xs text-slate-500 font-semibold">{filteredPadlets.length} bảng</span>
        </div>

        <RecentPadletsGrid
          padlets={filteredPadlets}
          onOpenPadlet={handleOpenPadlet}
          onRenamePadlet={handleRenamePadlet}
          onDuplicatePadlet={handleDuplicatePadlet}
          onDeletePadlet={handleDeletePadlet}
        />
      </main>

      <MathAgentDrawer
        isOpen={isAiDrawerOpen}
        onClose={() => setIsAiDrawerOpen(false)}
        onApplyResult={(res) => console.log('AI Result:', res)}
      />
    </div>
  );
};
