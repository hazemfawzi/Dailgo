import { useRef, useState } from 'react';
import type { Entry, Translate } from '../../lib/workspace';
export function MemoryFields({
  draft,
  onChange,
  t,
}: {
  draft: Entry;
  onChange: (entry: Entry) => void;
  t: Translate;
}) {
  const [error, setError] = useState('');
  const latest = useRef(draft);
  latest.current = draft;
  return (
    <fieldset className="memory-fields">
      <legend>{t('ui.organizationAndLocalFiles.3efca0')}</legend>
      <label>
        {t('ui.tagsCommaSeparated.6f4d9a')}
        <input
          dir="auto"
          maxLength={300}
          value={(draft.tags ?? []).join(',')}
          onChange={(e) =>
            onChange({
              ...draft,
              tags: e.target.value
                .split(/[,،]/)
                .map((x) => x.trim())
                .slice(0, 20),
            })
          }
        />
      </label>
      <label>
        {t('ui.referenceLinksOnePerLineHttpHttps.2923bf')}
        <textarea
          dir="auto"
          rows={3}
          value={(draft.links ?? []).join('\n')}
          maxLength={5000}
          onChange={(e) => onChange({ ...draft, links: e.target.value.split('\n').slice(0, 10) })}
        />
      </label>
      <label>
        {t('ui.attachLocalFilesUpTo3200.d65d68')}
        <input
          type="file"
          accept="image/png,image/jpeg,application/pdf,text/plain"
          onChange={async (e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            setError('');
            if (
              (draft.attachments?.length ?? 0) + files.length > 3 ||
              files.some(
                (f) =>
                  f.size > 200000 ||
                  !['image/png', 'image/jpeg', 'application/pdf', 'text/plain'].includes(f.type),
              )
            ) {
              setError(t('ui.chooseUpTo3PngJpegPdf.2a5c8e'));
              return;
            }
            try {
              const added = await Promise.all(
                files.map(
                  (file) =>
                    new Promise<{ name: string; data: string; mime: string }>((resolve, reject) => {
                      const reader = new FileReader();
                      reader.onload = () =>
                        resolve({ name: file.name, mime: file.type, data: String(reader.result) });
                      reader.onerror = reject;
                      reader.readAsDataURL(file);
                    }),
                ),
              );
              onChange({
                ...latest.current,
                attachments: [...(latest.current.attachments ?? []), ...added],
              });
            } catch {
              setError(t('ui.couldNotReadFile.eea00f'));
            }
          }}
        />
      </label>
      <p dir="auto" className="muted">
        {t('ui.filesStayLocalAndAreIncludedIn.7a2261')}
      </p>
      {draft.attachments?.map((file, i) => (
        <div className="attachment-row" key={i}>
          <a href={file.data} download={file.name}>
            {file.name}
          </a>
          <button
            type="button"
            onClick={() =>
              onChange({
                ...draft,
                attachments: draft.attachments?.filter((_, index) => index !== i),
              })
            }
          >
            {t('ui.removeFromDraft.7d0fa0')}
          </button>
        </div>
      ))}
      {error && (
        <p dir="auto" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
