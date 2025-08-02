import React from "react";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

interface SelectContextValue {
  value?: string;
  onValueChange?: (value: string) => void;
}

const SelectContext = React.createContext<SelectContextValue>({});

export const Select: React.FC<SelectProps> = ({
  value,
  onValueChange,
  children
}) => {
  return (
    <SelectContext.Provider value={{ value, onValueChange }}>
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
  const [isOpen, setIsOpen] = React.useState(false);
  
  return (
    <button
      type="button"
      className={`relative flex w-full min-w-[8rem] items-center justify-between rounded-md px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 border border-gray-300 bg-background ${className}`}
      onClick={() => setIsOpen(!isOpen)}
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
        className="ml-2 h-4 w-4 opacity-50"
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
  return (
    <div className={`absolute top-full left-0 z-50 mt-1 max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-gray-200 bg-white text-gray-900 shadow-lg ${className}`}>
      <div className="p-1">{children}</div>
    </div>
  );
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
  const { value: selectedValue, onValueChange } = React.useContext(SelectContext);
  const isSelected = selectedValue === value;
  
  return (
    <div
      className={`relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-gray-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ${
        isSelected ? "bg-gray-100" : ""
      }`}
      onClick={() => onValueChange?.(value)}
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