import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/contexts/auth-context";
import { Link, useLocation } from "wouter";
import AuthLayout from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect } from "react";
import { Mail, Lock } from "lucide-react";

const loginSchema = z.object({
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    rememberMe: z.boolean().default(false),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
    const { loginMutation, user } = useAuth();
    const [, setLocation] = useLocation();
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (user) {
            setLocation("/dashboard");
        }
    }, [user, setLocation]);

    const form = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            email: "",
            password: "",
            rememberMe: false,
        },
    });

    async function onSubmit(data: LoginFormValues) {
        try {
            const result = await loginMutation.mutateAsync({
                username: data.email,
                password: data.password,
            });
            if (result) {
                setLocation("/dashboard");
            }
        } catch (error) {
            // Error is already handled by the mutation's onError (toast)
            // We catch it here to prevent the unhandled promise rejection overlay
            console.error("Login failed:", error);
        }
    }

    return (
        <AuthLayout>
            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-slate-900 mb-2">Sign In to Your Account</h2>
                <p className="text-slate-500">Welcome back! Please enter your details.</p>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-slate-700 font-semibold">Email</FormLabel>
                                <FormControl>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                        <Input
                                            placeholder="Enter your email"
                                            className="pl-10 h-12 border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                                            {...field}
                                        />
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                            <FormItem>
                                <div className="flex items-center justify-between">
                                    <FormLabel className="text-slate-700 font-semibold">Password</FormLabel>
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="text-sm font-medium text-slate-500 hover:text-blue-600 focus:outline-none transition-colors"
                                    >
                                        {showPassword ? "Hide" : "Show"}
                                    </button>
                                </div>
                                <FormControl>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                        <Input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="••••••••••••"
                                            className="pl-10 pr-10 h-12 border-slate-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                                            {...field}
                                        />
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <Checkbox id="remember" className="rounded-md border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600" />
                            <label
                                htmlFor="remember"
                                className="text-sm font-medium text-slate-600 cursor-pointer select-none"
                            >
                                Remember me
                            </label>
                        </div>
                        <Link href={`/auth/forgot-password?email=${encodeURIComponent(form.watch("email") || "")}`}>
                            <span className="text-sm font-semibold text-blue-600 hover:text-blue-700 cursor-pointer transition-colors">
                                Forgot password?
                            </span>
                        </Link>
                    </div>

                    <Button
                        type="submit"
                        className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]"
                        disabled={loginMutation.isPending}
                    >
                        {loginMutation.isPending ? "Signing in..." : "Sign In"}
                    </Button>
                </form>
            </Form>

            <div className="mt-8 text-center">
                <p className="text-slate-600 text-sm">
                    Don't have an account?{" "}
                    <Link href="/auth/register">
                        <span className="font-bold text-blue-600 hover:text-blue-700 cursor-pointer transition-colors">
                            Register
                        </span>
                    </Link>
                </p>
            </div>
        </AuthLayout>
    );
}
