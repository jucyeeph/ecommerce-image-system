import { Upload } from 'lucide-react';

export default function FileUploader({ accept, multiple, label, onUpload }) {
  return (
    <label className="uploader">
      <Upload size={18} />
      <span>{label}</span>
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(event) => {
          const files = event.target.files;
          if (files?.length) onUpload(files);
          event.target.value = '';
        }}
      />
    </label>
  );
}

