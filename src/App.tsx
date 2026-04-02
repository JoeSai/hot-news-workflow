import { ReactFlowProvider } from '@xyflow/react';
import { ErrorBoundary } from './components/ErrorBoundary';
import WorkflowCanvas from './components/WorkflowCanvas';

function App() {
  return (
    <div className="w-full h-screen bg-gray-50">
      {/* Header */}
      <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🔥</span>
          <h1 className="text-lg font-semibold text-gray-800">
            Hot News Workflow
          </h1>
          <span className="text-xs text-gray-400">ComfyUI Style</span>
        </div>
      </header>

      {/* Main Canvas */}
      <main className="h-[calc(100vh-3.5rem)]">
        <ReactFlowProvider>
          <ErrorBoundary>
            <WorkflowCanvas />
          </ErrorBoundary>
        </ReactFlowProvider>
      </main>
    </div>
  );
}

export default App;
