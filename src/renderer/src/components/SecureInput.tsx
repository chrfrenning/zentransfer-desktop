import React, { useState } from 'react';
import { Input } from './catalyst/input';
import { Field, Label } from './catalyst/fieldset';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

interface SecureInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

const SecureInput: React.FC<SecureInputProps> = ({
  id,
  label,
  value,
  onChange,
  placeholder,
  required = false,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <Field>
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={isVisible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setIsVisible(!isVisible)}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none"
        >
          {isVisible ? (
            <EyeSlashIcon className="h-5 w-5" />
          ) : (
            <EyeIcon className="h-5 w-5" />
          )}
        </button>
      </div>
    </Field>
  );
};

export default SecureInput; 