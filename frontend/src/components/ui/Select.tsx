import React from "react";
import { createPortal } from "react-dom";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

interface SelectContextValue {
  value?: string;
  onValueChange?: (value: string) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const SelectContext = React.createContext<SelectContextValue>({
  isOpen: false,
  setIsOpen: () => {},
  triggerRef: React.createRef<HTMLButtonElement>()
});

export const Select: React.FC<SelectProps> = ({
  value,
  onValueChange,
  children
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <SelectContext.Provider value={{ value, onValueChange, isOpen, setIsOpen, triggerRef }}>
      {children}
    </SelectContext.Provider>
  );
};

interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
  children: React.ReactNode;
}

export const SelectTrigger: React.FC<SelectTriggerProps> = ({
  className = "",
  children,
  ...props
}) => {
  const { isOpen, setIsOpen, triggerRef } = React.useContext(SelectContext);
  
  return (
    <button
      ref={triggerRef}
      type="button"
      className={`relative flex w-full min-w-[8rem] items-center justify-between rounded-md px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 border border-gray-600 bg-gray-800 text-white hover:bg-gray-700 ${className}`}
      onClick={() => setIsOpen(!isOpen)}
      aria-expanded={isOpen}
      {...props}
    >
      {children}
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className={`ml-2 h-4 w-4 opacity-50 transition-transform ${isOpen ? 'rotate-180' : ''}`}
      >
        <path d="m6 9 6 6 6-6"/>
      </svg>
    </button>
  );
};

export const SelectValue: React.FC<{ 
  placeholder?: string;
  children?: React.ReactNode;
}> = ({ 
  placeholder, 
  children 
}) => {
  const { value } = React.useContext(SelectContext);
  
  return (
    <span className="flex-1 text-left">
      {children || value || placeholder}
    </span>
  );
};

interface SelectContentProps {
  className?: string;
  children: React.ReactNode;
}

export const SelectContent: React.FC<SelectContentProps> = ({
  className = "",
  children
}) => {
  const { isOpen, triggerRef } = React.useContext(SelectContext);
  const [position, setPosition] = React.useState({ top: 0, left: 0, width: 0 });

  React.useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, [isOpen, triggerRef]);

  if (!isOpen) return null;

  const dropdown = (
    <div 
      className={`fixed z-[9999] max-h-[300px] overflow-auto rounded-md border border-gray-600 bg-gray-800 text-white shadow-xl ${className}`}
      style={{
        top: position.top + 4,
        left: position.left,
        width: position.width,
        minWidth: '8rem'
      }}
    >
      <div className="p-1">{children}</div>
    </div>
  );

  // Use portal to render dropdown at document body level
  return createPortal(dropdown, document.body);
};

interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  children?: React.ReactNode;
}

export const SelectItem: React.FC<SelectItemProps> = ({
  value,
  children,
  ...props
}) => {
  const { value: selectedValue, onValueChange, setIsOpen } = React.useContext(SelectContext);
  const isSelected = selectedValue === value;
  
  const handleSelect = () => {
    onValueChange?.(value);
    setIsOpen(false);
  };
  
  return (
    <div
      className={`relative flex w-full cursor-pointer select-none items-center rounded-sm py-2 pl-8 pr-2 text-sm outline-none hover:bg-gray-700 focus:bg-gray-700 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ${
        isSelected ? "bg-gray-700" : ""
      }`}
      onClick={handleSelect}
      {...props}
    >
      {isSelected && (
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="24" 
            height="24" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className="h-4 w-4"
          >
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </span>
      )}
      <span className="flex-1">{children}</span>
    </div>
  );
};

export * from './SelectNew'; 