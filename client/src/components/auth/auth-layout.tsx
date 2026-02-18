import { motion } from "framer-motion";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden bg-slate-900">
            {/* Ocean/Sea Background with Blur */}
            <div
                className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-40 blur-sm"
                style={{ backgroundImage: "url('https://images.unsplash.com/photo-1494412651409-8963ce7935a7?q=80&w=2070&auto=format&fit=crop')" }}
            />

            {/* Animated Gradient Overlay */}
            <div className="absolute inset-0 z-10 bg-gradient-to-br from-blue-900/20 via-transparent to-slate-900/60" />

            {/* Main Content Card */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="relative z-20 w-full max-w-lg"
            >
                <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden border border-white/20">
                    <div className="px-8 py-10">
                        {/* Logo/Title Header */}
                        <div className="flex flex-col items-center mb-8">
                            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-3 shadow-lg shadow-blue-500/30">
                                <svg
                                    className="w-8 h-8 text-white"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
                                    />
                                </svg>
                            </div>
                            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Sea Crew Manager</h1>
                        </div>

                        {children}
                    </div>

                    {/* Card Footer */}
                    <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-center space-x-6 text-[10px] text-slate-400 font-medium tracking-wider uppercase">
                        <div className="flex items-center">
                            <span className="w-1 h-1 bg-slate-300 rounded-full mr-2" />
                            256-bit Encryption
                        </div>
                        <div className="flex items-center">
                            <span className="w-1 h-1 bg-slate-300 rounded-full mr-2" />
                            Data Secure
                        </div>
                        <div className="flex items-center">
                            <span className="w-1 h-1 bg-slate-300 rounded-full mr-2" />
                            GDPR Policy
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
