import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../api.js';
import StageStatusBadge from '../components/StageStatusBadge.jsx';

export default function ProjectList({ navigate }) {
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.projects().then(setProjects).catch((err) => setError(err.message));
  }, []);

  return (
    <section className="work-area">
      <div className="page-header">
        <div>
          <h1>项目列表</h1>
          <p>从产品链接开始，推进 Hermes 采集、白底素材、主图生成。</p>
        </div>
        <button className="primary-button" onClick={() => navigate('/projects/new')}>
          <Plus size={17} /> 新建项目
        </button>
      </div>
      {error && <div className="alert">{error}</div>}
      <div className="table-shell">
        <table>
          <thead>
            <tr>
              <th>项目名称</th>
              <th>分类</th>
              <th>品牌</th>
              <th>当前阶段</th>
              <th>状态</th>
              <th>创建时间</th>
              <th>更新时间</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id} onClick={() => navigate(`/projects/${project.id}`)}>
                <td>{project.project_name}</td>
                <td>{project.category}</td>
                <td>{project.brand}</td>
                <td>{stageName(project.current_stage)}</td>
                <td><StageStatusBadge status={project.status} /></td>
                <td>{formatDate(project.created_at)}</td>
                <td>{formatDate(project.updated_at)}</td>
              </tr>
            ))}
            {!projects.length && (
              <tr>
                <td colSpan="7" className="empty">暂无项目</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function stageName(key) {
  return { hermes_collection: 'Hermes 采集', product_cutout_material: '白底素材', main_image: '主图生成' }[key] || key;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '';
}

