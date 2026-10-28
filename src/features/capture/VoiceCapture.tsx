import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import { Button } from '../../components/ui/button';
import type { Translate } from '../../lib/workspace';
export function VoiceCapture({ t, onText }: { t: Translate; onText: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState('');
  const active = useRef<any>(null);
  const Recognition = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
  useEffect(
    () => () => {
      active.current?.abort();
      active.current = null;
    },
    [],
  );
  function start() {
    if (active.current) {
      active.current.stop();
      return;
    }
    if (!Recognition) return;
    const recognition = new Recognition();
    recognition.lang = t('ui.enGb.57ec80');
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    active.current = recognition;
    setNotice('');
    recognition.onresult = (event: any) => {
      const text = Array.from(event.results as any[])
        .map((item: any) => item[0]?.transcript ?? '')
        .join(' ')
        .trim();
      if (text) onText(text);
      setNotice(t('ui.reviewTheTranscriptBeforeSavingOrSending.9fb201'));
    };
    recognition.onend = () => {
      active.current = null;
      setListening(false);
    };
    recognition.onerror = () => {
      setNotice(t('ui.voiceCaptureWasUnavailableOrPermissionWas.3b072f'));
      active.current = null;
      setListening(false);
    };
    try {
      recognition.start();
      setListening(true);
    } catch {
      active.current = null;
      setListening(false);
      setNotice(t('ui.couldNotStartVoiceCapture.84b223'));
    }
  }
  return (
    <section className="voice-capture">
      <Button
        type="button"
        variant="outline"
        disabled={!Recognition}
        aria-pressed={listening}
        onClick={start}
      >
        {listening ? <Square size={16} /> : <Mic size={16} />}{' '}
        {listening ? t('ui.stopVoiceInput.1a3aa0') : t('ui.dictateATaskOrNote.666c98')}
      </Button>
      <p dir="auto" className="muted">
        {Recognition
          ? t('ui.yourBrowserSSpeechServiceProcessesThe.a55280')
          : t('ui.speechRecognitionIsNotSupportedByThis.01d976')}
      </p>
      {notice && (
        <p dir="auto" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
