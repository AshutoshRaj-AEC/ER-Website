import { useEffect, useState } from "react";

export const fieldClass =
  "w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-stone-100 placeholder:text-stone-500 focus:border-orange-300 focus:outline-none disabled:opacity-60";

// Keeps a local draft and saves when the field loses focus, if it changed
// and is valid.
const useDraft = (value, onSave) => {
  const [draft, setDraft] = useState(String(value ?? ""));

  useEffect(() => {
    setDraft(String(value ?? ""));
  }, [value]);

  return {
    value: draft,
    onChange: (event) => setDraft(event.target.value),
    onBlur: (event) => {
      if (event.target.checkValidity() && draft !== String(value ?? "")) {
        onSave(draft);
      }
    },
  };
};

// `bare` drops the standard field styling so the caller can style it fully.
export const AutoSaveInput = ({ value, onSave, className = "", bare = false, ...props }) => {
  const draftProps = useDraft(value, onSave);
  return (
    <input {...props} {...draftProps} className={bare ? className : `${fieldClass} ${className}`} />
  );
};

export const AutoSaveTextarea = ({ value, onSave, className = "", ...props }) => {
  const draftProps = useDraft(value, onSave);
  return <textarea {...props} {...draftProps} className={`${fieldClass} ${className}`} />;
};
