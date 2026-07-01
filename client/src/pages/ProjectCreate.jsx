import { useState } from 'react';
import { api } from '../api.js';

const CATEGORIES = ['Nail Gel', 'Nail Tool', 'Nail Lamp', 'Nail Sticker', 'Press-on Nail', 'Other'];

export default function ProjectCreate({ navigate }) {
  const [form, setForm] = useState({
    source_url: '',
    source_platform: '1688',
    brand: 'JUCYEE | BOMD',
    category: 'Nail Gel',
    target_platform: 'Shopee PH',
    include_sku: true
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const project = await api.createProject(form);
      navigate(`/projects/${project.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="work-area narrow">
      <div className="page-header">
        <div>
          <h1>新建项目</h1>
          <p>创建项目文件夹并生成 Hermes 采集提示词。</p>
        </div>
      </div>
      {error && <div className="alert">{error}</div>}
      <form className="form-panel" onSubmit={submit}>
        <label>
          产品链接
          <input required value={form.source_url} onChange={(event) => setForm({ ...form, source_url: event.target.value })} />
        </label>
        <div className="form-grid">
          <label>
            来源平台
            <input value={form.source_platform} onChange={(event) => setForm({ ...form, source_platform: event.target.value })} />
          </label>
          <label>
            品牌
            <input value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} />
          </label>
        </div>
        <div className="form-grid">
          <label>
            产品分类
            <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
              {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
            </select>
          </label>
          <label>
            目标平台
            <input value={form.target_platform} onChange={(event) => setForm({ ...form, target_platform: event.target.value })} />
          </label>
        </div>
        <label className="checkbox-row">
          <input type="checkbox" checked={form.include_sku} onChange={(event) => setForm({ ...form, include_sku: event.target.checked })} />
          包含 SKU
        </label>
        <button className="primary-button" disabled={saving}>{saving ? '创建中' : '创建项目'}</button>
      </form>
    </section>
  );
}

