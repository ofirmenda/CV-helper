import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from './store/useAppStore.js';
import TopBar from './components/layout/TopBar.jsx';
import ModeSwitcher from './components/layout/ModeSwitcher.jsx';
import FlowStepper from './components/layout/FlowStepper.jsx';
import MirrorView from './components/mirror/MirrorView.jsx';
import SectionReviewWizard from './components/rewrite/SectionReviewWizard.jsx';
import ATSReportView from './components/improve/ATSReportView.jsx';
import BaseCVEditor from './components/editor/BaseCVEditor.jsx';
import PDFPreviewModal from './components/export/PDFPreviewModal.jsx';
import TemplatePicker from './components/export/TemplatePicker.jsx';
import WelcomeFlow from './components/onboarding/WelcomeFlow.jsx';
import AuthGate from './components/auth/AuthGate.jsx';
import SettingsModal from './components/auth/SettingsModal.jsx';

export default function App() {
  return (
    <AuthGate>
      <AppShell />
    </AuthGate>
  );
}

function AppShell() {
  const mode = useAppStore((s) => s.mode);
  const template = useAppStore((s) => s.template);
  const setTemplate = useAppStore((s) => s.setTemplate);
  const onboardedAt = useAppStore((s) => s.onboardedAt);
  const [editorOpen, setEditorOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // First-run welcome flow handles template-picking + upload on its own;
  // skip the legacy auto-open template picker when onboarding is unfinished.
  useEffect(() => {
    if (!template && onboardedAt) {
      const t = setTimeout(() => setPickerOpen(true), 400);
      return () => clearTimeout(t);
    }
  }, [template, onboardedAt]);

  function handlePickTemplate(id) {
    setTemplate(id);
    setPickerOpen(false);
    // After picking a template, take the user straight to the next step: their CV.
    setTimeout(() => setEditorOpen(true), 200);
  }

  const showWelcome = !onboardedAt;

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar onOpenSettings={() => setSettingsOpen(true)} />
      <FlowStepper
        template={template}
        onPickTemplate={() => setPickerOpen(true)}
        onOpenEditor={() => setEditorOpen(true)}
        onOpenExport={() => setExportOpen(true)}
      />
      <ModeSwitcher />

      <main className="flex-1 px-6 pb-10">
        <AnimatePresence mode="wait">
          {mode === 'mirror' && (
            <motion.div
              key="mirror"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <MirrorView />
            </motion.div>
          )}
          {mode === 'rewrite' && (
            <motion.div
              key="rewrite"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <SectionReviewWizard onExport={() => setExportOpen(true)} />
            </motion.div>
          )}
          {mode === 'improve' && (
            <motion.div
              key="improve"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <ATSReportView />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {editorOpen && <BaseCVEditor onClose={() => setEditorOpen(false)} />}
      {exportOpen && <PDFPreviewModal onClose={() => setExportOpen(false)} />}
      {pickerOpen && !showWelcome && (
        <TemplatePicker
          value={template}
          onChange={handlePickTemplate}
          onClose={() => setPickerOpen(false)}
        />
      )}
      {showWelcome && <WelcomeFlow onDone={() => { /* localStorage flips, re-render naturally */ }} />}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
