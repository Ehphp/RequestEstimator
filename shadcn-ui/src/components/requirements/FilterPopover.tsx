import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type FilterOption = {
  value: string;
  label?: string;
};

interface FilterPopoverProps {
  buttonLabel: string;
  title: string;
  options: FilterOption[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  triggerClassName?: string;
  scrollable?: boolean;
  optionClassName?: string;
  contentClassName?: string;
}

export function FilterPopover({
  buttonLabel,
  title,
  options,
  selectedValues,
  onToggle,
  triggerClassName,
  scrollable = false,
  optionClassName,
  contentClassName
}: FilterPopoverProps) {
  const hasSelection = selectedValues.length > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('justify-between w-[160px]', triggerClassName)}
        >
          <span>{buttonLabel}</span>
          {hasSelection && (
            <Badge variant="secondary">{selectedValues.length}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn('w-64 space-y-3', contentClassName)}>
        <div className="text-sm font-medium">{title}</div>
        <div className={cn('space-y-2', scrollable && 'max-h-60 overflow-y-auto pr-2')}>
          {options.map((option) => (
            <label
              key={option.value}
              className={cn('flex items-center gap-2 text-sm', optionClassName)}
            >
              <Checkbox
                checked={selectedValues.includes(option.value)}
                onCheckedChange={() => onToggle(option.value)}
              />
              <span>{option.label ?? option.value}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
