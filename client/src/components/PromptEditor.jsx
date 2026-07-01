import { Clipboard, RotateCcw, Save } from 'lucide-react';

export default function PromptEditor({ content, setContent, onSave, onReset }) {
  return (
    <section className="panel prompt-panel">
      <div className="panel-header">
        <h2>提示词</h2>
        <div className="button-row">
          <button className="icon-text-button" onClick={() => navigator.clipboard.writeText(content)} title="复制提示词">
            <Clipboard size={16} /> 复制
          </button>
          <button className="icon-text-button" onClick={onReset} title="重置为默认模板">
            <RotateCcw size={16} /> 重置
          </button>
          <button className="primary-button" onClick={onSave}>
            <Save size={16} /> 保存
          </button>
        </div>
      </div>
      <textarea value={content} onChange={(event) => setContent(event.target.value)} />
    </section>
  );
}

