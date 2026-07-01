import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import ProjectCreate from './pages/ProjectCreate.jsx';
import ProjectDetail from './pages/ProjectDetail.jsx';
import ProjectList from './pages/ProjectList.jsx';
import StagePage from './pages/StagePage.jsx';

export default function App() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  function navigate(to) {
    window.history.pushState({}, '', to);
    setPath(to);
  }

  const stageMatch = path.match(/^\/projects\/(\d+)\/stages\/([^/]+)$/);
  const projectMatch = path.match(/^\/projects\/(\d+)$/);

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="icon-button" title="返回项目列表" onClick={() => navigate('/')}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <strong>电商套图项目推进工作台</strong>
          <span>Phase 1 MVP</span>
        </div>
      </header>
      <main>
        {path === '/' && <ProjectList navigate={navigate} />}
        {path === '/projects/new' && <ProjectCreate navigate={navigate} />}
        {projectMatch && <ProjectDetail id={projectMatch[1]} navigate={navigate} />}
        {stageMatch && <StagePage id={stageMatch[1]} stageKey={stageMatch[2]} navigate={navigate} />}
      </main>
    </div>
  );
}

