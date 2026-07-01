const LABELS = {
  not_started: '未开始',
  prompt_ready: '提示词就绪',
  waiting_for_upload: '待上传',
  uploaded: '已上传',
  parsed: '已解析',
  needs_fix: '需修正',
  waiting_for_chatgpt: '待生成',
  approved: '已通过',
  needs_revision: '需返工',
  done: '完成',
  created: '已创建'
};

export default function StageStatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{LABELS[status] || status}</span>;
}

