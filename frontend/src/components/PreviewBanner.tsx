export function PreviewBanner() {
  if (import.meta.env.VITE_MOCK !== 'true') return null;
  return (
    <div className="bg-accent text-white text-center text-xs font-medium py-1.5 px-4 sticky top-0 z-[200]">
      🔍 UI Preview Mode — all data is simulated (no real backend, email, or AI calls). Signup OTP is always <strong>123456</strong>.
    </div>
  );
}
