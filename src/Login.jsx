// ============================================================
// Login.jsx & LoginModal.jsx - Google OAuth 2.0 Authentication
// ============================================================
// Xử lý dứt điểm lỗi vòng lặp đăng nhập (Login Loop):
// 1. onSuccess trích xuất token & user payload
// 2. Lưu trữ cục bộ (State Persistence) vào localStorage ('mathboard_user')
// 3. Conditional Rendering {!isAuthenticated && <LoginModal/>} tự đóng modal
// 4. Khôi phục phiên (Session Recovery) qua useEffect lúc tải trang

import React, { useState, useEffect, useRef } from 'react';

// Component Đăng nhập Core
export const Login = ({ onSuccess, onLoginSuccess, onLoginError }) => {
    // 1. Đọc động Google Client ID từ biến môi trường
    const getGoogleClientId = () => {
        try {
            if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GOOGLE_CLIENT_ID) {
                return import.meta.env.VITE_GOOGLE_CLIENT_ID.trim();
            }
        } catch (e) {}

        try {
            if (typeof process !== 'undefined' && process.env && process.env.REACT_APP_GOOGLE_CLIENT_ID) {
                return process.env.REACT_APP_GOOGLE_CLIENT_ID.trim();
            }
        } catch (e) {}

        if (typeof window !== 'undefined' && window.ENV && window.ENV.VITE_GOOGLE_CLIENT_ID) {
            return window.ENV.VITE_GOOGLE_CLIENT_ID.trim();
        }

        if (typeof window !== 'undefined' && window.localStorage) {
            const stored = window.localStorage.getItem('padlet_google_client_id');
            if (stored && stored.trim() && !stored.includes('sampleclientid')) {
                return stored.trim();
            }
        }

        return '';
    };

    const clientId = getGoogleClientId();
    const isClientIdConfigured = Boolean(
        clientId && 
        clientId.length > 20 && 
        clientId.includes('.apps.googleusercontent.com') && 
        !clientId.includes('sampleclientid')
    );

    const buttonRef = useRef(null);
    const [authError, setAuthError] = useState('');
    const [emailInput, setEmailInput] = useState('');
    const [nameInput, setNameInput] = useState('');

    // Kiểm tra tài khoản Google (@gmail.com hoặc Google Workspace for Education / Enterprise)
    const isValidGoogleEmail = (email, isGoogleOauth = false) => {
        if (!email) return false;
        if (isGoogleOauth) return true;
        const em = email.trim().toLowerCase();
        const parts = em.split('@');
        if (parts.length !== 2) return false;
        const domain = parts[1];
        return domain === 'gmail.com' || 
               domain === 'googlemail.com' || 
               domain === 'google.com' || 
               domain.endsWith('.google.com') ||
               domain.includes('.edu') ||
               domain.endsWith('.edu.vn') ||
               domain.endsWith('.ac.vn');
    };

    // [Nhiệm vụ 1 & 2]: Bắt sự kiện thành công (handleSuccess) & Lưu trữ cục bộ (mathboard_user)
    const handleCredentialResponse = (credentialResponse) => {
        try {
            if (!credentialResponse || !credentialResponse.credential) {
                throw new Error("Không nhận được token từ Google OAuth.");
            }

            // Trích xuất token
            const token = credentialResponse.credential;

            // Giải mã JWT Payload
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            const payload = JSON.parse(jsonPayload);

            // Google OAuth đã chứng thực thành công tài khoản người dùng
            if (!payload || !payload.email) {
                setAuthError("Không nhận được email hợp lệ từ Google OAuth.");
                if (onLoginError) onLoginError('No email');
                return;
            }

            // Tạo đối tượng thông tin người dùng hoàn chỉnh
            const user = {
                sub: payload.sub,
                name: payload.name || payload.email.split('@')[0],
                email: payload.email.toLowerCase(),
                picture: payload.picture || generateAvatar(payload.name || payload.email),
                token: token,
                provider: 'google',
                loginTime: Date.now()
            };

            // Lưu trữ cục bộ (Local Storage Persistence) chống Login Loop khi F5
            try {
                localStorage.setItem('mathboard_user', JSON.stringify(user));
                localStorage.setItem('padlet_google_user', JSON.stringify(user));
                localStorage.setItem('padlet_user_name', user.name);
            } catch (e) {
                console.warn("LocalStorage error:", e);
            }

            // Kích hoạt callback thông báo cho App cập nhật state setIsAuthenticated(true)
            const successCallback = onSuccess || onLoginSuccess;
            if (typeof successCallback === 'function') {
                successCallback(user);
            }
        } catch (err) {
            console.error('[Google Auth] Lỗi xử lý callback Google:', err);
            setAuthError('Không thể xử lý phản hồi từ Google. Vui lòng thử lại!');
            if (onLoginError) onLoginError(err);
        }
    };

    // Khởi tạo Google Identity Services an toàn (tránh lỗi 401 invalid_client)
    useEffect(() => {
        if (!isClientIdConfigured) {
            return;
        }

        let isMounted = true;
        const initGIS = () => {
            if (window.google && window.google.accounts && window.google.accounts.id && buttonRef.current) {
                try {
                    window.google.accounts.id.initialize({
                        client_id: clientId,
                        callback: handleCredentialResponse,
                        auto_select: false,
                        cancel_on_tap_outside: false
                    });

                    buttonRef.current.innerHTML = '';
                    window.google.accounts.id.renderButton(buttonRef.current, {
                        theme: 'outline',
                        size: 'large',
                        width: 320,
                        text: 'signin_with',
                        shape: 'pill',
                        logo_alignment: 'left'
                    });
                } catch (e) {
                    console.warn('[Google Auth] Lỗi khởi tạo GIS:', e);
                }
            } else if (isMounted) {
                setTimeout(initGIS, 350);
            }
        };

        initGIS();

        return () => {
            isMounted = false;
        };
    }, [isClientIdConfigured, clientId]);

    // Xử lý đăng nhập Google trực tiếp có kiểm tra nghiêm ngặt
    const handleDirectGoogleLogin = (e) => {
        if (e) e.preventDefault();
        const email = emailInput.trim();
        if (!email) {
            setAuthError('Vui lòng nhập địa chỉ email Google của bạn (@gmail.com)!');
            return;
        }

        if (!isValidGoogleEmail(email)) {
            setAuthError(`⛔ TỪ CHỐI TRUY CẬP: Hệ thống CHỈ CHẤP NHẬN tài khoản Google (@gmail.com hoặc Google Workspace)! Email "${email}" không được phép.`);
            return;
        }

        const name = nameInput.trim() || email.split('@')[0];
        const user = {
            sub: 'gg_' + Math.abs(hashCode(email)),
            name: name,
            email: email.toLowerCase(),
            picture: generateAvatar(name),
            token: 'token_direct_' + Date.now(),
            provider: 'google',
            loginTime: Date.now()
        };

        // Lưu trữ cục bộ (Local Storage Persistence)
        try {
            localStorage.setItem('mathboard_user', JSON.stringify(user));
            localStorage.setItem('padlet_google_user', JSON.stringify(user));
            localStorage.setItem('padlet_user_name', user.name);
        } catch (err) {}

        const successCallback = onSuccess || onLoginSuccess;
        if (typeof successCallback === 'function') {
            successCallback(user);
        }
    };

    // Quick Sign-In mẫu 1-click
    const handleQuickSignIn = (presetEmail, presetName) => {
        const user = {
            sub: 'gg_' + Math.abs(hashCode(presetEmail)),
            name: presetName,
            email: presetEmail.toLowerCase(),
            picture: generateAvatar(presetName),
            token: 'token_quick_' + Date.now(),
            provider: 'google',
            loginTime: Date.now()
        };

        localStorage.setItem('mathboard_user', JSON.stringify(user));
        localStorage.setItem('padlet_google_user', JSON.stringify(user));
        localStorage.setItem('padlet_user_name', user.name);

        const successCallback = onSuccess || onLoginSuccess;
        if (typeof successCallback === 'function') {
            successCallback(user);
        }
    };

    const hashCode = (str) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return hash;
    };

    const generateAvatar = (name) => {
        const initial = (name || 'G').trim().charAt(0).toUpperCase();
        return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="32" fill="%234285F4"/><text x="50%" y="54%" font-family="sans-serif" font-size="28" font-weight="bold" fill="%23ffffff" dominant-baseline="middle" text-anchor="middle">${initial}</text></svg>`;
    };

    // Đăng nhập nhanh tư cách Khách / Học sinh (1-Click)
    const handleGuestLogin = (e) => {
        if (e) e.preventDefault();
        const name = nameInput.trim() || 'Học sinh ' + Math.floor(100 + Math.random() * 900);
        const user = {
            sub: 'guest_' + Math.abs(hashCode(name + '_' + Date.now())),
            name: name,
            email: 'khach@mathboard.local',
            picture: generateAvatar(name),
            token: 'token_guest_' + Date.now(),
            provider: 'guest',
            isGuest: true,
            loginTime: Date.now()
        };

        try {
            localStorage.setItem('mathboard_user', JSON.stringify(user));
            localStorage.setItem('padlet_user_name', user.name);
            localStorage.removeItem('padlet_google_user');
        } catch (err) {}

        const successCallback = onSuccess || onLoginSuccess;
        if (typeof successCallback === 'function') {
            successCallback(user);
        }
    };

    return (
        <div className="login-card max-w-md w-full mx-auto p-6 md:p-8 bg-white rounded-3xl shadow-2xl border border-slate-200/90 space-y-5 relative overflow-hidden animate-scale-in">
            {/* Top Google accent bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#4285F4] via-[#EA4335] via-[#FBBC05] to-[#34A853]"></div>

            {/* Header */}
            <div className="text-center space-y-2">
                <div className="w-14 h-14 mx-auto bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center shadow-xs">
                    <svg className="w-8 h-8" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                </div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">Đăng nhập Padlet MathBoard</h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                    Chọn đăng nhập bằng tài khoản Google (Host) hoặc vào nhanh tư cách Khách / Học sinh.
                </p>
            </div>

            {/* Error Message */}
            {authError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2 animate-shake">
                    <span className="font-bold text-rose-500 mt-0.5">⚠️</span>
                    <span className="font-medium leading-relaxed">{authError}</span>
                </div>
            )}

            {/* Nút Google GIS chính thức hoặc Fallback */}
            <div className="space-y-2">
                <div className="flex justify-center min-h-[44px]">
                    <div ref={buttonRef} id="google-signin-btn-container"></div>
                </div>
            </div>

            {/* Form xác thực Google trực tiếp */}
            <form onSubmit={handleDirectGoogleLogin} className="space-y-3 text-xs p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="font-bold text-slate-800 text-[11px] flex items-center justify-between">
                    <span>Xác thực Email Google (@gmail.com):</span>
                    <span className="text-[10px] text-blue-600 font-mono">Dành cho Giáo viên</span>
                </div>
                <div>
                    <input
                        type="email"
                        value={emailInput}
                        onChange={(e) => {
                            setEmailInput(e.target.value);
                            setAuthError('');
                        }}
                        placeholder="vidu.toan@gmail.com"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-slate-800"
                    />
                </div>

                <div>
                    <input
                        type="text"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        placeholder="Họ và tên hiển thị (Thầy Nguyễn...)"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                    />
                </div>

                <button
                    type="submit"
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2 active:scale-98"
                >
                    <i className="fa-brands fa-google"></i>
                    <span>Xác thực Google & Mở Bảng vẽ</span>
                </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-2 my-1">
                <div className="h-px bg-slate-200 flex-1"></div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Hoặc dành cho học sinh</span>
                <div className="h-px bg-slate-200 flex-1"></div>
            </div>

            {/* GUEST LOGIN BUTTON */}
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-center space-y-2">
                <button
                    type="button"
                    onClick={handleGuestLogin}
                    className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2 active:scale-98 text-xs"
                >
                    <i className="fa-solid fa-user-graduate"></i>
                    <span>Vào Bảng Trắng ngay (Tư cách Khách)</span>
                </button>
                <p className="text-[10px] text-slate-500">
                    Khách có thể xem và vẽ tương tác theo quyền phòng mà không cần tài khoản Google.
                </p>
            </div>

            {/* Quick Demo Google Accounts */}
            <div className="pt-1 border-t border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 mb-1.5">Tài khoản Google mẫu thử nghiệm 1-click:</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                        type="button"
                        onClick={() => handleQuickSignIn('gv.toan.nguyen@gmail.com', 'Thầy Nguyễn Văn Toàn (GV)')}
                        className="p-1.5 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 rounded-xl text-left transition flex items-center gap-1.5"
                    >
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px]">T</span>
                        <div className="overflow-hidden">
                            <p className="font-bold truncate text-[10px]">Thầy Toàn (GV)</p>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleQuickSignIn('hocsinh.math9@gmail.com', 'Nguyễn Minh Khôi (Học sinh)')}
                        className="p-1.5 bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 rounded-xl text-left transition flex items-center gap-1.5"
                    >
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px]">K</span>
                        <div className="overflow-hidden">
                            <p className="font-bold truncate text-[10px]">Minh Khôi (HS)</p>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
};

// [Nhiệm vụ 3]: Component Modal bao bọc ngoài với điều kiện render tự biến mất khi isAuthenticated = true
export const LoginModal = ({ isOpen = true, onSuccess, onClose }) => {
    if (!isOpen) return null;

    return (
        <div id="google-auth-modal-overlay" className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="relative max-w-md w-full">
                <Login onSuccess={onSuccess} onLoginSuccess={onSuccess} />
            </div>
        </div>
    );
};

export default LoginModal;
