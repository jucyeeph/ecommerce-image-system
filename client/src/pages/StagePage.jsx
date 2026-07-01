import { useEffect, useState } from 'react';
import { CheckCircle2, RotateCcw } from 'lucide-react';
import { api } from '../api.js';
import FileUploader from '../components/FileUploader.jsx';
import ImageGallery from '../components/ImageGallery.jsx';
import PromptEditor from '../components/PromptEditor.jsx';
import StageStatusBadge from '../components/StageStatusBadge.jsx';

const GOALS = {
  hermes_collection: '复制 Hermes 采集提示词，上传 Hermes 返回的 zip，并解析产品资料。',
  product_cutout_material: '整理产品原图和产品介绍，生成并选择最终白底素材。',
  main_image: '基于产品资料、白底素材和品牌资料生成主图，并确认最终主图。'
};

const ACTION_LABELS = {
  hermes_collection: {
    approve: '标记采集完成',
    revision: '标记资料需修正',
    approveMessage: 'Hermes 采集已标记完成。',
    revisionMessage: 'Hermes 资料已标记为需修正。'
  },
  product_cutout_material: {
    approve: '标记通过',
    revision: '标记返工',
    approveMessage: '阶段已标记通过。',
    revisionMessage: '阶段已标记返工。'
  },
  main_image: {
    approve: '标记通过',
    revision: '标记返工',
    approveMessage: '阶段已标记通过。',
    revisionMessage: '阶段已标记返工。'
  }
};

export default function StagePage({ id, stageKey, navigate }) {
  const [data, setData] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [files, setFiles] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, [id, stageKey]);

  async function load() {
    try {
      const [stageData, promptData, fileData] = await Promise.all([
        api.stage(id, stageKey),
        api.prompt(id, stageKey),
        api.files(id)
      ]);
      setData(stageData);
      setPrompt(promptData.content);
      setFiles(fileData.filter((file) => file.stage_key === stageKey));
    } catch (err) {
      setError(err.message);
    }
  }

  async function savePrompt() {
    await api.savePrompt(id, stageKey, prompt);
    setMessage('提示词已保存。');
  }

  async function resetPrompt() {
    const result = await api.resetPrompt(id, stageKey);
    setPrompt(result.content);
    setMessage('提示词已重置。');
  }

  async function upload(filesToUpload) {
    if (stageKey === 'hermes_collection') {
      setMessage('正在上传并解析 Hermes zip...');
      const result = await api.uploadHermes(id, filesToUpload[0]);
      setMessage(result.warnings?.length ? result.warnings.join('；') : 'Hermes zip 已解析。');
      await load();
      return;
    }
    await api.uploadStage(id, stageKey, filesToUpload);
    setMessage('图片已上传。');
    await load();
  }

  async function selectFinal(fileId) {
    await api.selectFinal(id, stageKey, fileId);
    setMessage('最终图片已保存。');
    await load();
  }

  async function mark(action) {
    if (action === 'approve') await api.approve(id, stageKey);
    if (action === 'revision') await api.revision(id, stageKey);
    const labels = ACTION_LABELS[stageKey];
    setMessage(action === 'approve' ? labels.approveMessage : labels.revisionMessage);
    await load();
  }

  if (!data) return <section className="work-area">加载中...</section>;
  const actionLabels = ACTION_LABELS[stageKey];

  return (
    <section className="work-area">
      <div className="page-header">
        <div>
          <h1>{data.stage.stage_name}</h1>
          <p>{GOALS[stageKey]}</p>
        </div>
        <StageStatusBadge status={data.stage.status} />
      </div>
      {message && <div className="notice">{message}</div>}
      {error && <div className="alert">{error}</div>}
      <div className="stage-layout">
        <section className="panel">
          <div className="panel-header"><h2>阶段资料</h2></div>
          <pre className="markdown-preview">{data.product_intro_summary}</pre>
          <ul className="file-list">
            {files.map((file) => <li key={file.id}>{file.file_type} / {file.file_name}</li>)}
            {!files.length && <li className="muted">暂无阶段文件。</li>}
          </ul>
          {stageKey === 'hermes_collection' ? (
            <FileUploader accept=".zip" label="上传 Hermes zip" onUpload={upload} />
          ) : (
            <FileUploader accept=".jpg,.jpeg,.png,.webp" multiple label="上传生成图片" onUpload={upload} />
          )}
        </section>
        <PromptEditor content={prompt} setContent={setPrompt} onSave={savePrompt} onReset={resetPrompt} />
      </div>
      {stageKey !== 'hermes_collection' && (
        <section className="panel">
          <div className="panel-header"><h2>图片预览</h2></div>
          <ImageGallery files={files} onSelect={selectFinal} />
        </section>
      )}
      <section className="panel">
        <div className="panel-header"><h2>阶段操作</h2></div>
        <div className="button-row">
          <button className="primary-button" onClick={() => mark('approve')}><CheckCircle2 size={16} /> {actionLabels.approve}</button>
          <button className="secondary-button" onClick={() => mark('revision')}><RotateCcw size={16} /> {actionLabels.revision}</button>
          <button className="secondary-button" onClick={() => navigate(`/projects/${id}`)}>返回项目详情</button>
        </div>
      </section>
    </section>
  );
}
