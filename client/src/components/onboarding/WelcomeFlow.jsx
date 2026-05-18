import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore.js';
import TemplatePicker from '../export/TemplatePicker.jsx';
import BaseCVEditor from '../editor/BaseCVEditor.jsx';

// 3-step first-run onboarding. Triggered by App.jsx when localStorage doesn't
// have `cvmirror.onboardedAt`. Walks the user through:
//   1) Choose a template
//   2) Upload your CV
//   3) Done — go to mirror
//
// Each step is dismissable; finishing step 3 (or clicking 'Skip setup') sets
// the localStorage flag so it never reappears.

export default function WelcomeFlow({ onDone }) {
  const template = useAppStore((s) => s.template);
  const setTemplate = useAppStore((s) => s.setTemplate);
  const cv = useAppStore((s) => s.cv);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  // Steps:
  //   'intro'    → welcome card
  //   'template' → embedded TemplatePicker
  //   'cv'       → embedded BaseCVEditor (already auto-opens to upload card)
  //   'ready'    → final "you're set" card
  const [step, setStep] = useState('intro');

  function finish() {
    completeOnboarding();
    onDone?.();
  }

  if (step === 'template') {
    // TemplatePicker fires onChange immediately followed by onClose when a tile
    // is clicked, so we must NOT rewind to 'intro' inside onClose — that would
    // override the 'cv' step the onChange handler just set. Advance to 'cv' in
    // both handlers and (if the user just closed without picking) we'll still
    // land on the upload step. They can pick a template later from the stepper.
    return (
      <TemplatePicker
        value={template}
        onChange={(t) => {
          setTemplate(t);
          setStep('cv');
        }}
        onClose={() => setStep('cv')}
      />
    );
  }

  if (step === 'cv') {
    return (
      <BaseCVEditor onClose={() => setStep('ready')} />
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink-950/45 backdrop-blur-sm grid place-items-center p-6">
      <div className="card w-full max-w-xl p-8 text-center">
        {step === 'intro' && (
          <>
            <div className="text-[10px] uppercase tracking-[0.22em] text-ink-400 mb-2 font-semibold">
              Welcome
            </div>
            <h2 className="font-display text-3xl font-bold tracking-tight text-ink-950 mb-3">
              Let's set up your CV.
            </h2>
            <p className="text-sm text-ink-500 max-w-md mx-auto leading-relaxed mb-6">
              Two quick steps and you're done. Choose how your exported PDF should look, then upload
              your existing CV — we'll extract the data so you don't have to retype anything.
            </p>
            <div className="flex items-center gap-3 justify-center">
              <button className="btn-primary" onClick={() => setStep('template')}>
                Choose a template →
              </button>
              <button
                className="text-xs text-ink-400 hover:text-ink-950 underline-offset-2 hover:underline"
                onClick={finish}
              >
                Skip setup
              </button>
            </div>
          </>
        )}

        {step === 'ready' && (
          <>
            <div className="text-[10px] uppercase tracking-[0.22em] text-emerald-600 mb-2 font-semibold">
              You're set
            </div>
            <h2 className="font-display text-3xl font-bold tracking-tight text-ink-950 mb-3">
              Hi {cv?.personalInfo?.name?.split(/\s+/)?.[0] || 'there'}.
            </h2>
            <p className="text-sm text-ink-500 max-w-md mx-auto leading-relaxed mb-6">
              Your CV is saved locally. Whenever you find a new job, paste the description in the
              <span className="font-semibold text-ink-950"> Job description </span>
              panel and hit
              <span className="font-semibold text-ink-950"> Fit to this job description</span>.
              We'll handle the rest.
            </p>
            <button className="btn-primary" onClick={finish}>
              Go to mirror →
            </button>
          </>
        )}
      </div>
    </div>
  );
}
