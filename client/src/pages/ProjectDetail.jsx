import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { api } from '../api.js';
import FileUploader from '../components/FileUploader.jsx';
import StageStatusBadge from '../components/StageStatusBadge.jsx';

export default function ProjectDetail({ id, navigate }) {
  const [project, setProject] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, [id]);

  async function load() {
    try {
      setProject(await api.project(id));
    } catch (err) {
      setError(err.message);
    }
  }

  async function uploadHermes(files) {
    setMessage('正在上传并解析 Hermes zip...');
    setError('');
    try {
      const result = await api.uploadHermes(id, files[0]);
      setProject(result.project);
      setMessage(result.warnings?.length ? result.warnings.join('；') : 'Hermes zip 已解析。');
    } catch (err) {
      setError(err.message);
    }
  }

  if (!project) return <section className="work-area">加载中...</section>;

  return (
    <section className="work-area">
      <div className="page-header">
        <div>
          <h1>{project.project_name}</h1>
          <p>{project.source_url}</p>
        </div>
        <FileUploader accept=".zip" label="上传 Hermes zip" onUpload={uploadHermes} />
      </div>
      {message && <div className="notice">{message}</div>}
      {error && <div className="alert">{error}</div>}
      <div className="info-grid">
        <Info label="项目编号" value={project.project_code} />
        <Info label="品牌" value={project.brand} />
        <Info label="产品分类" value={project.category} />
        <Info label="目标平台" value={project.target_platform} />
        <Info label="当前阶段" value={stageName(project.current_stage)} />
        <Info label="SKU 数量" value={project.sku_count} />
      </div>
      <section className="panel">
        <div className="panel-header"><h2>阶段入口</h2></div>
        <div className="stage-list">
          {project.stages.map((stage, index) => (
            <button key={stage.stage_key} className="stage-row" onClick={() => navigate(`/projects/${id}/stages/${stage.stage_key}`)}>
              <span>{index + 1}. {stage.stage_name}</span>
              <StageStatusBadge status={stage.status} />
              <ArrowRight size={17} />
            </button>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="panel-header"><h2>产品介绍摘要</h2></div>
        <pre className="markdown-preview">{project.product_intro_summary}</pre>
      </section>
      <section className="panel">
        <div className="panel-header"><h2>文件列表</h2></div>
        <ul className="file-list">
          {project.files.map((file) => <li key={file.id}>{file.stage_key || 'project'} / {file.file_type} / {file.file_name}</li>)}
          {!project.files.length && <li className="muted">暂无文件。</li>}
        </ul>
      </section>
    </section>
  );
}

function Info({ label, value }) {
  return <div className="info-item"><span>{label}</span><strong>{value || '-'}</strong></div>;
}

function stageName(key) {
  return { hermes_collection: 'Hermes 采集', product_cutout_material: '白底素材', main_image: '主图生成' }[key] || key;
}

