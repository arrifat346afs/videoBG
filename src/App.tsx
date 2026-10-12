import { useEffect, useState } from 'react';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { PreviewCanvas } from './ui/PreviewCanvas.tsx';
import { SettingsPanel } from './ui/SettingsPanel.tsx';
import { BottomBar } from './ui/BottomBar.tsx';
import { ExportToast } from './ui/ExportToast.tsx';
import { Variations } from './ui/Variations.tsx';
import { HistoryPanel } from './ui/HistoryPanel.tsx';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const KBD_HINTS = [
  { kbd: 'Space', label: 'play' },
  { kbd: 'R', label: 'random' },
  { kbd: 'E', label: 'export' },
  { kbd: 'H', label: 'panel' },
];

function App() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.target instanceof HTMLSelectElement) return;
      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        setCollapsed((c) => !c);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="grid h-dvh grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-background text-foreground">
      <header className="flex h-[52px] shrink-0 items-center gap-3 border-b bg-card px-4">
        <div className="flex items-baseline gap-2">
          <strong className="text-[15px] tracking-wide">videoBg</strong>
          <span className="text-xs text-muted-foreground">procedural motion backgrounds</span>
        </div>
        <div className="flex-1" />
        <div className="hidden items-center gap-2 text-xs text-muted-foreground lg:flex" aria-hidden="true">
          {KBD_HINTS.map((h) => (
            <span key={h.kbd} className="flex items-center gap-1">
              <Badge variant="outline" className="px-1.5 font-mono text-[10px]">
                {h.kbd}
              </Badge>
              {h.label}
            </span>
          ))}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCollapsed((c) => !c)}
              aria-expanded={!collapsed}
            >
              {collapsed ? <PanelRightOpen /> : <PanelRightClose />}
              {collapsed ? 'Show panel' : 'Hide panel'}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Hide/show settings panel (H)</TooltipContent>
        </Tooltip>
      </header>

      <div className={cn('grid min-h-0 min-w-0 overflow-hidden lg:grid-cols-[minmax(0,1fr)_auto] lg:grid-rows-none grid-rows-[minmax(0,1fr)_auto] grid-cols-1')}>
        <main className="flex min-h-0 min-w-0 flex-col gap-3 overflow-y-auto bg-background p-4 lg:overflow-hidden">
          <PreviewCanvas />
          <Variations />
        </main>
        <aside
          aria-hidden={collapsed}
          aria-label="Settings panel"
          className={cn(
            'border-t bg-card transition-all duration-200 overflow-hidden lg:border-t-0 lg:border-l',
            collapsed ? 'max-h-0 opacity-0 border-transparent lg:max-h-none lg:w-0' : 'max-h-[42vh] lg:max-h-none lg:w-[340px]',
          )}
        >
          <ScrollArea className="h-full max-h-[42vh] lg:max-h-none">
            <div className="flex w-full flex-col gap-2 p-3 lg:w-[340px]">
              <SettingsPanel />
              <Separator />
              <HistoryPanel />
            </div>
          </ScrollArea>
        </aside>
      </div>

      <BottomBar />
      <ExportToast />
    </div>
  );
}

export default App;
