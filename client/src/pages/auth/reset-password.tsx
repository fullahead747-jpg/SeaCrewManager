import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import AuthLayout from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { CheckCircle2, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ResetPasswordPage() {
    const { resetPasswordMutation, user } = useAuth();
    const [location, setLocation] = useLocation();
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [step, setStep] = useState(1);

    useEffect(() => {
        if (user) {
            setLocation("/dashboard");
        }
    }, [user, setLocation]);

    // Get token from URL
    const queryParams = new URLSearchParams(window.location.search);
    const token = queryParams.get("token");

    const handleReset = async () => {
        if (password !== confirmPassword) return;
        try {
            await resetPasswordMutation.mutateAsync({ token, password });
            setStep(2);
        } catch (err) {
            // Handled by context
        }
    };

    return (
        <AuthLayout>
            <AnimatePresence mode="wait">
                {step === 1 && (
                    <motion.div
                        key="step1"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="space-y-6"
                    >
                        <div className="text-center">
                            <h2 className="text-2xl font-bold text-slate-900 mb-2">Set Your New Password</h2>
                            <p className="text-slate-500 text-sm">Please choose a strong password you can remember.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 ml-1">New Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <Input
                                        type="password"
                                        placeholder="••••••••"
                                        className="pl-10 h-12 border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-700 ml-1">Confirm Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <Input
                                        type="password"
                                        placeholder="••••••••"
                                        className="pl-10 h-12 border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {password && confirmPassword && password !== confirmPassword && (
                            <p className="text-xs text-red-500 font-medium ml-1">Passwords do not match</p>
                        )}

                        <Button
                            onClick={handleReset}
                            disabled={!password || password !== confirmPassword || resetPasswordMutation.isPending || !token}
                            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20"
                        >
                            {resetPasswordMutation.isPending ? "Updating..." : "Reset Password"}
                        </Button>
                    </motion.div>
                )}

                {step === 2 && (
                    <motion.div
                        key="step2"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center space-y-6"
                    >
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 className="w-10 h-10 text-green-600" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 mb-2">Password Updated!</h2>
                            <p className="text-slate-500 text-sm leading-relaxed px-4">
                                Your password has been changed successfully. You can now use your new password to sign in.
                            </p>
                        </div>

                        <Link href="/auth/login">
                            <Button className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20">
                                Sign In
                            </Button>
                        </Link>
                    </motion.div>
                )}
            </AnimatePresence>
        </AuthLayout>
    );
}
