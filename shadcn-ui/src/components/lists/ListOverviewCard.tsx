import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { KeyboardEvent, ReactNode } from 'react';

interface ListOverviewCardProps {
  title: ReactNode;
  headerContent?: ReactNode;
  rightElement?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  onClick?: () => void;
}

export function ListOverviewCard({
  title,
  headerContent,
  rightElement,
  children,
  className,
  headerClassName,
  contentClassName,
  onClick
}: ListOverviewCardProps) {
  const isInteractive = Boolean(onClick);
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!isInteractive) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick?.();
    }
  };

  return (
    <Card
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={handleKeyDown}
      className={cn(onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : '', className)}
      onClick={onClick}
    >
      <CardHeader className={cn('pb-3', headerClassName)}>
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1">
            <CardTitle className="text-lg">{title}</CardTitle>
            {headerContent}
          </div>
          {rightElement}
        </div>
      </CardHeader>
      <CardContent className={cn('space-y-4', contentClassName)}>{children}</CardContent>
    </Card>
  );
}
