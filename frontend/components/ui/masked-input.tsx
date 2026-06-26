'use client';

import { InputHTMLAttributes, useState } from 'react';
import { Input } from '@/components/ui/input';
import { formatCpfInput, formatPhoneInput } from '@/lib/br-input-masks';

type MaskKind = 'cpf' | 'phone' | 'none';

export function MaskedInput({
  mask,
  defaultValue = '',
  value: controlledValue,
  onValueChange,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
  mask: MaskKind;
  onValueChange?: (raw: string, formatted: string) => void;
}) {
  const format = mask === 'cpf' ? formatCpfInput : mask === 'phone' ? formatPhoneInput : (v: string) => v;
  const [internal, setInternal] = useState(() => format(String(defaultValue ?? '')));

  const display = controlledValue !== undefined ? format(String(controlledValue)) : internal;

  return (
    <Input
      {...props}
      value={display}
      onChange={(event) => {
        const formatted = format(event.target.value);
        if (controlledValue === undefined) setInternal(formatted);
        onValueChange?.(formatted.replace(/\D/g, ''), formatted);
      }}
      inputMode={mask === 'none' ? props.inputMode : 'numeric'}
    />
  );
}
