import { useState, useMemo, useRef, type FormEvent } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/contexts/auth";
import { Archive, Lock, User, Eye, EyeOff, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function generatePuzzle() {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  const ops = ["+", "-", "+", "+", "-"] as const;
  const op = ops[Math.floor(Math.random() * ops.length)];
  const answer = op === "+" ? a + b : a - b;
  return { question: `What is ${a} ${op} ${b}?`, answer };
}

export default function LoginPage() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const redirectTo = new URLSearchParams(search).get("redirect") ?? "/dashboard";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [puzzle, setPuzzle] = useState(() => generatePuzzle());
  const [captchaInput, setCaptchaInput] = useState("");
  const [captchaError, setCaptchaError] = useState(false);

  const honeypotRef = useRef<HTMLInputElement>(null);

  const captchaValid = useMemo(
    () => parseInt(captchaInput.trim(), 10) === puzzle.answer,
    [captchaInput, puzzle.answer]
  );

  function refreshPuzzle() {
    setPuzzle(generatePuzzle());
    setCaptchaInput("");
    setCaptchaError(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!captchaValid) {
      setCaptchaError(true);
      return;
    }
    setCaptchaError(false);
    setError(null);
    setLoading(true);
    try {
      const honeypotValue = honeypotRef.current?.value ?? "";
      await login(username.trim(), password, honeypotValue);
      setLocation(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      refreshPuzzle();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-500 shadow-lg mb-4">
            <Archive className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Arciflow</h1>
          <p className="text-slate-500 text-sm mt-1">Sign in to the admin panel</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-5">
          {error && (
            <div className="flex items-center gap-2.5 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Honeypot — visually off-screen; real users never see or fill this */}
            <div
              aria-hidden="true"
              style={{ position: "absolute", left: "-9999px", top: "-9999px", width: "1px", height: "1px", overflow: "hidden", opacity: 0 }}
            >
              <label htmlFor="website">Website</label>
              <input
                ref={honeypotRef}
                id="website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                defaultValue=""
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-sm font-medium">
                Username
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  placeholder="admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-9"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Math CAPTCHA */}
            <div className="space-y-1.5">
              <Label htmlFor="captcha" className="text-sm font-medium">
                Security check
              </Label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-sm font-mono font-semibold text-slate-700 flex-1">
                  {puzzle.question}
                </span>
                <button
                  type="button"
                  onClick={refreshPuzzle}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label="New question"
                  tabIndex={-1}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
              <Input
                id="captcha"
                type="number"
                placeholder="Enter your answer"
                value={captchaInput}
                onChange={(e) => { setCaptchaInput(e.target.value); setCaptchaError(false); }}
                className={captchaError ? "border-red-400 focus-visible:ring-red-400" : ""}
                required
              />
              {captchaError && (
                <p className="text-xs text-red-600">Incorrect answer — please try again</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold"
              disabled={loading || !username || !password || !captchaInput}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Signing in…
                </span>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>
        </div>

      </div>
    </div>
  );
}
