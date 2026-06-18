import React, { useState } from "react";
import { FaArrowLeft, FaCheckCircle, FaEnvelope, FaLock, FaSignInAlt, FaSpinner, FaUserPlus } from "react-icons/fa";
import { supabase } from "../lib/supabase";

interface LoginProps {
  onLoginSuccess?: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showVerificationSent, setShowVerificationSent] = useState(false);

  const handleEmailAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.user && !data.session) setShowVerificationSent(true);
        else onLoginSuccess?.();
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onLoginSuccess?.();
      }
    } catch (error: any) {
      setErrorMsg(error.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (error: any) {
      setErrorMsg(error.message || "Google sign-in failed");
    }
  };

  if (showVerificationSent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white p-4">
        <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-800 p-8 text-center text-gray-100 shadow-2xl">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-green-700 bg-green-900/50">
            <FaCheckCircle className="h-8 w-8 text-green-400" />
          </div>
          <h2 className="mb-2 text-2xl font-bold text-white">Check your inbox</h2>
          <p className="mb-6 text-gray-400">
            We sent a verification link to <span className="font-medium text-blue-400">{email}</span>.
            <br />
            Please click the link to activate your account.
          </p>
          <button
            onClick={() => {
              setShowVerificationSent(false);
              setIsSignUp(false);
            }}
            className="mx-auto flex items-center justify-center gap-2 text-gray-400 transition-colors hover:text-white"
          >
            <FaArrowLeft className="h-4 w-4" /> Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white p-4">
      <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-800 p-8 text-gray-100 shadow-2xl">
        <div className="mb-8 text-center">
          <h1 className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-3xl font-bold text-transparent">
            {isSignUp ? "Create Account" : "WireUIframe"}
          </h1>
          <p className="mt-2 text-gray-400">
            {isSignUp ? "Sign up to start building" : "Login to access your projects"}
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded border border-red-700 bg-red-900/50 p-3 text-center text-sm text-red-200">
            {errorMsg}
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          type="button"
          className="mb-6 flex w-full items-center justify-center gap-3 rounded-lg bg-white px-4 py-3 font-semibold text-gray-900 shadow transition-all hover:bg-gray-100"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Sign in with Google
        </button>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-600" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-gray-800 px-2 text-gray-400">Or continue with email</span>
          </div>
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-400">Email</label>
            <div className="relative">
              <FaEnvelope className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 py-3 pl-10 pr-4 text-white placeholder-gray-600 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-blue-500"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-400">Password</label>
            <div className="relative">
              <FaLock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 py-3 pl-10 pr-4 text-white placeholder-gray-600 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-blue-500"
                placeholder="********"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 font-semibold text-white shadow-lg transition-all hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <FaSpinner className="h-5 w-5 animate-spin" />
            ) : isSignUp ? (
              <>
                <FaUserPlus className="h-5 w-5" /> Sign Up
              </>
            ) : (
              <>
                <FaSignInAlt className="h-5 w-5" /> Login
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-400">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrorMsg(null);
                setShowVerificationSent(false);
              }}
              className="font-medium text-blue-400 transition-colors hover:text-blue-300"
            >
              {isSignUp ? "Login" : "Sign Up"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
