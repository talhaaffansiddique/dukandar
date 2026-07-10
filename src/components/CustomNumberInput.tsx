import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface CustomNumberInputProps {
  value: number | '';
  onChange: (val: number | '') => void;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
  disabled?: boolean;
  chips?: number[]; // preset adjustments, e.g. [-10, -1, 1, 10]
  icon?: React.ReactNode;
  paddingLeft?: string;
}

export default function CustomNumberInput({
  value,
  onChange,
  placeholder = '0.00',
  min,
  max,
  step = 1,
  required = false,
  disabled = false,
  chips = [-10, -1, 1, 10],
  icon,
  paddingLeft
}: CustomNumberInputProps) {
  
  const handleIncrement = () => {
    if (disabled) return;
    const current = value === '' ? 0 : Number(value);
    let newVal = current + step;
    if (max !== undefined && newVal > max) newVal = max;
    if (min !== undefined && newVal < min) newVal = min;
    onChange(newVal);
  };

  const handleDecrement = () => {
    if (disabled) return;
    const current = value === '' ? 0 : Number(value);
    let newVal = current - step;
    if (max !== undefined && newVal > max) newVal = max;
    if (min !== undefined && newVal < min) newVal = min;
    onChange(newVal);
  };

  const handleChipClick = (amount: number) => {
    if (disabled) return;
    const current = value === '' ? 0 : Number(value);
    let newVal = current + amount;
    if (max !== undefined && newVal > max) newVal = max;
    if (min !== undefined && newVal < min) newVal = min;
    onChange(newVal);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value;
    if (valStr === '') {
      onChange('');
      return;
    }
    let valNum = Number(valStr);
    if (isNaN(valNum)) return;
    if (max !== undefined && valNum > max) valNum = max;
    if (min !== undefined && valNum < min) valNum = min;
    onChange(valNum);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%' }}>
      {/* Input Field Wrapper */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
        {icon && (
          <div style={{ position: 'absolute', left: '12px', display: 'flex', alignItems: 'center', pointerEvents: 'none', color: 'var(--text-tertiary)' }}>
            {icon}
          </div>
        )}
        <input
          type="number"
          step={step}
          min={min}
          max={max}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          className="input-control custom-number-input"
          style={{
            paddingLeft: paddingLeft || (icon ? '2.5rem' : '12px'),
            paddingRight: '2.5rem', // space for vertical stacked buttons
            width: '100%',
            appearance: 'none',
            MozAppearance: 'textfield'
          }}
          value={value}
          onChange={handleChange}
        />
        
        {/* Integrated Stacked Spinner Buttons */}
        {!disabled && (
          <div style={{
            position: 'absolute',
            right: '4px',
            top: '4px',
            bottom: '4px',
            width: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '1px',
            zIndex: 5
          }}>
            <button
              type="button"
              onClick={handleIncrement}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderTopLeftRadius: '3px',
                borderTopRightRadius: '3px',
                borderBottom: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: 0,
                transition: 'all 0.15s ease'
              }}
              className="spinner-btn-up"
              title="Increment"
            >
              <ChevronUp size={14} />
            </button>
            <button
              type="button"
              onClick={handleDecrement}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderBottomLeftRadius: '3px',
                borderBottomRightRadius: '3px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: 0,
                transition: 'all 0.15s ease'
              }}
              className="spinner-btn-down"
              title="Decrement"
            >
              <ChevronDown size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Quick Adjustment Chips */}
      {!disabled && chips && chips.length > 0 && (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.1rem' }}>
          {chips.map((val, idx) => {
            const isNegative = val < 0;
            const label = isNegative ? `${val}` : `+${val}`;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleChipClick(val)}
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  padding: '0.2rem 0.6rem',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-secondary)',
                  color: isNegative ? 'var(--danger)' : 'var(--primary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  userSelect: 'none'
                }}
                className="qty-chip-btn"
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
