import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PRIORITY_OPTIONS, STATE_OPTIONS } from '@/constants/requirements';
import { Requirement } from '@/types';
import { ReactNode, RefObject } from 'react';

type ParentOption = {
  value: string;
  label: string;
  depth?: number;
  disabled?: boolean;
};

export type RequirementFormStateBase = {
  title: string;
  description: string;
  business_owner: string;
  labels: string;
  priority: Requirement['priority'];
  state: Requirement['state'];
  estimator?: string;
  parent_req_id?: string | null;
  environments?: string;
  stakeholders?: string;
};

interface RequirementFormFieldsProps {
  formData: RequirementFormStateBase;
  onChange: <K extends keyof RequirementFormStateBase>(field: K, value: RequirementFormStateBase[K]) => void;
  onTitleChange?: (value: string) => void;
  labelExtras?: Partial<Record<'description' | 'priority' | 'labels', ReactNode>>;
  includeEstimator?: boolean;
  labelsLabel?: string;
  titlePlaceholder?: string;
  descriptionPlaceholder?: string;
  labelsPlaceholder?: string;
  titleRef?: RefObject<HTMLInputElement>;
  parentOptions?: ParentOption[];
  parentLabel?: string;
  parentPlaceholder?: string;
  parentHelperText?: ReactNode;
}

export function RequirementFormFields({
  formData,
  onChange,
  onTitleChange,
  labelExtras,
  includeEstimator = false,
  labelsLabel = 'Etichette',
  titlePlaceholder = 'Titolo del requisito',
  descriptionPlaceholder = 'Descrizione dettagliata del requisito',
  labelsPlaceholder = 'tag1,tag2,tag3',
  titleRef,
  parentOptions = [],
  parentLabel = 'Dipendenza',
  parentPlaceholder = 'Nessun requisito padre',
  parentHelperText
}: RequirementFormFieldsProps) {
  const handleFieldChange = <K extends keyof RequirementFormStateBase>(field: K) => (value: RequirementFormStateBase[K]) => {
    onChange(field, value);
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="title">Titolo</Label>
        <Input
          ref={titleRef}
          id="title"
          value={formData.title}
          onChange={(e) => {
            if (onTitleChange) {
              onTitleChange(e.target.value);
            } else {
              handleFieldChange('title')(e.target.value);
            }
          }}
          placeholder={titlePlaceholder}
          required
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label htmlFor="description">Descrizione</Label>
          {labelExtras?.description}
        </div>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => handleFieldChange('description')(e.target.value)}
          placeholder={descriptionPlaceholder}
          rows={3}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label htmlFor="priority">Priorità</Label>
            {labelExtras?.priority}
          </div>
          <Select
            value={formData.priority}
            onValueChange={(value: Requirement['priority']) => handleFieldChange('priority')(value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="state">Stato</Label>
          <Select value={formData.state} onValueChange={(value: Requirement['state']) => handleFieldChange('state')(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="business_owner">Business Owner</Label>
          <Input
            id="business_owner"
            value={formData.business_owner}
            onChange={(e) => handleFieldChange('business_owner')(e.target.value)}
            placeholder="email@company.com"
            required
          />
        </div>

        {includeEstimator && (
          <div>
            <Label htmlFor="estimator">Estimator</Label>
            <Input
              id="estimator"
              value={formData.estimator ?? ''}
              onChange={(e) => handleFieldChange('estimator')(e.target.value)}
              placeholder="Chi farà la stima"
              required
            />
          </div>
        )}
      </div>

      {parentOptions && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label htmlFor="parent_req_id">{parentLabel}</Label>
            {parentHelperText}
          </div>
          <Select
            value={formData.parent_req_id ?? '__none'}
            onValueChange={(value) =>
              handleFieldChange('parent_req_id')(value === '__none' ? null : value)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder={parentPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">{parentPlaceholder}</SelectItem>
              {parentOptions.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  style={{ paddingLeft: `${12 + (option.depth ?? 0) * 12}px` }}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{option.label}</span>
                    {option.depth && option.depth > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        Livello {option.depth}
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label htmlFor="labels">{labelsLabel}</Label>
          {labelExtras?.labels}
        </div>
        <Input
          id="labels"
          value={formData.labels}
          onChange={(e) => handleFieldChange('labels')(e.target.value)}
          placeholder={labelsPlaceholder}
        />
      </div>
    </div>
  );
}
