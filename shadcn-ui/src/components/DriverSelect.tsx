import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { drivers } from '@/data/catalog';
import { DefaultPill } from './DefaultPill';

interface DriverSelectProps {
    label: string;
    driverType: 'complexity' | 'environments' | 'reuse' | 'stakeholders';
    value: string;
    onChange: (value: string) => void;
    defaultSource?: string;
    isOverridden?: boolean;
    onToggleOverride?: () => void;
}

export function DriverSelect({
    label,
    driverType,
    value,
    onChange,
    defaultSource,
    isOverridden,
    onToggleOverride,
}: DriverSelectProps) {
    const driverOptions = drivers.filter(d => d.driver === driverType);

    return (
        <div>
            <div className="flex items-center justify-between mb-1">
                <Label htmlFor={driverType} className="text-sm">{label}</Label>
                {defaultSource && onToggleOverride && (
                    <DefaultPill
                        source={defaultSource}
                        isOverridden={isOverridden || false}
                        onToggleOverride={onToggleOverride}
                    />
                )}
            </div>
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger id={driverType}>
                    <SelectValue placeholder={`Seleziona ${label.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                    {driverOptions.map((driver) => (
                        <SelectItem key={driver.option} value={driver.option}>
                            {driver.option} (x{driver.multiplier}) - {driver.explanation}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
