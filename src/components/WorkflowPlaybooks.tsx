import type { WorkflowPlaybook } from '../types'
import './WorkflowPlaybooks.css'

interface WorkflowPlaybooksProps {
  playbooks: WorkflowPlaybook[]
}

export function WorkflowPlaybooks({ playbooks }: WorkflowPlaybooksProps) {
  return (
    <section className="workflow-grid" id="productivity">
      {playbooks.map((playbook) => (
        <article key={playbook.id}>
          <header>
            <h4>{playbook.team}</h4>
            <span>Copilot Ready</span>
          </header>
          <p className="pain-point">{playbook.painPoint}</p>
          <p className="ai-assist">{playbook.aiAssist}</p>
          <p className="benefit">{playbook.benefit}</p>
        </article>
      ))}
    </section>
  )
}
