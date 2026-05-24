import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ApiError } from '../lib/api';
import { Logo } from '../components/Logo';

type Step = 'phone' | 'otp';

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state: authState, requestOtp, verifyOtp } = useAuth();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notRegistered, setNotRegistered] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (authState.status === 'authenticated') {
      const redirect = new URLSearchParams(location.search).get('next') || '/';
      navigate(redirect, { replace: true });
    }
  }, [authState.status, location.search, navigate]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  async function sendOtp(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setNotRegistered(false);
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError('Enter a valid 10-digit Indian mobile number.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await requestOtp(phone);
      setDevOtp(res.dev_otp ?? null);
      setStep('otp');
      setResendIn(30);
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
    } catch (err) {
      if (err instanceof ApiError && err.data?.not_registered) {
        setNotRegistered(true);
        setError(null);
      } else {
        setError(err instanceof ApiError ? err.message : 'Could not send OTP. Try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function verify(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    const code = otp.join('');
    if (code.length !== 6) {
      setError('Enter the 6-digit OTP.');
      return;
    }
    setSubmitting(true);
    try {
      await verifyOtp(phone, code);
      // navigate handled by the effect once auth state flips
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Verification failed.');
    } finally {
      setSubmitting(false);
    }
  }

  function setOtpDigit(idx: number, val: string) {
    const digit = val.replace(/\D/g, '').slice(-1);
    setOtp((prev) => {
      const next = [...prev];
      next[idx] = digit;
      return next;
    });
    if (digit && idx < 5) otpRefs.current[idx + 1]?.focus();
  }

  function onOtpKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  }

  function onOtpPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < text.length; i++) next[i] = text[i];
    setOtp(next);
    const focusIdx = Math.min(text.length, 5);
    otpRefs.current[focusIdx]?.focus();
  }

  return (
    <div className="min-h-screen flex">
      {/* Brand side (hidden on small screens) */}
      <aside className="hidden lg:flex lg:w-5/12 bg-federation-900 text-white p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="relative">
          <Logo size={160} onDark />
        </div>
        <div className="relative">
          <div className="text-saffron-400 text-xs uppercase tracking-[0.3em] font-semibold mb-3">Member portal</div>
          <h1 className="text-5xl font-bold leading-[1.05] tracking-tight">
            One federation. <br />
            <span className="text-azure-300">Every society.</span>
          </h1>
          <p className="mt-5 text-ink-300 max-w-md text-base">
            Sign in with your registered mobile number. Register your society, track federation
            initiatives, VENT grievances. Be part of the community and impact the change.
          </p>
        </div>
        <div className="relative text-xs text-ink-400">
          © {new Date().getFullYear()} Pimpri Chinchwad Co-Operative Housing Society Federation
        </div>
      </aside>

      {/* Login side */}
      <main className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-ink-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex justify-center">
            <Logo size={96} />
          </div>

          <div className="card p-7 sm:p-8">
            {step === 'phone' && (
              <>
                {new URLSearchParams(location.search).get('registered') === '1' && (
                  <div className="mb-5 rounded-lg border border-azure-200 bg-azure-50 px-3 py-2 text-sm text-azure-700">
                    <strong>Society registered.</strong> Once your details are verified, sign in
                    with the contact mobile number to access the federation portal.
                  </div>
                )}
                <h2 className="text-2xl font-bold text-ink-900">Sign in</h2>
                <p className="mt-1.5 text-sm text-ink-500">
                  We'll send a 6-digit OTP to your mobile number.
                </p>

                <form onSubmit={sendOtp} className="mt-7 space-y-4">
                  <div>
                    <label className="label">Mobile number</label>
                    <div className="flex">
                      <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-ink-200 bg-ink-50 text-ink-600 text-sm font-medium">
                        +91
                      </span>
                      <input
                        autoFocus
                        type="tel"
                        inputMode="numeric"
                        pattern="[6-9][0-9]{9}"
                        maxLength={10}
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                          if (notRegistered) setNotRegistered(false);
                          if (error) setError(null);
                        }}
                        placeholder="98765 43210"
                        className="input rounded-l-none text-base tracking-wide"
                        required
                      />
                    </div>
                    {error && <p className="mt-2 text-xs text-saffron-700">{error}</p>}
                  </div>

                  {notRegistered && (
                    <p className="text-sm text-ink-500">
                      Mobile number does not exist. Please register your society first.
                    </p>
                  )}

                  <div className="flex gap-3">
                    <button type="submit" disabled={submitting} className="btn-primary flex-1">
                      {submitting ? 'Sending…' : 'Send OTP'}
                    </button>
                    <Link to="/register/society" className="btn-accent flex-1 whitespace-nowrap">
                      Register your society
                    </Link>
                  </div>
                </form>

                <p className="mt-6 text-xs text-ink-500 text-center">
                  Society not yet registered? Use the orange button to register it first, then come
                  back to sign in.
                </p>

                <div className="mt-5 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2.5 text-xs text-ink-600">
                  <div className="font-semibold text-ink-800 mb-1">Demo personas</div>
                  <div><span className="font-mono">9876543210</span> — Admin (Anil, Shree Sai contact)</div>
                  <div><span className="font-mono">9988776655</span> — Member (Priya, resident)</div>
                </div>
              </>
            )}

            {step === 'otp' && (
              <>
                <button
                  type="button"
                  onClick={() => { setStep('phone'); setError(null); setDevOtp(null); }}
                  className="text-xs text-ink-500 hover:text-ink-800 inline-flex items-center gap-1"
                >
                  ← Change number
                </button>
                <h2 className="mt-3 text-2xl font-bold text-ink-900">Enter OTP</h2>
                <p className="mt-1.5 text-sm text-ink-500">
                  Sent to <span className="font-medium text-ink-800">+91 {phone.slice(0, 5)} {phone.slice(5)}</span>
                </p>

                {devOtp && (
                  <div className="mt-4 rounded-lg border border-azure-200 bg-azure-50 px-3 py-2 text-xs text-azure-800">
                    <span className="font-semibold">Dev mode:</span> your OTP is{' '}
                    <span className="font-mono font-bold tracking-wider">{devOtp}</span>{' '}
                    <button
                      type="button"
                      onClick={() => {
                        const next = devOtp.split('');
                        setOtp([next[0] ?? '', next[1] ?? '', next[2] ?? '', next[3] ?? '', next[4] ?? '', next[5] ?? '']);
                        setTimeout(() => otpRefs.current[5]?.focus(), 0);
                      }}
                      className="ml-2 underline font-medium"
                    >Autofill</button>
                  </div>
                )}

                <form onSubmit={verify} className="mt-6">
                  <div className="flex justify-between gap-2" onPaste={onOtpPaste}>
                    {otp.map((d, i) => (
                      <input
                        key={i}
                        ref={(el) => { otpRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={d}
                        onChange={(e) => setOtpDigit(i, e.target.value)}
                        onKeyDown={(e) => onOtpKeyDown(i, e)}
                        className="w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-semibold rounded-lg border border-ink-200 bg-white text-ink-900 focus:border-ink-500 focus:outline-none focus:ring-2 focus:ring-ink-200"
                      />
                    ))}
                  </div>

                  {error && <p className="mt-3 text-xs text-saffron-700">{error}</p>}

                  <button type="submit" disabled={submitting} className="btn-primary w-full mt-6">
                    {submitting ? 'Verifying…' : 'Verify & sign in'}
                  </button>
                </form>

                <div className="mt-5 text-center text-xs text-ink-500">
                  Didn't get the code?{' '}
                  {resendIn > 0 ? (
                    <span>Resend in {resendIn}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => sendOtp()}
                      disabled={submitting}
                      className="text-azure-700 font-semibold hover:underline disabled:opacity-50"
                    >
                      Resend OTP
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
