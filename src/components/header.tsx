'use client';

import { Eye } from 'lucide-react';
import { useStore } from '@/lib/store';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import type { Role } from '@/lib/types';

interface HeaderProps {
  role: Role;
}

export default function Header({ role }: HeaderProps) {
  const { mode, setMode } = useStore();

  const handleModeChange = (checked: boolean) => {
    setMode(checked ? 'server' : 'wasm');
  };

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-4 md:px-6">
      <div className="flex items-center gap-3">
        <Eye className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Vision Weaver</h1>
      </div>
      {role === 'laptop' && (
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Badge variant={mode === 'wasm' ? 'default' : 'secondary'}>WASM</Badge>
            <Switch
              id="inference-mode"
              checked={mode === 'server'}
              onCheckedChange={handleModeChange}
              aria-label="Switch inference mode"
            />
            <Badge variant={mode === 'server' ? 'default' : 'secondary'}>Server</Badge>
          </div>
        </div>
      )}
    </header>
  );
}
