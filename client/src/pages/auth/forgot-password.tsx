import { useState, useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import AuthLayout from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { ChevronRight, Mail, CheckCircle2, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ForgotPasswordPage() {
    const { forgotPasswordMutation, user } = useAuth();
    const [step, setStep] = useState(1);
    const [method, setMethod] = useState<'email' | 'otp'>('email');
    const search = useSearch();
    const initialEmail = new URLSearchParams(search).get('email') || "";
    const [email, setEmail] = useState(initialEmail);
    const [, setLocation] = useLocation();

    useEffect(() => {
        if (user) {
            setLocation("/dashboard");
        }
    }, [user, setLocation]);

    const handleContinue = () => {
        if (step === 1) setStep(2);
    };

    const handleSendOtp = async () => {
        console.log(`[FORGOT-PASSWORD] handleSendOtp called for email: ${email}`);
        try {
            const result = await forgotPasswordMutation.mutateAsync({ email, method: 'otp' });
            console.log(`[FORGOT-PASSWORD] Response from forgotPasswordMutation:`, result);
            setStep(3);
            console.log(`[FORGOT-PASSWORD] Moved to Step 3`);
        } catch (err) {
            console.error(`[FORGOT-PASSWORD] handleSendOtp failed:`, err);
            // Handled by context toast
        }
    };

    const [otp, setOtp] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
    const [isResettingPassword, setIsResettingPassword] = useState(false);

    const handleVerifyOtpAndReset = async () => {
        if (newPassword !== confirmPassword) {
            // Should add a toast here if not handled by context
            return;
        }

        try {
            setIsResettingPassword(true);
            const res = await fetch('/api/reset-password-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp, password: newPassword }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || 'Reset failed');
            }

            setStep(4);
        } catch (err) {
            // Error handled by catch or context
        } finally {
            setIsResettingPassword(false);
        }
    };

    const handleSendLink = async () => {
        try {
            await forgotPasswordMutation.mutateAsync(email);
            setStep(3);
        } catch (err) {
            // Handled by context toast
        }
    };

    return (
        <AuthLayout>
            <div className="mb-6 flex items-center justify-center space-x-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                <span className={step === 1 ? "text-blue-600" : ""}>Step 1</span>
                <ChevronRight className="w-3 h-3" />
                <span className={step === 2 ? "text-blue-600" : ""}>Step 2</span>
                <ChevronRight className="w-3 h-3" />
                <span className={step === 3 ? "text-blue-600" : ""}>Step 3</span>
                {method === 'otp' && (
                    <>
                        <ChevronRight className="w-3 h-3" />
                        <span className={step === 4 ? "text-blue-600" : ""}>Step 4</span>
                    </>
                )}
            </div>

            <AnimatePresence mode="wait">
                {step === 1 && (
                    <motion.div
                        key="step1"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-6"
                    >
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-slate-900 mb-2">Reset Your Password</h2>
                            <p className="text-slate-500 text-sm">Choose how you'd like to recover your account.</p>
                        </div>

                        <div className="space-y-3">
                            <button
                                onClick={() => setMethod('email')}
                                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${method === 'email'
                                    ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                                    : 'border-slate-100 hover:border-slate-200 bg-white'
                                    }`}
                            >
                                <div className="flex items-start">
                                    <div className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3 ${method === 'email' ? 'border-blue-600 bg-blue-600' : 'border-slate-300'
                                        }`}>
                                        {method === 'email' && <div className="w-2 h-2 bg-white rounded-full" />}
                                    </div>
                                    <div>
                                        <h3 className={`font-bold text-sm ${method === 'email' ? 'text-blue-900' : 'text-slate-800'}`}>
                                            Send reset link via Email
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                            We'll send a secure reset link to your registered email.
                                        </p>
                                    </div>
                                </div>
                            </button>

                            <button
                                onClick={() => setMethod('otp')}
                                className={`w-full p-4 rounded-xl border-2 text-left transition-all ${method === 'otp'
                                    ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                                    : 'border-slate-100 hover:border-slate-200 bg-white'
                                    }`}
                            >
                                <div className="flex items-start">
                                    <div className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center mr-3 ${method === 'otp' ? 'border-blue-600 bg-blue-600' : 'border-slate-300'
                                        }`}>
                                        {method === 'otp' && <div className="w-2 h-2 bg-white rounded-full" />}
                                    </div>
                                    <div>
                                        <h3 className={`font-bold text-sm ${method === 'otp' ? 'text-blue-900' : 'text-slate-800'}`}>
                                            Receive OTP via Email
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                            We'll send a one-time verification code to your email.
                                        </p>
                                    </div>
                                </div>
                            </button>
                        </div>

                        <Button
                            onClick={handleContinue}
                            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20"
                        >
                            Continue
                        </Button>
                    </motion.div>
                )}

                {step === 2 && (
                    <motion.div
                        key="step2"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-6"
                    >
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-slate-900 mb-2">Enter your registered email</h2>
                            <p className="text-slate-500 text-sm">
                                {method === 'email' ? "We'll send a password recovery link." : "We'll send a 6-digit verification code."}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 ml-1">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <Input
                                    type="email"
                                    placeholder="name@example.com"
                                    className="pl-10 h-12 border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        <Button
                            onClick={method === 'email' ? handleSendLink : handleSendOtp}
                            disabled={!email || forgotPasswordMutation.isPending}
                            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20"
                        >
                            {forgotPasswordMutation.isPending ? "Sending..." : (method === 'email' ? "Send Reset Link" : "Send OTP")}
                        </Button>
                    </motion.div>
                )}

                {step === 3 && method === 'otp' && (
                    <motion.div
                        key="step3-otp"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-6"
                    >
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-slate-900 mb-2">Verify OTP</h2>
                            <p className="text-slate-500 text-sm px-4">
                                Enter the 6-digit code sent to <span className="font-bold text-slate-800">{email}</span>
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 ml-1">Verification Code</label>
                                <Input
                                    placeholder="000000"
                                    maxLength={6}
                                    className="h-12 border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl text-center text-2xl tracking-[0.5em] font-bold"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 ml-1">New Password</label>
                                <Input
                                    type="password"
                                    placeholder="••••••••"
                                    className="h-12 border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 ml-1">Confirm New Password</label>
                                <Input
                                    type="password"
                                    placeholder="••••••••"
                                    className="h-12 border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <Button
                            onClick={handleVerifyOtpAndReset}
                            disabled={!otp || !newPassword || newPassword !== confirmPassword || isResettingPassword}
                            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20"
                        >
                            {isResettingPassword ? "Resetting..." : "Verify & Reset Password"}
                        </Button>
                    </motion.div>
                )}

                {step === 3 && method === 'email' && (
                    <motion.div
                        key="step3-email"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="text-center space-y-6"
                    >
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 className="w-10 h-10 text-green-600" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 mb-2">Reset link sent!</h2>
                            <p className="text-slate-500 text-sm leading-relaxed px-4">
                                We've sent a password reset link to <span className="font-bold text-slate-800">{email}</span>. Please check your inbox and follow the instructions.
                            </p>
                        </div>

                        <Link href="/auth/login">
                            <Button className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20">
                                Back to Sign In
                            </Button>
                        </Link>
                    </motion.div>
                )}

                {step === 4 && method === 'otp' && (
                    <motion.div
                        key="step4-otp"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="text-center space-y-6"
                    >
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 className="w-10 h-10 text-green-600" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 mb-2">Password Reset Successful!</h2>
                            <p className="text-slate-500 text-sm leading-relaxed px-4">
                                Your password has been successfully updated. You can now use your new password to sign in.
                            </p>
                        </div>

                        <Link href="/auth/login">
                            <Button className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20">
                                Back to Sign In
                            </Button>
                        </Link>
                    </motion.div>
                )}
            </AnimatePresence>

            {(step === 1 || step === 2) && (
                <div className="mt-8 text-center">
                    <Link href="/auth/login">
                        <span className="inline-flex items-center text-sm font-semibold text-slate-500 hover:text-blue-600 cursor-pointer transition-colors">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Sign In
                        </span>
                    </Link>
                </div>
            )}
        </AuthLayout>
    );
}
