import { Check } from 'lucide-react';

export default function ImageGallery({ files, onSelect }) {
  const images = files.filter((file) => /\.(jpe?g|png|webp)$/i.test(file.file_name));
  if (!images.length) return <p className="muted">暂无图片。</p>;
  return (
    <div className="image-grid">
      {images.map((file) => (
        <article className="image-card" key={file.id}>
          <img src={file.url} alt={file.file_name} />
          <div>
            <span title={file.file_name}>{file.file_name}</span>
            <button className="icon-button" title="设为最终图" onClick={() => onSelect(file.id)}>
              <Check size={16} />
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

