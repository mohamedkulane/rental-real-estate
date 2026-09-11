import { WorkflowEditor } from '@/features/workflow/workflow-editor';
export default async function Page({ params }: { params: Promise<{ workflowId: string }> }) { const { workflowId } = await params; return <WorkflowEditor workflowId={workflowId} />; }
