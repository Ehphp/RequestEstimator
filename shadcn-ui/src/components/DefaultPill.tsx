import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, RotateCcw } from 'lucide-react';

interface DefaultPillProps {
  source: string;
  isOverridden: boolean;
  onToggleOverride: () => void;
  onReset?: () => void;
  showResetButton?: boolean;
}

export function DefaultPill({ 
  source, 
  isOverridden, 
  onToggleOverride, 
  onReset,
  showResetButton = false 
}: DefaultPillProps) {
  if (isOverridden) {
    return (
      <div className="flex items-center gap-1">
        {showResetButton && onReset && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0"
                onClick={onReset}
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Ripristina default</p>
            </TooltipContent>
          </Tooltip>
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-5 px-2 text-xs"
          onClick={onToggleOverride}
        >
          Personalizzato
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="secondary" className="text-xs cursor-help">
            <Info className="h-3 w-3 mr-1" />
            Auto: {source}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>Valore automatico da: {source}</p>
          <p className="text-xs text-muted-foreground mt-1">Clicca per personalizzare</p>
        </TooltipContent>
      </Tooltip>
      <Button
        variant="ghost"
        size="sm"
        className="h-5 px-2 text-xs"
        onClick={onToggleOverride}
      >
        Personalizza
      </Button>
    </div>
  );
}