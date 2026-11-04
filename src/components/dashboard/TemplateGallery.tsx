import React from 'react';

interface TemplateGalleryProps {
  onSelectTemplate: (templateKey: string) => void;
}

export const TemplateGallery: React.FC<TemplateGalleryProps> = ({ onSelectTemplate }) => {
  return (
    <section className="bg-[#f1f3f4] border-b border-[#dadce0] px-4 md:px-10 py-5">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-[#202124]">Bắt đầu một bảng Padlet mới</span>
          <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5 px-2.5 py-1">
            Thư viện mẫu ↕
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
          <!-- 1. BLANK PADLET CARD WITH 4-COLOR PLUS -->
          <div onClick={() => onSelectTemplate('blank')} className="cursor-pointer group flex flex-col">
            <div className="w-full h-[180px] bg-white rounded-lg border border-[#dadce0] group-hover:border-blue-600 group-hover:shadow-md flex items-center justify-center transition-all duration-200">
              <svg className="w-12 h-12 transition transform group-hover:scale-110" viewBox="0 0 48 48">
                <path fill="#4285F4" d="M24 10v14H10v4h14v14h4V28h14v-4H28V10z" />
                <path fill="#EA4335" d="M24 24H10v4h14z" />
                <path fill="#FBBC05" d="M24 28v14h4V28z" />
                <path fill="#34A853" d="M28 24h14v4H28z" />
              </svg>
            </div>
            <span className="mt-2 text-xs font-medium text-[#202124] group-hover:text-blue-600 truncate">Bảng trống</span>
            <span className="text-[11px] text-slate-400">Padlet tự do</span>
          </div>

          <!-- 2. PLANE GEOMETRY TEMPLATE -->
          <div onClick={() => onSelectTemplate('geometry_circle')} className="cursor-pointer group flex flex-col">
            <div className="w-full h-[180px] bg-white rounded-lg border border-[#dadce0] group-hover:border-blue-600 group-hover:shadow-md p-3 flex flex-col justify-between transition-all duration-200">
              <div className="w-full flex-1 bg-gradient-to-br from-pink-50 to-rose-100 rounded-md border border-pink-100 p-2 flex flex-col items-center justify-center text-center">
                <i className="fa-regular fa-circle text-2xl text-pink-500 mb-1"></i>
                <span className="text-[11px] font-bold text-pink-700">Hình học phẳng</span>
                <span className="text-[9px] text-pink-600">Đường tròn & Tiếp tuyến</span>
              </div>
              <span className="text-[10px] text-slate-500 font-semibold truncate mt-2">Toán 9 ôn thi vào 10</span>
            </div>
            <span className="mt-2 text-xs font-medium text-[#202124] group-hover:text-blue-600 truncate">Hình học phẳng (Đường tròn)</span>
            <span className="text-[11px] text-slate-400">Mẫu có sẵn bài giảng</span>
          </div>

          <!-- 3. ALGEBRA PARABOLA -->
          <div onClick={() => onSelectTemplate('algebra_parabola')} className="cursor-pointer group flex flex-col">
            <div className="w-full h-[180px] bg-white rounded-lg border border-[#dadce0] group-hover:border-blue-600 group-hover:shadow-md p-3 flex flex-col justify-between transition-all duration-200">
              <div className="w-full flex-1 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-md border border-blue-100 p-2 flex flex-col items-center justify-center text-center">
                <i className="fa-solid fa-chart-line text-2xl text-blue-500 mb-1"></i>
                <span className="text-[11px] font-bold text-blue-700">Đại số & Đồ thị Oxy</span>
                <span className="text-[9px] text-blue-600">Parabol y = x²</span>
              </div>
              <span className="text-[10px] text-slate-500 font-semibold truncate mt-2">Tọa độ & Khảo sát</span>
            </div>
            <span className="mt-2 text-xs font-medium text-[#202124] group-hover:text-blue-600 truncate">Đại số & Khảo sát Oxy</span>
            <span className="text-[11px] text-slate-400">Mẫu hàm số</span>
          </div>

          <!-- 4. 3D GEOMETRY -->
          <div onClick={() => onSelectTemplate('geometry_3d')} className="cursor-pointer group flex flex-col">
            <div className="w-full h-[180px] bg-white rounded-lg border border-[#dadce0] group-hover:border-blue-600 group-hover:shadow-md p-3 flex flex-col justify-between transition-all duration-200">
              <div className="w-full flex-1 bg-gradient-to-br from-emerald-50 to-teal-100 rounded-md border border-emerald-100 p-2 flex flex-col items-center justify-center text-center">
                <i className="fa-solid fa-cube text-2xl text-emerald-600 mb-1"></i>
                <span className="text-[11px] font-bold text-emerald-800">Hình không gian 3D</span>
                <span className="text-[9px] text-emerald-700">Chóp đều S.ABCD</span>
              </div>
              <span className="text-[10px] text-slate-500 font-semibold truncate mt-2">Xoay 360° Three.js</span>
            </div>
            <span className="mt-2 text-xs font-medium text-[#202124] group-hover:text-blue-600 truncate">Hình không gian 3D</span>
            <span className="text-[11px] text-slate-400">Mô hình trực quan</span>
          </div>

          <!-- 5. WORKSHEET EXAM -->
          <div onClick={() => onSelectTemplate('worksheet')} className="cursor-pointer group flex flex-col">
            <div className="w-full h-[180px] bg-white rounded-lg border border-[#dadce0] group-hover:border-blue-600 group-hover:shadow-md p-3 flex flex-col justify-between transition-all duration-200">
              <div className="w-full flex-1 bg-gradient-to-br from-purple-50 to-fuchsia-100 rounded-md border border-purple-100 p-2 flex flex-col items-center justify-center text-center">
                <i className="fa-solid fa-file-pen text-2xl text-purple-600 mb-1"></i>
                <span className="text-[11px] font-bold text-purple-800">Phiếu bài tập</span>
                <span className="text-[9px] text-purple-700">Đề bài & Hướng dẫn</span>
              </div>
              <span className="text-[10px] text-slate-500 font-semibold truncate mt-2">Dành cho lớp học</span>
            </div>
            <span className="mt-2 text-xs font-medium text-[#202124] group-hover:text-blue-600 truncate">Phiếu bài tập & Đề thi</span>
            <span className="text-[11px] text-slate-400">Mẫu giảng bài</span>
          </div>
        </div>
      </div>
    </section>
  );
};
